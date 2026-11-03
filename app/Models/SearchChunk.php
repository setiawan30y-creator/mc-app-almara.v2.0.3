<?php
// @2026-Alifiandra

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SearchChunk extends Model
{
    protected $table = 'mc_search_chunks';
    public $timestamps = false;
    protected $fillable = ['file_id', 'position', 'ref', 'content'];
}
