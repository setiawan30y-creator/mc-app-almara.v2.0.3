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
        'buy', 'sell', 'prev_buy', 'prev_sell', 'recorded_by',
    ];

    protected $casts = [
        'taken_at' => 'datetime',
        'slot' => 'datetime',
        'buy' => 'float',
        'sell' => 'float',
        'prev_buy' => 'float',
        'prev_sell' => 'float',
    ];
}
