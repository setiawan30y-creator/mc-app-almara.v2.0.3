<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class LetterDocument extends Model { protected $table='mc_letter_documents'; protected $fillable=['letter_record_id','file_name','file_url','mime_type','file_size','description']; public function letter(){return $this->belongsTo(LetterRecord::class,'letter_record_id');} }
