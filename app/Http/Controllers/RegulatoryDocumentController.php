<?php

namespace App\Http\Controllers;

use App\Models\RegulatoryDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class RegulatoryDocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = RegulatoryDocument::query()
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = trim($request->input('q', ''));
                $query->where(function ($subquery) use ($term) {
                    $subquery->where('title', 'like', "%{$term}%")
                        ->orWhere('original_name', 'like', "%{$term}%")
                        ->orWhere('regulation_number', 'like', "%{$term}%");
                });
            })
            ->when($request->filled('status'), function ($query) use ($request) {
                $query->where('status', $request->input('status'));
            })
            ->latest();

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:20480',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,zip,xml,json,html'],
            'title' => ['nullable', 'string', 'max:255'],
            'regulation_number' => ['nullable', 'string', 'max:150'],
            'effective_date' => ['nullable', 'date'],
        ]);

        $file = $request->file('file');
        $originalName = basename($file->getClientOriginalName());
        $extension = strtolower($file->getClientOriginalExtension());
        $storedName = Str::uuid()->toString() . '.' . $extension;
        $path = $file->storeAs('regulatory-documents', $storedName, 'local');

        if (!$path) {
            return response()->json(['message' => 'File gagal disimpan.'], 500);
        }

        try {
            $document = RegulatoryDocument::create([
                'title' => $validated['title'] ?? $originalName,
                'original_name' => $originalName,
                'storage_path' => $path,
                'mime_type' => $file->getMimeType(),
                'extension' => $extension,
                'size_bytes' => $file->getSize(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
                'regulation_number' => $validated['regulation_number'] ?? null,
                'effective_date' => $validated['effective_date'] ?? null,
                'status' => 'pending',
                'uploaded_by' => $request->user()?->getAuthIdentifier(),
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        return response()->json([
            'message' => 'Dokumen tersimpan. Ekstraksi belum dijalankan.',
            'document' => $document,
        ], 201);
    }

    public function show(RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        return response()->json(['document' => $regulatoryDocument]);
    }

    public function destroy(RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        Storage::disk('local')->delete($regulatoryDocument->storage_path);
        $regulatoryDocument->delete();

        return response()->json(['message' => 'Dokumen berhasil dihapus.']);
    }
}
