<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpCashAccount extends Model
{
    protected $table = 'erp_cash_accounts';

    protected $fillable = ['code', 'name', 'currency_code', 'opening_balance', 'is_active'];

    protected $casts = [
        'opening_balance' => 'decimal:8',
        'is_active' => 'boolean',
    ];

    public function movements(): HasMany
    {
        return $this->hasMany(ErpCashMovement::class, 'cash_account_id');
    }
}
