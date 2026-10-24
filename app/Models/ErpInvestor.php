<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Penanam saham. Modal disetor = total SETOR - total TARIK dari riwayat modal.
 * Hak persentase hanya dihitung untuk investor berstatus AKTIF (total maksimal 100%).
 */
class ErpInvestor extends Model
{
    public const STATUS_ACTIVE = 'AKTIF';
    public const STATUS_INACTIVE = 'NONAKTIF';
    public const STATUS_EXITED = 'KELUAR';
    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_EXITED];
    public const TYPES = ['PERORANGAN', 'BADAN_USAHA'];

    protected $table = 'erp_investors';

    protected $fillable = [
        'code', 'name', 'type', 'id_number', 'phone', 'email', 'address', 'join_date', 'status',
        'share_percent', 'notes', 'created_by_name', 'updated_by_name',
    ];

    protected $casts = [
        'join_date' => 'date',
        'share_percent' => 'decimal:4',
    ];

    public function movements(): HasMany
    {
        return $this->hasMany(ErpInvestorCapitalMovement::class, 'investor_id')->orderByDesc('occurred_on')->orderByDesc('id');
    }

    public function capitalIn(): float
    {
        return (float) $this->movements->where('type', ErpInvestorCapitalMovement::TYPE_IN)->sum('amount');
    }

    public function capitalOut(): float
    {
        return (float) $this->movements->where('type', ErpInvestorCapitalMovement::TYPE_OUT)->sum('amount');
    }

    public function capital(): float
    {
        return round($this->capitalIn() - $this->capitalOut(), 2);
    }
}
