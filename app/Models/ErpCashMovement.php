<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpCashMovement extends Model
{
    protected $table = 'erp_cash_movements';

    protected $fillable = [
        'cash_account_id', 'movement_no', 'direction', 'amount', 'currency_code',
        'reference_type', 'reference_id', 'description', 'posted_at', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:8',
        'posted_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(ErpCashAccount::class, 'cash_account_id');
    }
}
