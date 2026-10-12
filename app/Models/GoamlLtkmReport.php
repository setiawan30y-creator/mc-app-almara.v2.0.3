<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoamlLtkmReport extends Model
{
    protected $table = 'goaml_ltkm_reports';

    protected $fillable = [
        'alert_id',
        'report_no',
        'status',
        'customer_id',
        'customer_name',
        'total_amount_idr',
        'transaction_count',
        'period_start',
        'period_end',
        'snapshot',
        'review_note',
        'created_by',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'total_amount_idr' => 'decimal:2',
        'period_start' => 'datetime',
        'period_end' => 'datetime',
        'snapshot' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function alert(): BelongsTo
    {
        return $this->belongsTo(GoamlAlert::class, 'alert_id');
    }
}