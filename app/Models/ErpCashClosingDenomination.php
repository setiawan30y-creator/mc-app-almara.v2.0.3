<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpCashClosingDenomination extends Model
{
    protected $table = 'erp_cash_closing_denominations';

    protected $fillable = [
        'closing_id',
        'currency_code',
        'denomination',
        'quantity',
        'amount',
    ];

    protected $casts = [
        'denomination' => 'integer',
        'quantity' => 'integer',
        'amount' => 'decimal:2',
    ];

    public function closing(): BelongsTo
    {
        return $this->belongsTo(ErpCashClosing::class, 'closing_id');
    }
}
