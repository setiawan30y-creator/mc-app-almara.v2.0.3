<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErpPickupEvent extends Model
{
    public $timestamps = false;

    protected $table = 'erp_pickup_events';

    protected $guarded = ['id'];

    protected $casts = ['lat' => 'float', 'lng' => 'float', 'created_at' => 'datetime'];
}
