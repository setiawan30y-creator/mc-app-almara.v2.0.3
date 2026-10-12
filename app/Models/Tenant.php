<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    use HasUlids;

    protected $fillable = [
        'name',
        'slug',
        'code',
        'status',
        'logo_path',
        'primary_color',
        'timezone',
        'locale',
    ];

    protected $casts = [
        'id' => 'string',
    ];

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function domains(): HasMany
    {
        return $this->hasMany(TenantDomain::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(TenantSetting::class);
    }
}
