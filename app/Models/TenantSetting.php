<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSetting extends Model
{
    protected $fillable = [
        'tenant_id',
        'company_name',
        'company_short_name',
        'npwp',
        'license_number',
        'address',
        'city',
        'province',
        'postal_code',
        'country',
        'phone',
        'email',
        'website',
        'logo_path',
        'favicon_path',
        'timezone',
        'locale',
        'default_currency',
        'receipt_header',
        'receipt_footer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
