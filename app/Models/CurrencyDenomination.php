<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CurrencyDenomination extends Model
{
    use HasFactory;

    protected $table = 'mc_currency_denominations';

    protected $fillable = [
        'currency_code',
        'denomination',
        'type',
        'buy',
        'sell',
        'margin_buy',
        'margin_sell',
        'stock',
        'alert_stock',
        'is_active',
    ];

    protected $casts = [
        'denomination' => 'decimal:4',
        'buy' => 'decimal:4',
        'sell' => 'decimal:4',
        'margin_buy' => 'decimal:4',
        'margin_sell' => 'decimal:4',
        'stock' => 'decimal:4',
        'alert_stock' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }
}
