<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegulatoryChunk extends Model
{
    protected $table = 'mc_regulatory_chunks';
    public $timestamps = false;
    protected $fillable = ['document_id', 'position', 'ref', 'content'];
}
