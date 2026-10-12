<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpCurrencyStockMovement extends Model
{
    protected $table = 'erp_currency_stock_movements';

    protected $fillable = [
        'movement_ref', 'currency_stock_id', 'transaction_ref', 'movement_type',
        'quantity', 'balance_after', 'currency_code', 'idempotency_key', 'metadata', 'posted_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:8',
        'balance_after' => 'decimal:8',
        'metadata' => 'array',
        'posted_at' => 'datetime',
    ];

    public function stock(): BelongsTo
    {
        return $this->belongsTo(ErpCurrencyStock::class, 'currency_stock_id');
    }
}
