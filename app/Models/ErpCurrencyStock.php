<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpCurrencyStock extends Model
{
    protected $table = 'erp_currency_stocks';

    protected $fillable = ['currency_code', 'quantity', 'status'];

    protected $casts = ['quantity' => 'decimal:8'];

    public function movements(): HasMany
    {
        return $this->hasMany(ErpCurrencyStockMovement::class, 'currency_stock_id');
    }
}
