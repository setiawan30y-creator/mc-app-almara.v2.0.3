<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoamlRule extends Model
{
    protected $table = 'goaml_rules';

    protected $fillable = [
        'name','code','rule_type','regulation_source','regulation_no','regulation_article',
        'effective_from','effective_until','target','classification','severity','action','result_type',
        'min_transactions','period_days','total_amount_idr','amount_operator',
        'payment_method','conditions','internal_note','is_active','priority','version',
    ];

    protected $casts = [
        'conditions' => 'array',
        'is_active' => 'boolean',
        'total_amount_idr' => 'decimal:2',
        'effective_from' => 'date',
        'effective_until' => 'date',
    ];

    public function alerts()
    {
        return $this->hasMany(GoamlAlert::class, 'rule_id');
    }
}
