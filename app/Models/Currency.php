<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Currency extends Model
{
    use HasFactory;

    protected $table = 'mc_currencies';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'code', 'label', 'buy', 'sell', 'stock', 'raw_json'
    ];

    public function denominations(): HasMany
    {
        return $this->hasMany(CurrencyDenomination::class, 'currency_code', 'code')
            ->orderBy('denomination');
    }
}
