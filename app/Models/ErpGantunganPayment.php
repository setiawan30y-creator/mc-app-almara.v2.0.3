<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpGantunganPayment extends Model
{
    protected $table = 'erp_gantungan_payments';

    protected $fillable = ['gantungan_id', 'paid_at', 'amount_rp', 'note', 'created_by_name'];

    protected $casts = [
        'paid_at' => 'datetime',
        'amount_rp' => 'decimal:2',
    ];

    public function gantungan(): BelongsTo
    {
        return $this->belongsTo(ErpGantungan::class, 'gantungan_id');
    }
}
