<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpPickup extends Model
{
    public const REQUESTED = 'REQUESTED';
    public const ON_THE_WAY = 'ON_THE_WAY';
    public const DELIVERED = 'DELIVERED';
    public const COMPLETED = 'COMPLETED';
    public const CANCELLED = 'CANCELLED';
    public const RETURNED = 'RETURNED';

    public const ACTIVE = [self::REQUESTED, self::ON_THE_WAY, self::DELIVERED];
    public const HISTORY = [self::COMPLETED, self::CANCELLED, self::RETURNED];
    /** Status saat valas masih dipegang kurir (sudah keluar dari brankas, belum menjadi penjualan). */
    public const IN_CUSTODY = [self::ON_THE_WAY, self::DELIVERED];

    protected $table = 'erp_pickups';

    protected $guarded = ['id'];

    protected $hidden = ['pin_hash'];

    protected $casts = [
        'dest_lat' => 'float', 'dest_lng' => 'float',
        'last_lat' => 'float', 'last_lng' => 'float',
        'last_accuracy' => 'float', 'last_speed' => 'float', 'last_heading' => 'float',
        'estimated_total_idr' => 'float', 'realized_total_idr' => 'float',
        'picked_up_at' => 'datetime', 'delivered_at' => 'datetime', 'completed_at' => 'datetime',
        'cancelled_at' => 'datetime', 'last_seen_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(ErpPickupItem::class, 'pickup_id')->orderBy('id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ErpPickupEvent::class, 'pickup_id')->orderBy('id');
    }

    public function locations(): HasMany
    {
        return $this->hasMany(ErpPickupLocation::class, 'pickup_id')->orderBy('recorded_at');
    }
}
