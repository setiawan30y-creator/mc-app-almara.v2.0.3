<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Orang yang berhubungan dengan PT (penanda tangan, pelaksana transaksi, kurir pengambil).
 * Data INTERNAL untuk kebutuhan PKS: tidak termasuk dalam laporan SIPESAT.
 */
class PtRepresentative extends Model
{
    protected $table = 'mc_pt_representatives';

    protected $fillable = [
        'customer_id', 'role_type', 'name', 'position', 'id_type', 'id_number', 'phone', 'address',
        'authority_ref', 'valid_from', 'valid_until', 'status', 'photo_url', 'id_photo_url',
        'authority_doc_url', 'notes', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'id_number' => 'encrypted',
        'phone' => 'encrypted',
        'valid_from' => 'date:Y-m-d',
        'valid_until' => 'date:Y-m-d',
    ];
}
