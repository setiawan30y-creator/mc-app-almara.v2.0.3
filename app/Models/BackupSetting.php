<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupSetting extends Model
{
    protected $table = 'mc_backup_settings';

    protected $fillable = [
        'enabled',
        'frequency',
        'run_at',
        'retention_days',
        'scope',
        'timezone',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'retention_days' => 'integer',
    ];
}
