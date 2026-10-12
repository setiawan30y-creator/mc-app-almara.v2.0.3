<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class LetterRecord extends Model { protected $table='mc_letter_records'; protected $fillable=['letter_number','sequence','company_code','letter_type','letter_date','subject','status']; protected $casts=['letter_date'=>'date']; public function documents(){return $this->hasMany(LetterDocument::class,'letter_record_id');} }
