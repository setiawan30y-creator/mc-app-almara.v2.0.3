<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Satu dokumen izin milik nasabah perusahaan (PT, CV, Yayasan, dll.). */
class CustomerLicense extends Model
{
    protected $table = 'mc_customer_licenses';

    public const TYPES = [
        'NIB' => 'NIB (Nomor Induk Berusaha)',
        'AKTA_PENDIRIAN' => 'Akta Pendirian',
        'AKTA_PERUBAHAN' => 'Akta Perubahan',
        'SK_KEMENKUMHAM' => 'SK Kemenkumham',
        'IZIN_USAHA' => 'Izin Usaha / SIUP',
        'IZIN_OPERASIONAL' => 'Izin Operasional',
        'DOMISILI' => 'Surat Keterangan Domisili',
        'NPWP' => 'NPWP Badan',
        'LAINNYA' => 'Lainnya',
    ];

    protected $fillable = [
        'customer_id', 'license_type', 'license_name', 'number', 'issued_at', 'expires_at',
        'document_url', 'notes', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'issued_at' => 'date:Y-m-d',
        'expires_at' => 'date:Y-m-d',
    ];

    public function label(): string
    {
        if ($this->license_type === 'LAINNYA' && $this->license_name) {
            return (string) $this->license_name;
        }

        return self::TYPES[$this->license_type] ?? (string) $this->license_type;
    }
}
