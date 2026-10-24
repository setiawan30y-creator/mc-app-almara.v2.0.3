<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\PtRepresentative;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Perwakilan PT (data internal PKS). Akses dibatasi di routes/api.php. */
class PtRepresentativeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = PtRepresentative::query()->orderBy('customer_id')->orderBy('role_type')->orderBy('name');
        if ($request->filled('customer_id')) {
            $q->where('customer_id', (string) $request->query('customer_id'));
        }
        return response()->json(['status' => 'success', 'data' => $q->get()->map(fn ($r) => $this->present($r))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $data['updated_by'] = $this->actor($request);
        $row = PtRepresentative::create($data);
        return response()->json(['status' => 'success', 'data' => $this->present($row)], 201);
    }

    public function update(Request $request, PtRepresentative $representative): JsonResponse
    {
        $data = $this->validated($request);
        unset($data['customer_id']); // perwakilan tidak dipindah antar-PT
        $data['updated_by'] = $this->actor($request);
        $representative->update($data);
        return response()->json(['status' => 'success', 'data' => $this->present($representative->fresh())]);
    }

    public function destroy(PtRepresentative $representative): JsonResponse
    {
        $representative->delete();
        return response()->json(['status' => 'success']);
    }

    private function validated(Request $request): array
    {
        $url = ['nullable', 'string', 'max:500', 'regex:#^/uploads/[A-Za-z0-9._/-]+$#'];
        $data = $request->validate([
            'customer_id' => ['required', 'string', 'max:100'],
            'role_type' => ['required', Rule::in(['signatory', 'executor', 'courier', 'other'])],
            'name' => ['required', 'string', 'max:150'],
            'position' => ['nullable', 'string', 'max:120'],
            'id_type' => ['required', Rule::in(['KTP', 'SIM', 'PASSPORT', 'LAINNYA'])],
            'id_number' => ['required', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'authority_ref' => ['nullable', 'string', 'max:150'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'photo_url' => $url,
            'id_photo_url' => $url,
            'authority_doc_url' => $url,
            'notes' => ['nullable', 'string', 'max:1000'],
        ], ['valid_until.after_or_equal' => 'Masa berlaku akhir tidak boleh sebelum tanggal mulai.']);
        $data['name'] = trim($data['name']);
        $data['id_number'] = trim($data['id_number']);
        return $data;
    }

    private function actor(Request $request): string
    {
        $u = $request->user();
        return (string) ($u?->username ?? $u?->name ?? '');
    }

    private function present(PtRepresentative $r): array
    {
        return [
            'id' => $r->id,
            'customer_id' => $r->customer_id,
            'role_type' => $r->role_type,
            'name' => $r->name,
            'position' => $r->position,
            'id_type' => $r->id_type,
            'id_number' => $r->id_number,
            'phone' => $r->phone,
            'address' => $r->address,
            'authority_ref' => $r->authority_ref,
            'valid_from' => $r->valid_from?->format('Y-m-d'),
            'valid_until' => $r->valid_until?->format('Y-m-d'),
            'status' => $r->status,
            'photo_url' => $r->photo_url,
            'id_photo_url' => $r->id_photo_url,
            'authority_doc_url' => $r->authority_doc_url,
            'notes' => $r->notes,
            'updated_by' => $r->updated_by,
            'updated_at' => optional($r->updated_at)->toIso8601String(),
        ];
    }
}
