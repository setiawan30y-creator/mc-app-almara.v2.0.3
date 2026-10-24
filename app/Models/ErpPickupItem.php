<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErpPickupItem extends Model
{
    protected $table = 'erp_pickup_items';

    protected $guarded = ['id'];

    protected $casts = [
        'amount' => 'float', 'estimated_rate' => 'float', 'estimated_total' => 'float',
        'realized_rate' => 'float', 'realized_total' => 'float',
    ];
}
