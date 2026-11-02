<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Satu catatan kurs beli/jual satu valuta pada satu waktu (riwayat untuk audit BI). */
class RateSnapshot extends Model
{
    protected $table = 'mc_rate_snapshots';

    public const UPDATED_AT = null;

    protected $fillable = [
        'taken_at', 'slot', 'source', 'currency_code', 'currency_label',
        'base_buy', 'margin_buy', 'base_sell', 'margin_sell',
        'buy', 'sell', 'prev_buy', 'prev_sell', 'recorded_by',
    ];

    protected $casts = [
        'taken_at' => 'datetime',
        'slot' => 'datetime',
        'base_buy' => 'float',
        'margin_buy' => 'float',
        'base_sell' => 'float',
        'margin_sell' => 'float',
        'buy' => 'float',
        'sell' => 'float',
        'prev_buy' => 'float',
        'prev_sell' => 'float',
    ];
}
