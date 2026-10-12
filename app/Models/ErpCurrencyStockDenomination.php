<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpCurrencyStockDenomination extends Model
{
    protected $table = 'erp_currency_stock_denominations';

    protected $fillable = [
        'currency_stock_id', 'currency_code', 'denomination',
        'quantity', 'balance_value', 'status',
    ];

    protected $casts = [
        'denomination' => 'decimal:8',
        'quantity' => 'decimal:8',
        'balance_value' => 'decimal:8',
    ];

    public function stock(): BelongsTo
    {
        return $this->belongsTo(ErpCurrencyStock::class, 'currency_stock_id');
    }
}
