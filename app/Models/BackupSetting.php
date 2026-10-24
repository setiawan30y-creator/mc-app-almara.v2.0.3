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
        'storage_path',
        'secondary_path',
        'include_uploads',
        'keep_min_backups',
        'alert_after_hours',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'retention_days' => 'integer',
        'include_uploads' => 'boolean',
        'keep_min_backups' => 'integer',
        'alert_after_hours' => 'integer',
    ];
}
