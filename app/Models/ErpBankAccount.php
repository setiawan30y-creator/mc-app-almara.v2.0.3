<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpBankAccount extends Model
{
    protected $table = 'erp_bank_accounts';

    protected $fillable = ['code', 'bank_name', 'account_name', 'account_number', 'currency_code', 'opening_balance', 'is_active'];

    protected $casts = [
        'opening_balance' => 'decimal:8',
        'is_active' => 'boolean',
    ];

    public function movements(): HasMany
    {
        return $this->hasMany(ErpBankMovement::class, 'bank_account_id');
    }
}
