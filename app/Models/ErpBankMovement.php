<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpBankMovement extends Model
{
    protected $table = 'erp_bank_movements';

    protected $fillable = [
        'bank_account_id', 'movement_no', 'direction', 'amount', 'currency_code',
        'reference_type', 'reference_id', 'bank_reference', 'description', 'posted_at', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:8',
        'posted_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(ErpBankAccount::class, 'bank_account_id');
    }
}
