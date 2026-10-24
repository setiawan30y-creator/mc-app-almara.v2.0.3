<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpInvestorCapitalMovement extends Model
{
    public const TYPE_IN = 'SETOR';
    public const TYPE_OUT = 'TARIK';

    protected $table = 'erp_investor_capital_movements';

    protected $fillable = ['investor_id', 'type', 'amount', 'occurred_on', 'note', 'created_by_name'];

    protected $casts = [
        'amount' => 'decimal:2',
        'occurred_on' => 'date',
    ];

    public function investor(): BelongsTo
    {
        return $this->belongsTo(ErpInvestor::class, 'investor_id');
    }
}
