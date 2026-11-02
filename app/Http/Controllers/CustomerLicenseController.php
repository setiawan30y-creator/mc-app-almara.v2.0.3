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
        $data = $this->validated($request);
        unset($data['customer_id']); // izin tidak dipindah antar-nasabah
        $data['updated_by'] = $this->actor($request);
        $license->update($data);

        return response()->json(['status' => 'success', 'data' => $this->present($license->fresh(), $this->remindDays())]);
    }

    public function destroy(CustomerLicense $license): JsonResponse
    {
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
            'today' => now()->format('Y-m-d'),
            'expired' => $items->where('state', 'expired')->count(),
            'soon' => $items->where('state', 'soon')->count(),
            'data' => $items,
        ]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'remind_days' => ['required', 'integer', Rule::in(self::REMIND_OPTIONS)],
        ]);
        Datastore::updateOrCreate(['store_key' => self::SETTINGS_KEY], ['json_data' => ['remind_days' => (int) $data['remind_days']]]);

        return response()->json(['status' => 'success', 'remind_days' => (int) $data['remind_days']]);
    }

    public function remindDays(): int
    {
        try {
            $row = Datastore::query()->find(self::SETTINGS_KEY);
            $v = $row ? $row->json_data : null;
            if (is_string($v)) {
                $v = json_decode($v, true);
            }
            $days = is_array($v) ? (int) ($v['remind_days'] ?? 0) : 0;
        } catch (\Throwable $e) {
            $days = 0;
        }

        return in_array($days, self::REMIND_OPTIONS, true) ? $days : self::DEFAULT_REMIND;
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
            'license_type' => ['required', Rule::in(array_keys(CustomerLicense::TYPES))],
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
