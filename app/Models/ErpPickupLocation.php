<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErpPickupLocation extends Model
{
    public $timestamps = false;

    protected $table = 'erp_pickup_locations';

    protected $guarded = ['id'];

    protected $casts = ['lat' => 'float', 'lng' => 'float', 'accuracy' => 'float', 'speed' => 'float', 'recorded_at' => 'datetime'];
}
