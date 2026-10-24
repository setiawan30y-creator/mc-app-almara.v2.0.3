<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrisPin extends Model
{
    protected $table = 'mc_hris_pins';
    protected $fillable = ['nik', 'pin_hash', 'failed_attempts', 'locked_until'];
    protected $hidden = ['pin_hash'];
    protected $casts = ['locked_until' => 'datetime'];
}
