<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoamlAlertTransaction extends Model
{
    protected $table = 'goaml_alert_transactions';

    protected $fillable = [
        'alert_id','transaction_item_id','transaction_invoice_id','amount_idr',
    ];

    protected $casts = [
        'amount_idr' => 'decimal:2',
    ];

    public function alert()
    {
        return $this->belongsTo(GoamlAlert::class, 'alert_id');
    }

    public function transaction()
    {
        return $this->belongsTo(Transaction::class, 'transaction_item_id', 'itemId');
    }
}