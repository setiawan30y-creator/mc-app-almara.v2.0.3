<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErpGantungan extends Model
{
    protected $table = 'erp_gantungan';

    protected $fillable = [
        'reference_no', 'occurred_at', 'recipient', 'type', 'amount_rp', 'status',
        'description', 'returned_at', 'returned_by', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'amount_rp' => 'decimal:2',
        'returned_at' => 'datetime',
    ];

    public function scopeOutstanding($query)
    {
        return $query->where('status', 'OUTSTANDING');
    }
}
