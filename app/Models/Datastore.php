<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Datastore extends Model
{
    use HasFactory;

    protected $table = 'mc_datastore';
    protected $primaryKey = 'store_key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'store_key', 'json_data'
    ];

    protected $casts = [
        'json_data' => 'array'
    ];
}
