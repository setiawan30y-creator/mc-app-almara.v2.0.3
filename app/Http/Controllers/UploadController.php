<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'category' => ['required', 'string', 'max:100'],
            'data_url' => ['required', 'string'],
            'filename' => ['nullable', 'string', 'max:180'],
            'overwrite' => ['nullable', 'boolean'],
            'replace_url' => ['nullable', 'string', 'max:500'],
        ]);

        $folders = [
            'customers/photos' => 'customers/photos',
            'hris/photos' => 'hris/photos',
            'hris/documents' => 'hris/documents',
            'users/photos' => 'users/photos',
            'old-money/items' => 'old-money/items',
            'old-money/suppliers' => 'old-money/suppliers',
            'transactions/proofs' => 'transactions/proofs',
            'transactions/underlying' => 'transactions/underlying',
            'pickups/proofs' => 'pickups/proofs',
            'company/documents' => 'company/documents',
        ];

        $category = $validated['category'];
        if (!isset($folders[$category])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kategori upload tidak dikenal',
            ], 422);
        }

        $dataUrl = $validated['data_url'];
        if (!preg_match('/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i', $dataUrl, $matches)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Format file upload tidak valid',
            ], 422);
        }

        $mime = strtolower($matches[1]);
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'application/pdf' => 'pdf',
            'application/x-rar-compressed' => 'rar',
            'application/x-rar' => 'rar',
            'application/rar' => 'rar',
            'application/zip' => 'zip',
            'application/x-zip-compressed' => 'zip',
            'text/plain' => 'txt',
            
            // Microsoft Office
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/vnd.ms-powerpoint' => 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        ];

        if (!isset($extensions[$mime])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tipe file tidak didukung',
            ], 422);
        }

        $binary = base64_decode($matches[2], true);
        if ($binary === false) {
            return response()->json([
                'status' => 'error',
                'message' => 'File upload gagal dibaca',
            ], 422);
        }

        if (strlen($binary) > 10 * 1024 * 1024) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ukuran file terlalu besar. Maksimal 10 MB.',
            ], 413);
        }

        try {
            $directory = public_path('uploads/' . $folders[$category]);
            if (!File::exists($directory)) {
                if (!File::makeDirectory($directory, 0755, true)) {
                    throw new \Exception("Gagal membuat direktori: " . $directory);
                }
            }

            $originalName = pathinfo($validated['filename'] ?? 'upload', PATHINFO_FILENAME);
            $safeName = Str::slug($originalName) ?: 'upload';
            $overwrite = (bool) ($validated['overwrite'] ?? false);
            $filename = $overwrite
                ? $safeName . '.' . $extensions[$mime]
                : $safeName . '-' . now()->format('YmdHis') . '-' . Str::random(6) . '.' . $extensions[$mime];

            $replaceUrl = $validated['replace_url'] ?? '';
            if ($replaceUrl) {
                $replacePath = parse_url($replaceUrl, PHP_URL_PATH) ?: '';
                $expectedPrefix = '/uploads/' . $folders[$category] . '/';
                if (Str::startsWith($replacePath, $expectedPrefix)) {
                    $oldFile = public_path(ltrim($replacePath, '/'));
                    if (File::exists($oldFile)) {
                        File::delete($oldFile);
                    }
                }
            }

            if (File::put($directory . DIRECTORY_SEPARATOR . $filename, $binary) === false) {
                throw new \Exception("Gagal menulis file: " . $filename);
            }

            $url = '/uploads/' . $folders[$category] . '/' . $filename;
            if ($overwrite) {
                $url .= '?v=' . now()->timestamp;
            }

            return response()->json([
                'status' => 'success',
                'message' => 'File berhasil diupload',
                'url' => $url,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal mengunggah file ke server. Silakan periksa hak akses tulis (write permission) pada folder public/uploads di server Anda. Detail: ' . $e->getMessage(),
            ], 500);
        }
    }
}
