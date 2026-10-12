<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegulatoryDocument extends Model
{
    protected $table = 'mc_regulatory_documents';

    protected $fillable = [
        'title', 'original_name', 'storage_path', 'mime_type',
        'extension', 'size_bytes', 'sha256', 'regulation_number',
        'effective_date', 'status', 'extracted_text',
        'source_metadata', 'processing_error', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date',
            'source_metadata' => 'array',
            'size_bytes' => 'integer',
        ];
    }
}
