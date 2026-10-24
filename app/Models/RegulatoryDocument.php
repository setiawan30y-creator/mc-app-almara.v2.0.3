<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegulatoryDocument extends Model
{
    protected $table = 'mc_regulatory_documents';

    protected $fillable = [
        'title', 'issuer', 'doc_type', 'original_name', 'storage_path', 'mime_type',
        'extension', 'size_bytes', 'sha256', 'regulation_number',
        'effective_date', 'validity', 'source_url', 'notes', 'status', 'extracted_text',
        'chunk_count', 'extracted_at',
        'source_metadata', 'processing_error', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date:Y-m-d',
            'source_metadata' => 'array',
            'size_bytes' => 'integer',
            'chunk_count' => 'integer',
            'extracted_at' => 'datetime',
        ];
    }
}
