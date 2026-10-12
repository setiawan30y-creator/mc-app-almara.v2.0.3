<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LetterNumberCounter extends Model
{
    protected $table = 'mc_letter_number_counters';
    protected $fillable = ['company_code','letter_type','year','last_number'];
    protected $casts = ['year'=>'integer','last_number'=>'integer'];
}
