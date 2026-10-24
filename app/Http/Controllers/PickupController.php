<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\ErpPickup;
use App\Models\ErpPickupEvent;
use App\Models\ErpPickupItem;
use App\Models\ErpPickupLocation;
use App\Models\Transaction;
use App\Services\DocumentNumberService;
use App\Services\Erp\CurrencyStockService;
use App\Services\Erp\TransactionLedgerPoster;
use App\Services\GoamlComplianceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Serah Terima / Pickup valas oleh kurir (seperti aplikasi ojol).
 *
 *  REQUESTED --kurir berangkat--> ON_THE_WAY --kurir serah + PIN--> DELIVERED --staf selesaikan--> COMPLETED
 *      \--staf batal--> CANCELLED         \--staf batal / kurir kembali--> RETURNED
 *
 * Valas keluar dari stok brankas saat ON_THE_WAY (ditahan kurir) dan baru menjadi penjualan
 * resmi (transaksi JUAL + kas/bank) saat COMPLETED. Batal/kembali mengembalikan stok.
 */
class PickupController extends Controller
{
    private const MIN_TRACK_INTERVAL_SECONDS = 8;
    private const MAX_PIN_ATTEMPTS = 5;

    // ------------------------------------------------------------------ baca

    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope', 'active');
        $query = ErpPickup::query()->with('items');
        if ($this->isCourier($request)) {
            $query->where('courier_user_id', (string) $request->user()->id);
        }

        if ($scope === 'history') {
            $query->whereIn('status', ErpPickup::HISTORY)->orderByDesc('updated_at');
        } else {
            $query->whereIn('status', ErpPickup::ACTIVE)->orderByDesc('id');
        }
        $limit = min(300, max(1, (int) $request->query('limit', 100)));
        $rows = $query->limit($limit)->get()->map(fn ($p) => $this->present($p));

        $custody = [];
        if (!$this->isCourier($request)) {
            $items = ErpPickupItem::query()
                ->join('erp_pickups', 'erp_pickups.id', '=', 'erp_pickup_items.pickup_id')
                ->whereIn('erp_pickups.status', ErpPickup::IN_CUSTODY)
                ->groupBy('erp_pickup_items.currency_code')
                ->selectRaw('erp_pickup_items.currency_code AS code, SUM(erp_pickup_items.amount) AS amount, COUNT(DISTINCT erp_pickups.id) AS pickups')
                ->get();
            $custody = $items->map(fn ($r) => ['code' => $r->code, 'amount' => (float) $r->amount, 'pickups' => (int) $r->pickups])->all();
        }

        return $this->ok(['pickups' => $rows, 'custody' => $custody]);
    }

    public function show(Request $request, ErpPickup $pickup): JsonResponse
    {
        $this->authorizeAccess($request, $pickup);
        $pickup->load(['items', 'events']);
        $data = $this->present($pickup);
        $data['events'] = $pickup->events->map(fn ($e) => [
            'status' => $e->status, 'actor' => $e->actor_name, 'note' => $e->note,
            'lat' => $e->lat, 'lng' => $e->lng, 'at' => optional($e->created_at)->toIso8601String(),
        ])->all();
        $data['track'] = $pickup->locations()->orderByDesc('recorded_at')->limit(400)->get()
            ->reverse()->values()->map(fn ($l) => [$l->lat, $l->lng, $l->recorded_at->toIso8601String()])->all();

        return $this->ok($data);
    }

    public function couriers(Request $request): JsonResponse
    {
        $this->requireStaff($request);
        $rows = DB::table('users')->whereRaw('LOWER(role) = ?', ['kurir'])
            ->orderBy('full_name')->get(['id', 'full_name', 'username']);

        return $this->ok($rows->map(fn ($u) => [
            'id' => (string) $u->id, 'name' => $u->full_name ?: $u->username, 'username' => $u->username,
        ])->all());
    }

    // --------------------------------------------------------------- tulis

    public function store(Request $request, DocumentNumberService $numbers): JsonResponse
    {
        $this->requireStaff($request);
        $d = $request->validate([
            'courier_user_id' => ['required', 'string', 'max:50'],
            'destination' => ['required', 'string', 'max:255'],
            'dest_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'dest_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'vehicle_type' => ['nullable', 'string', 'max:20'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.currency_code' => ['required', 'string', 'max:10'],
            'items.*.amount' => ['required', 'numeric', 'gt:0'],
            'items.*.rate' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $courier = DB::table('users')->where('id', $d['courier_user_id'])->whereRaw('LOWER(role) = ?', ['kurir'])->first();
        if (!$courier) {
            throw ValidationException::withMessages(['courier_user_id' => 'Kurir tidak ditemukan.']);
        }

        $rows = [];
        $total = 0.0;
        foreach ($d['items'] as $i => $it) {
            $code = strtoupper(trim($it['currency_code']));
            $cur = Currency::find($code);
            if (!$cur) {
                throw ValidationException::withMessages(["items.$i.currency_code" => "Mata uang $code tidak ditemukan."]);
            }
            $rate = (float) ($it['rate'] ?? 0) ?: (float) $cur->sell;
            if ($rate <= 0) {
                throw ValidationException::withMessages(["items.$i.rate" => "Kurs $code belum diisi."]);
            }
            $amount = round((float) $it['amount'], 4);
            $rowTotal = round($amount * $rate, 2);
            $total += $rowTotal;
            $rows[] = ['currency_code' => $code, 'amount' => $amount, 'estimated_rate' => $rate, 'estimated_total' => $rowTotal];
        }

        $pin = (string) random_int(1000, 9999);
        $actor = $this->actorName($request);

        $pickup = DB::transaction(function () use ($d, $rows, $total, $pin, $actor, $courier, $numbers) {
            $no = $numbers->next('PKP'.now()->format('ymd'))['id'];
            $p = ErpPickup::create([
                'pickup_no' => $no,
                'status' => ErpPickup::REQUESTED,
                'courier_user_id' => (string) $courier->id,
                'courier_name' => $courier->full_name ?: $courier->username,
                'vehicle_type' => $d['vehicle_type'] ?? null,
                'vehicle_plate' => isset($d['vehicle_plate']) ? strtoupper($d['vehicle_plate']) : null,
                'destination' => $d['destination'],
                'dest_lat' => $d['dest_lat'] ?? null,
                'dest_lng' => $d['dest_lng'] ?? null,
                'customer_name' => $d['customer_name'] ?? null,
                'customer_phone' => $d['customer_phone'] ?? null,
                'notes' => $d['notes'] ?? null,
                'sender_name' => $actor,
                'estimated_total_idr' => $total,
                'pin_hash' => Hash::make($pin),
            ]);
            foreach ($rows as $r) {
                $p->items()->create($r);
            }
            $this->event($p, ErpPickup::REQUESTED, $actor, 'Penugasan dibuat');

            return $p;
        });

        $data = $this->present($pickup->load('items'));
        $data['pin'] = $pin; // hanya ditampilkan sekali

        return $this->ok($data, 201);
    }

    public function start(Request $request, ErpPickup $pickup, CurrencyStockService $stock): JsonResponse
    {
        $this->authorizeAccess($request, $pickup);
        $d = $request->validate([
            'photo_pickup' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        try {
            DB::transaction(function () use ($pickup, $stock, $request, $d) {
                $p = ErpPickup::whereKey($pickup->id)->lockForUpdate()->firstOrFail();
                $this->mustBe($p, [ErpPickup::REQUESTED], 'Penugasan sudah diproses.');
                foreach ($p->items as $it) {
                    $this->guardCurrencyStock($it->currency_code, (float) $it->amount);
                }
                foreach ($p->items as $it) {
                    $stock->post($it->currency_code, 'OUT', (float) $it->amount, $p->pickup_no,
                        "pickup-out-{$p->id}-{$it->id}", ['pickup_id' => $p->id, 'reason' => 'dibawa kurir']);
                    $this->adjustCurrency($it->currency_code, -(float) $it->amount);
                }
                $p->update([
                    'status' => ErpPickup::ON_THE_WAY, 'picked_up_at' => now(),
                    'photo_pickup' => $d['photo_pickup'] ?? null,
                    'last_lat' => $d['lat'] ?? null, 'last_lng' => $d['lng'] ?? null,
                    'last_seen_at' => isset($d['lat']) ? now() : null,
                ]);
                $this->event($p, ErpPickup::ON_THE_WAY, $this->actorName($request), 'Kurir berangkat membawa valas', $d['lat'] ?? null, $d['lng'] ?? null);
            });
        } catch (RuntimeException $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok($this->present($pickup->fresh('items')));
    }

    public function location(Request $request, ErpPickup $pickup): JsonResponse
    {
        $this->authorizeAccess($request, $pickup);
        if (!$this->isCourier($request)) {
            return $this->fail('Hanya kurir yang mengirim lokasi.', 403);
        }
        $d = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'speed' => ['nullable', 'numeric'],
            'heading' => ['nullable', 'numeric'],
        ]);
        if ($pickup->status !== ErpPickup::ON_THE_WAY) {
            return $this->ok(['tracking' => false]);
        }

        $this->storeLocation($pickup, (float) $d['lat'], (float) $d['lng'], $d['accuracy'] ?? null, $d['speed'] ?? null, $d['heading'] ?? null);

        return $this->ok(['tracking' => true]);
    }

    public function deliver(Request $request, ErpPickup $pickup): JsonResponse
    {
        $this->authorizeAccess($request, $pickup);
        $d = $request->validate([
            'pin' => ['required', 'string', 'max:10'],
            'recipient_name' => ['required', 'string', 'max:150'],
            'photo_proof' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'rates' => ['nullable', 'array'],
            'rates.*' => ['numeric', 'gt:0'],
        ]);

        $result = DB::transaction(function () use ($pickup, $d, $request) {
            $p = ErpPickup::whereKey($pickup->id)->lockForUpdate()->firstOrFail();
            $this->mustBe($p, [ErpPickup::ON_THE_WAY], 'Pickup belum berangkat atau sudah diserahkan.');
            if ($p->pin_attempts >= self::MAX_PIN_ATTEMPTS) {
                return ['error' => 'PIN terkunci karena terlalu banyak salah. Minta staf mereset PIN.', 'code' => 423];
            }
            if (!Hash::check($d['pin'], $p->pin_hash)) {
                $p->increment('pin_attempts');
                $left = max(0, self::MAX_PIN_ATTEMPTS - $p->pin_attempts);

                return ['error' => "PIN salah. Sisa percobaan: $left.", 'code' => 422];
            }
            $p->update([
                'status' => ErpPickup::DELIVERED, 'delivered_at' => now(), 'pin_attempts' => 0,
                'recipient_name' => $d['recipient_name'], 'photo_proof' => $d['photo_proof'] ?? null,
            ]);
            $this->applyRealizedRates($p, $d['rates'] ?? []);
            $this->event($p, ErpPickup::DELIVERED, $this->actorName($request), 'Diterima oleh '.$d['recipient_name'], $d['lat'] ?? null, $d['lng'] ?? null);

            return ['ok' => true];
        });

        if (isset($result['error'])) {
            return $this->fail($result['error'], $result['code']);
        }

        return $this->ok($this->present($pickup->fresh('items')));
    }

    public function complete(Request $request, ErpPickup $pickup, CurrencyStockService $stock, DocumentNumberService $numbers, TransactionLedgerPoster $ledger, GoamlComplianceService $goaml): JsonResponse
    {
        $this->requireStaff($request);
        $d = $request->validate([
            'settle_to' => ['required', 'in:CASH,BCA,MANDIRI'],
            'rates' => ['nullable', 'array'],
            'rates.*' => ['numeric', 'gt:0'],
        ]);

        try {
            $invoice = DB::transaction(function () use ($pickup, $d, $request, $stock, $numbers, $ledger, $goaml) {
                $p = ErpPickup::whereKey($pickup->id)->lockForUpdate()->firstOrFail();
                $this->mustBe($p, [ErpPickup::DELIVERED], 'Pickup belum diserahkan kurir atau sudah selesai.');
                $this->applyRealizedRates($p, $d['rates'] ?? []);
                $p->load('items');

                $actor = $this->actorName($request);
                $inv = $numbers->next('INV')['id'];
                $stamp = now();
                $bank = $d['settle_to'] === 'CASH' ? null : $d['settle_to'];
                $grand = 0.0;

                foreach ($p->items as $n => $it) {
                    // Valas kembali ke stok, lalu keluar lagi sebagai penjualan resmi lewat ledger.
                    $stock->post($it->currency_code, 'IN', (float) $it->amount, $p->pickup_no,
                        "pickup-settle-{$p->id}-{$it->id}", ['pickup_id' => $p->id, 'reason' => 'serah terima selesai']);

                    $rate = (float) ($it->realized_rate ?: $it->estimated_rate);
                    $total = round((float) $it->amount * $rate, 2);
                    $grand += $total;
                    $itemId = sprintf('%s-%s-%02d', $inv, $it->currency_code, $n + 1);
                    $raw = [
                        'id' => $inv, 'itemId' => $itemId, 'tipe' => 'JUAL', 'valuta' => $it->currency_code,
                        'nominal' => (float) $it->amount, 'rate' => $rate, 'total' => $total,
                        'kasir' => $actor, 'inputBy' => $actor, 'customerName' => $p->customer_name,
                        'paymentMethod' => $bank ? 'TRANSFER' : 'CASH', 'bank' => $bank,
                        'tipe_transaksi' => 'PICKUP', 'status' => 'LUNAS', 'invoiceId' => $inv,
                        'pickupId' => $p->id, 'pickupNo' => $p->pickup_no, 'courierName' => $p->courier_name,
                        'recipientName' => $p->recipient_name, 'transferProof' => $p->photo_proof,
                    ];
                    $data = [
                        'id' => $inv, 'timestamp' => $stamp->format('Y-m-d H:i:s'), 'tipe' => 'JUAL',
                        'valuta' => $it->currency_code, 'nominal' => (float) $it->amount, 'rate' => $rate, 'total' => $total,
                        'id_cif' => '', 'customerName' => (string) $p->customer_name, 'kasir' => $actor,
                        'paymentMethod' => $bank ? 'TRANSFER' : 'CASH', 'isOldMoney' => false,
                        'keterangan' => "Pickup {$p->pickup_no} • Kurir {$p->courier_name}",
                        'raw_json' => json_encode($raw),
                    ];
                    $trx = Transaction::updateOrCreate(['itemId' => $itemId], $data);
                    try {
                        $goaml->evaluateTransaction($trx);
                    } catch (\Throwable $e) {
                        report($e);
                    }

                    $payment = $bank
                        ? ['method' => 'bank', 'amount' => $total, 'bank_name' => $bank]
                        : ['method' => 'cash', 'amount' => $total];
                    $ledger->post($trx, [$payment], $request->user()->id ?? null);
                }

                $p->update([
                    'status' => ErpPickup::COMPLETED, 'completed_at' => now(), 'settle_to' => $d['settle_to'],
                    'invoice_no' => $inv, 'realized_total_idr' => $grand,
                ]);
                $this->event($p, ErpPickup::COMPLETED, $actor, "Diselesaikan • {$inv} • ".($bank ?: 'Tunai'));

                return $inv;
            });
        } catch (RuntimeException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (ValidationException $e) {
            return $this->fail('Gagal mencatat penjualan: '.collect($e->errors())->flatten()->first(), 422);
        }

        $data = $this->present($pickup->fresh('items'));
        $data['invoice_no'] = $invoice;

        return $this->ok($data);
    }

    public function cancel(Request $request, ErpPickup $pickup, CurrencyStockService $stock): JsonResponse
    {
        $this->requireStaff($request);
        $d = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        try {
            DB::transaction(function () use ($pickup, $d, $request, $stock) {
                $p = ErpPickup::whereKey($pickup->id)->lockForUpdate()->firstOrFail();
                $this->mustBe($p, [ErpPickup::REQUESTED, ErpPickup::ON_THE_WAY], 'Pickup yang sudah diserahkan harus diselesaikan, tidak bisa dibatalkan.');
                $actor = $this->actorName($request);
                if ($p->status === ErpPickup::REQUESTED) {
                    $p->update(['status' => ErpPickup::CANCELLED, 'cancelled_at' => now(), 'cancel_reason' => $d['reason']]);
                    $this->event($p, ErpPickup::CANCELLED, $actor, $d['reason']);

                    return;
                }
                foreach ($p->items as $it) {
                    $stock->post($it->currency_code, 'IN', (float) $it->amount, $p->pickup_no,
                        "pickup-return-{$p->id}-{$it->id}", ['pickup_id' => $p->id, 'reason' => 'valas kembali dari kurir']);
                    $this->adjustCurrency($it->currency_code, (float) $it->amount);
                }
                $p->update(['status' => ErpPickup::RETURNED, 'cancelled_at' => now(), 'cancel_reason' => $d['reason']]);
                $this->event($p, ErpPickup::RETURNED, $actor, 'Valas dikembalikan ke brankas: '.$d['reason']);
            });
        } catch (RuntimeException $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok($this->present($pickup->fresh('items')));
    }

    public function resetPin(Request $request, ErpPickup $pickup): JsonResponse
    {
        $this->requireStaff($request);
        if (!in_array($pickup->status, [ErpPickup::REQUESTED, ErpPickup::ON_THE_WAY], true)) {
            return $this->fail('PIN hanya bisa direset sebelum serah terima.', 422);
        }
        $pin = (string) random_int(1000, 9999);
        $pickup->update(['pin_hash' => Hash::make($pin), 'pin_attempts' => 0]);
        $this->event($pickup, $pickup->status, $this->actorName($request), 'PIN direset');

        return $this->ok(['pin' => $pin]);
    }


    // ----------------------------------------------- pelacak GPS eksternal

    /** Staf membuat / mereset token pelacak untuk seorang kurir. Token hanya tampil sekali. */
    public function trackerToken(Request $request, string $userId): JsonResponse
    {
        $this->requireStaff($request);
        $courier = DB::table('users')->where('id', $userId)->whereRaw('LOWER(role) = ?', ['kurir'])->first();
        if (!$courier) {
            return $this->fail('Kurir tidak ditemukan.', 404);
        }
        $token = Str::random(40);
        DB::table('erp_courier_trackers')->updateOrInsert(
            ['user_id' => (string) $courier->id],
            ['token_hash' => hash('sha256', $token), 'updated_at' => now(), 'created_at' => now()]
        );

        return $this->ok([
            'user_id' => (string) $courier->id,
            'name' => $courier->full_name ?: $courier->username,
            'owntracks_url' => url('/api/tracker/'.$token),
            'traccar_url' => url('/api/tracker/'.$token),
        ]);
    }

    /** Status pelacak per kurir (tanpa token). */
    public function trackerStatus(Request $request): JsonResponse
    {
        $this->requireStaff($request);
        $rows = DB::table('erp_courier_trackers')->get()->keyBy('user_id');

        return $this->ok($rows->map(fn ($r) => [
            'last_ping_at' => $r->last_ping_at ? Carbon::parse($r->last_ping_at)->toIso8601String() : null,
            'battery' => $r->battery,
        ])->all());
    }

    /**
     * Endpoint publik untuk OwnTracks (HTTP, JSON `_type: location`) dan Traccar Client (protokol OsmAnd:
     * lat, lon, speed [knot], bearing, accuracy, batt). Autentikasi lewat token di URL.
     */
    public function trackerIngest(Request $request, string $token): JsonResponse
    {
        $tracker = DB::table('erp_courier_trackers')->where('token_hash', hash('sha256', $token))->first();
        if (!$tracker) {
            return response()->json(['status' => 'error', 'message' => 'Token tidak valid.'], 401);
        }

        $in = array_merge($request->query(), $request->all());
        if (isset($in['location']) && is_array($in['location'])) { // format JSON Traccar Client
            $c = $in['location']['coords'] ?? [];
            $in = ['lat' => $c['latitude'] ?? null, 'lon' => $c['longitude'] ?? null, 'accuracy' => $c['accuracy'] ?? null,
                'speed_ms' => $c['speed'] ?? null, 'bearing' => $c['heading'] ?? null, 'batt' => isset($in['location']['battery']['level']) ? $in['location']['battery']['level'] * 100 : null];
        }
        if (isset($in['_type']) && $in['_type'] !== 'location') {
            return response()->json([]); // OwnTracks mengirim jenis pesan lain (waypoint, lwt, dll.)
        }

        $lat = $in['lat'] ?? null;
        $lng = $in['lon'] ?? ($in['lng'] ?? null);
        if (!is_numeric($lat) || !is_numeric($lng) || abs((float) $lat) > 90 || abs((float) $lng) > 180) {
            return response()->json(['status' => 'error', 'message' => 'Koordinat tidak valid.'], 422);
        }
        $speed = null; // m/s
        if (isset($in['speed_ms']) && is_numeric($in['speed_ms'])) {
            $speed = (float) $in['speed_ms'];
        } elseif (isset($in['vel']) && is_numeric($in['vel'])) { // OwnTracks: km/jam
            $speed = (float) $in['vel'] / 3.6;
        } elseif (isset($in['speed']) && is_numeric($in['speed'])) { // Traccar/OsmAnd: knot
            $speed = (float) $in['speed'] * 0.514444;
        }
        $heading = $in['cog'] ?? ($in['bearing'] ?? ($in['heading'] ?? null));
        $acc = $in['acc'] ?? ($in['accuracy'] ?? null);
        $batt = $in['batt'] ?? null;

        DB::table('erp_courier_trackers')->where('id', $tracker->id)->update([
            'last_ping_at' => now(), 'last_lat' => $lat, 'last_lng' => $lng,
            'battery' => is_numeric($batt) ? max(0, min(100, (int) round($batt))) : null,
        ]);

        ErpPickup::where('courier_user_id', $tracker->user_id)->where('status', ErpPickup::ON_THE_WAY)->get()
            ->each(fn ($p) => $this->storeLocation($p, (float) $lat, (float) $lng,
                is_numeric($acc) ? (float) $acc : null, $speed, is_numeric($heading) ? (float) $heading : null));

        return response()->json([]); // OwnTracks mengharapkan array JSON
    }

    private function storeLocation(ErpPickup $pickup, float $lat, float $lng, $acc, $speed, $heading): void
    {
        $prev = $pickup->last_seen_at;
        $pickup->update([
            'last_lat' => $lat, 'last_lng' => $lng, 'last_accuracy' => $acc,
            'last_speed' => $speed, 'last_heading' => $heading, 'last_seen_at' => now(),
        ]);
        if (!$prev || $prev->diffInSeconds(now(), true) >= self::MIN_TRACK_INTERVAL_SECONDS) {
            ErpPickupLocation::create([
                'pickup_id' => $pickup->id, 'lat' => $lat, 'lng' => $lng,
                'accuracy' => $acc, 'speed' => $speed, 'recorded_at' => now(),
            ]);
        }
    }

    // ------------------------------------------------------------- helper

    private function present(ErpPickup $p): array
    {
        return [
            'id' => $p->id, 'pickup_no' => $p->pickup_no, 'status' => $p->status,
            'courier_user_id' => $p->courier_user_id, 'courier_name' => $p->courier_name,
            'vehicle_type' => $p->vehicle_type, 'vehicle_plate' => $p->vehicle_plate,
            'destination' => $p->destination, 'dest_lat' => $p->dest_lat, 'dest_lng' => $p->dest_lng,
            'customer_name' => $p->customer_name, 'customer_phone' => $p->customer_phone,
            'notes' => $p->notes, 'sender_name' => $p->sender_name,
            'estimated_total_idr' => $p->estimated_total_idr, 'realized_total_idr' => $p->realized_total_idr,
            'photo_pickup' => $p->photo_pickup, 'photo_proof' => $p->photo_proof, 'recipient_name' => $p->recipient_name,
            'settle_to' => $p->settle_to, 'invoice_no' => $p->invoice_no, 'cancel_reason' => $p->cancel_reason,
            'pin_locked' => $p->pin_attempts >= self::MAX_PIN_ATTEMPTS,
            'created_at' => optional($p->created_at)->toIso8601String(),
            'picked_up_at' => optional($p->picked_up_at)->toIso8601String(),
            'delivered_at' => optional($p->delivered_at)->toIso8601String(),
            'completed_at' => optional($p->completed_at)->toIso8601String(),
            'cancelled_at' => optional($p->cancelled_at)->toIso8601String(),
            'last' => $p->last_lat !== null ? [
                'lat' => $p->last_lat, 'lng' => $p->last_lng, 'accuracy' => $p->last_accuracy,
                'speed' => $p->last_speed, 'heading' => $p->last_heading,
                'at' => optional($p->last_seen_at)->toIso8601String(),
            ] : null,
            'items' => $p->items->map(fn ($i) => [
                'id' => $i->id, 'currency_code' => $i->currency_code, 'amount' => $i->amount,
                'estimated_rate' => $i->estimated_rate, 'estimated_total' => $i->estimated_total,
                'realized_rate' => $i->realized_rate, 'realized_total' => $i->realized_total,
            ])->all(),
        ];
    }

    private function applyRealizedRates(ErpPickup $p, array $rates): void
    {
        $p->loadMissing('items');
        $sum = 0.0;
        foreach ($p->items as $it) {
            $rate = (float) ($rates[$it->id] ?? $rates[$it->currency_code] ?? ($it->realized_rate ?: $it->estimated_rate));
            $it->update(['realized_rate' => $rate, 'realized_total' => round((float) $it->amount * $rate, 2)]);
            $sum += round((float) $it->amount * $rate, 2);
        }
        $p->update(['realized_total_idr' => $sum]);
    }

    private function guardCurrencyStock(string $code, float $qty): void
    {
        $cur = Currency::find($code);
        if (!$cur || (float) $cur->stock + 0.00001 < $qty) {
            throw new RuntimeException("Stok $code tidak cukup untuk dibawa kurir.");
        }
    }

    /** Sinkronkan stok yang terlihat di POS (mc_currencies.stock) dengan stok yang dibawa kurir. */
    private function adjustCurrency(string $code, float $delta): void
    {
        $cur = Currency::whereKey($code)->lockForUpdate()->first();
        if (!$cur) {
            return;
        }
        $new = round((float) $cur->stock + $delta, 4);
        if ($new < 0) {
            throw new RuntimeException("Stok $code tidak cukup.");
        }
        $raw = json_decode((string) $cur->raw_json, true);
        if (is_array($raw)) {
            $raw['stock'] = $new;
            $cur->raw_json = json_encode($raw);
        }
        $cur->stock = $new;
        $cur->save();
    }

    private function event(ErpPickup $p, string $status, ?string $actor, ?string $note = null, $lat = null, $lng = null): void
    {
        ErpPickupEvent::create([
            'pickup_id' => $p->id, 'status' => $status, 'actor_name' => $actor,
            'note' => $note ? Str::limit($note, 250, '') : null, 'lat' => $lat, 'lng' => $lng, 'created_at' => now(),
        ]);
    }

    private function mustBe(ErpPickup $p, array $allowed, string $message): void
    {
        if (!in_array($p->status, $allowed, true)) {
            throw new RuntimeException($message);
        }
    }

    private function actorName(Request $request): string
    {
        $u = $request->user();

        return (string) ($u->full_name ?? $u->username ?? 'User');
    }

    private function isCourier(Request $request): bool
    {
        return strtolower((string) ($request->user()->role ?? '')) === 'kurir';
    }

    private function requireStaff(Request $request): void
    {
        abort_if($this->isCourier($request), 403, 'Aksi ini hanya untuk staf.');
    }

    private function authorizeAccess(Request $request, ErpPickup $pickup): void
    {
        if ($this->isCourier($request)) {
            abort_unless((string) $pickup->courier_user_id === (string) $request->user()->id, 403, 'Pickup ini bukan penugasan Anda.');
        }
    }

    private function ok($data, int $code = 200): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $data], $code);
    }

    private function fail(string $message, int $code): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => $message], $code);
    }
}
