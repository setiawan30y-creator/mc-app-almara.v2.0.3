<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Jurnal Keuangan (pendapatan lain / beban). Kode akun BI disimpan di bi_code
 * sehingga LKBU B0003 dan Neraca bisa menjumlahkan langsung dari MySQL.
 * Mutasi kas/bank-nya dicatat di ledger ERP (reference_type 'expense', movement_no = expense_no-NN).
 */
class ErpExpense extends Model
{
    use SoftDeletes;

    protected $table = 'erp_expenses';

    protected $fillable = [
        'expense_no', 'type', 'bi_code', 'category', 'description', 'source', 'amount',
        'occurred_at', 'created_by_name', 'updated_by_name',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'occurred_at' => 'datetime',
    ];
}
