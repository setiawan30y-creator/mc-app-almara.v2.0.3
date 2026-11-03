<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Berkas yang diindeks untuk Pencarian Dokumen (Penyimpanan Berkas / arsip Nomor Surat). */
class SearchFile extends Model
{
    protected $table = 'mc_search_files';

    protected $fillable = [
        'source', 'source_key', 'title', 'subtitle', 'file_url', 'extension', 'size_bytes', 'file_sig',
        'doc_date', 'meta', 'status', 'method', 'error', 'chunk_count', 'indexed_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'doc_date' => 'date:Y-m-d',
        'indexed_at' => 'datetime',
        'size_bytes' => 'integer',
        'chunk_count' => 'integer',
    ];
}
