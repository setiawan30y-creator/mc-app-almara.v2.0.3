<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasFactory;

    protected $table = 'mc_customers';
    protected $primaryKey = 'internal_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'internal_id', 'idpjk', 'id_cif', 'name', 'phone', 
        'identity_type', 'identity_number', 'selain_ktp',
        'address', 'tempat_lahir', 'tanggal_lahir', 'npwp',
        'local_id', 'jenis_kelamin', 'warga_negara', 'pekerjaan',
        'no_rekening', 'registration_date', 'customer_type', 'jenis_badan_usaha', 'bidang_usaha', 'nib', 'raw_json'
    ];
}
