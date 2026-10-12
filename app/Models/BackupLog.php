<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupLog extends Model
{
    protected $table = 'mc_backup_logs';

    protected $fillable = [
        'filename',
        'type',
        'scope',
        'size_bytes',
        'checksum',
        'status',
        'started_at',
        'completed_at',
        'created_by',
        'error_message',
        'metadata',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'metadata' => 'array',
    ];
}
