<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionAudit extends Model
{
    use HasFactory;

    protected $table = 'mc_transactions_audit';
    protected $primaryKey = 'itemId';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'itemId', 'id', 'timestamp', 'kasir', 'tipe', 'valuta', 
        'nominal', 'rate', 'total', 'paymentMethod', 'customerName', 
        'id_cif', 'isOldMoney', 'keterangan', 'raw_json'
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'isOldMoney' => 'boolean',
        'nominal' => 'double',
        'rate' => 'double',
        'total' => 'double',
    ];
}
