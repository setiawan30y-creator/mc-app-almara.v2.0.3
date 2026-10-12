<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpCashClosing extends Model
{
    protected $table = 'erp_cash_closings';

    protected $fillable = [
        'closing_no', 'closing_date', 'opening_cash', 'cash_in', 'cash_out', 'expense',
        'expected_cash', 'physical_cash', 'hanging_amount', 'accounted_cash', 'difference',
        'status', 'notes', 'closed_by', 'closed_at', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'closing_date' => 'date',
        'opening_cash' => 'decimal:2',
        'cash_in' => 'decimal:2',
        'cash_out' => 'decimal:2',
        'expense' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'physical_cash' => 'decimal:2',
        'hanging_amount' => 'decimal:2',
        'accounted_cash' => 'decimal:2',
        'closed_at' => 'datetime',
    ];

    public function denominations(): HasMany
    {
        return $this->hasMany(ErpCashClosingDenomination::class, 'closing_id');
    }
}
