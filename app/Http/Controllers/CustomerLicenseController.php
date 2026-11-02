<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerLicense;
use App\Models\Datastore;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Perizinan nasabah perusahaan + pengingat jatuh tempo.
 * Akses per jabatan diatur di routes/api.php.
 */
class CustomerLicenseController extends Controller
{
    public const SETTINGS_KEY = 'mc_license_alert_settings';
    public const REMIND_OPTIONS = [7, 14, 30, 60, 90];
    public const DEFAULT_REMIND = 30;
    /** Popup harian berhenti setelah izin lewat H+N hari (0 = tidak berhenti). Ikon header & Kasir tetap mengingatkan. */
    public const POPUP_STOP_OPTIONS = [0, 3, 7, 14, 30];
    public const DEFAULT_POPUP_STOP = 7;

    public function index(Request $request): JsonResponse
    {
        $q = CustomerLicense::query()->orderBy('customer_id')->orderByRaw('expires_at IS NULL')->orderBy('expires_at');
        if ($request->filled('customer_id')) {
            $q->where('customer_id', (string) $request->query('customer_id'));
        }
        $remind = $this->remindDays();

        return response()->json([
            'status' => 'success',
            'remind_days' => $remind,
            'popup_stop_days' => $this->settings()['popup_stop_days'],
            'types' => CustomerLicense::TYPES,
            'data' => $q->get()->map(fn ($r) => $this->present($r, $remind))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $data['updated_by'] = $this->actor($request);
        $row = CustomerLicense::create($data);

        return response()->json(['status' => 'success', 'data' => $this->present($row, $this->remindDays())], 201);
    }

    public function update(Request $request, CustomerLicense $license): JsonResponse
    {
        if ($license->license_type === CustomerLicense::MAIN_TYPE) {
            return response()->json(['status' => 'error', 'message' => 'Dokumen legalitas utama diubah lewat form data nasabah (Tanggal Terbit & Berlaku Sampai).'], 422);
        }
        $data = $this->validated($request);
        unset($data['customer_id']); // izin tidak dipindah antar-nasabah
        $data['updated_by'] = $this->actor($request);
        $license->update($data);

        return response()->json(['status' => 'success', 'data' => $this->present($license->fresh(), $this->remindDays())]);
    }

    public function destroy(CustomerLicense $license): JsonResponse
    {
        if ($license->license_type === CustomerLicense::MAIN_TYPE) {
            return response()->json(['status' => 'error', 'message' => 'Dokumen legalitas utama dikelola lewat form data nasabah. Kosongkan "Berlaku Sampai" di sana bila tidak dipantau.'], 422);
        }
        $license->delete();

        return response()->json(['status' => 'success']);
    }

    /** Izin yang sudah kedaluwarsa atau berakhir dalam {remind_days} hari ke depan. */
    public function alerts(): JsonResponse
    {
        $remind = $this->remindDays();
        $limit = now()->startOfDay()->addDays($remind)->format('Y-m-d');
        $rows = CustomerLicense::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $limit)
            ->orderBy('expires_at')
            ->get();

        $names = Customer::query()->whereIn('internal_id', $rows->pluck('customer_id')->unique()->values())->pluck('name', 'internal_id');

        $items = $rows->map(function (CustomerLicense $r) use ($remind, $names) {
            $p = $this->present($r, $remind);
            $p['customer_name'] = $names[$r->customer_id] ?? $r->customer_id;

            return $p;
        })->values();

        return response()->json([
            'status' => 'success',
            'remind_days' => $remind,
            'popup_stop_days' => $this->settings()['popup_stop_days'],
            'today' => now()->format('Y-m-d'),
            'expired' => $items->where('state', 'expired')->count(),
            'soon' => $items->where('state', 'soon')->count(),
            'data' => $items,
        ]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'remind_days' => ['nullable', 'integer', Rule::in(self::REMIND_OPTIONS)],
            'popup_stop_days' => ['nullable', 'integer', Rule::in(self::POPUP_STOP_OPTIONS)],
        ]);
        $cur = $this->settings();
        if (isset($data['remind_days'])) {
            $cur['remind_days'] = (int) $data['remind_days'];
        }
        if (array_key_exists('popup_stop_days', $data) && $data['popup_stop_days'] !== null) {
            $cur['popup_stop_days'] = (int) $data['popup_stop_days'];
        }
        Datastore::updateOrCreate(['store_key' => self::SETTINGS_KEY], ['json_data' => $cur]);

        return response()->json(['status' => 'success'] + $cur);
    }

    public function remindDays(): int
    {
        return $this->settings()['remind_days'];
    }

    /** Pengaturan tersimpan, dengan nilai bawaan bila belum ada / tidak valid. */
    public function settings(): array
    {
        try {
            $row = Datastore::query()->find(self::SETTINGS_KEY);
            $v = $row ? $row->json_data : null;
            if (is_string($v)) {
                $v = json_decode($v, true);
            }
        } catch (\Throwable $e) {
            $v = null;
        }
        $v = is_array($v) ? $v : [];
        $remind = (int) ($v['remind_days'] ?? 0);
        $stop = array_key_exists('popup_stop_days', $v) ? (int) $v['popup_stop_days'] : self::DEFAULT_POPUP_STOP;

        return [
            'remind_days' => in_array($remind, self::REMIND_OPTIONS, true) ? $remind : self::DEFAULT_REMIND,
            'popup_stop_days' => in_array($stop, self::POPUP_STOP_OPTIONS, true) ? $stop : self::DEFAULT_POPUP_STOP,
        ];
    }

    /** Status: none (tanpa batas), ok (berlaku), soon (segera habis), expired (kedaluwarsa). */
    public static function stateOf(?string $expiresAt, int $remindDays, ?Carbon $today = null): array
    {
        if (!$expiresAt) {
            return ['state' => 'none', 'days_left' => null];
        }
        $today = ($today ?? now())->copy()->startOfDay();
        $exp = Carbon::parse($expiresAt)->startOfDay();
        $days = (int) $today->diffInDays($exp, false);
        if ($days < 0) {
            return ['state' => 'expired', 'days_left' => $days];
        }

        return ['state' => $days <= $remindDays ? 'soon' : 'ok', 'days_left' => $days];
    }

    private function present(CustomerLicense $r, int $remind): array
    {
        $exp = $r->expires_at?->format('Y-m-d');

        return array_merge([
            'id' => $r->id,
            'customer_id' => $r->customer_id,
            'license_type' => $r->license_type,
            'license_name' => $r->license_name,
            'label' => $r->label(),
            'from_customer_form' => $r->license_type === CustomerLicense::MAIN_TYPE,
            'number' => $r->number,
            'issued_at' => $r->issued_at?->format('Y-m-d'),
            'expires_at' => $exp,
            'document_url' => $r->document_url,
            'notes' => $r->notes,
            'updated_by' => $r->updated_by,
            'updated_at' => $r->updated_at?->format('Y-m-d H:i'),
        ], self::stateOf($exp, $remind));
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'customer_id' => ['required', 'string', 'max:100'],
            'license_type' => ['required', Rule::in(array_values(array_diff(array_keys(CustomerLicense::TYPES), [CustomerLicense::MAIN_TYPE])))],
            'license_name' => ['nullable', 'string', 'max:150', 'required_if:license_type,LAINNYA'],
            'number' => ['nullable', 'string', 'max:100'],
            'issued_at' => ['nullable', 'date_format:Y-m-d'],
            'expires_at' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:issued_at'],
            'document_url' => ['nullable', 'string', 'max:500', 'regex:#^/uploads/[A-Za-z0-9._/-]+$#'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'license_name.required_if' => 'Isi nama izin untuk jenis "Lainnya".',
            'expires_at.after_or_equal' => 'Tanggal berakhir tidak boleh sebelum tanggal terbit.',
        ]);
        foreach (['license_name', 'number', 'notes'] as $k) {
            if (isset($data[$k])) {
                $data[$k] = trim((string) $data[$k]) ?: null;
            }
        }

        return $data;
    }

    private function actor(Request $request): string
    {
        $u = $request->user();

        return (string) ($u?->username ?? $u?->name ?? '');
    }
}
