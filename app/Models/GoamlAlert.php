<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoamlAlert extends Model
{
    protected $table = 'goaml_alerts';

    protected $fillable = [
        'rule_id','alert_no','rule_type','result_type','classification','severity','status',
        'customer_id','customer_name','total_amount_idr','transaction_count','invoice_summary',
        'period_start','period_end','reason','snapshot','reviewed_by',
        'reviewed_at','review_note',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'total_amount_idr' => 'decimal:2',
        'period_start' => 'datetime',
        'period_end' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function rule()
    {
        return $this->belongsTo(GoamlRule::class, 'rule_id');
    }

    public function transactions()
    {
        return $this->hasMany(GoamlAlertTransaction::class, 'alert_id');
    }
}
