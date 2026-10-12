<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpSettlement extends Model
{
    protected $table = 'erp_settlements';

    protected $fillable = [
        'settlement_ref', 'transaction_ref', 'status', 'settled_at', 'settled_by', 'notes',
    ];

    protected $casts = ['settled_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by');
    }
}
