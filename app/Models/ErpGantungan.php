<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * Catatan Rp yang sedang di luar laci kas.
 *  type OUTSIDE_CASH : Rp keluar / dipakai orang lain, dianggap masih ada (menambah kas saat closing).
 *  type OWED_CHANGE  : kembalian yang masih menggantung (mengurangi kas saat closing).
 * Sisa = amount_rp - cicilan. Tidak ada efek ke ledger kas atau bank.
 */
class ErpGantungan extends Model
{
    public const TYPE_OUTSIDE = 'OUTSIDE_CASH';
    public const TYPE_OWED = 'OWED_CHANGE';

    protected $table = 'erp_gantungan';

    protected $fillable = [
        'reference_no', 'occurred_at', 'recipient', 'recipient_key', 'type', 'category', 'amount_rp', 'status',
        'description', 'returned_at', 'returned_by', 'created_by', 'created_by_name', 'updated_by',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'amount_rp' => 'decimal:2',
        'returned_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (ErpGantungan $g) {
            $g->recipient_key = self::keyFor((string) $g->recipient);
        });
    }

    public static function keyFor(string $name): string
    {
        return mb_substr(mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $name))), 0, 150);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ErpGantunganPayment::class, 'gantungan_id')->orderBy('paid_at')->orderBy('id');
    }

    public function scopeOutstanding($query)
    {
        return $query->where('status', 'OUTSTANDING');
    }

    /** Total yang sudah dibayar sampai $cutoff (null = sekarang). */
    public function paidAt(?string $cutoff = null): float
    {
        $payments = $this->relationLoaded('payments') ? $this->payments : $this->payments()->get();
        $amount = (float) $this->amount_rp;

        if ($payments->isEmpty()) {
            // Baris lama (halaman ERP terpisah) hanya punya returned_at tanpa cicilan.
            if ($this->returned_at && (!$cutoff || $this->returned_at->lte(Carbon::parse($cutoff)))) {
                return $amount;
            }

            return ($this->status === 'RETURNED' && !$this->returned_at && !$cutoff) ? $amount : 0.0;
        }

        $paid = $cutoff
            ? (float) $payments->filter(fn ($p) => $p->paid_at->lte(Carbon::parse($cutoff)))->sum('amount_rp')
            : (float) $payments->sum('amount_rp');

        return min($amount, $paid);
    }

    public function remainingAt(?string $cutoff = null): float
    {
        if ($cutoff && $this->occurred_at && $this->occurred_at->gt(Carbon::parse($cutoff))) {
            return 0.0;
        }

        return max(0.0, round((float) $this->amount_rp - $this->paidAt($cutoff), 2));
    }

    public function isOwed(): bool
    {
        return $this->type === self::TYPE_OWED;
    }

    /** Baris yang masih punya sisa pada $cutoff, lengkap dengan sisa (remaining_calc) dan nilai bertanda (signed_calc). */
    public static function openAt(?string $cutoff = null): Collection
    {
        $query = static::query()->with('payments')->orderBy('occurred_at')->orderBy('id');
        if ($cutoff) {
            $query->where('occurred_at', '<=', $cutoff);
        }

        return $query->get()->map(function (ErpGantungan $g) use ($cutoff) {
            $remaining = $g->remainingAt($cutoff);
            $g->setAttribute('remaining_calc', $remaining);
            $g->setAttribute('signed_calc', $g->isOwed() ? -$remaining : $remaining);

            return $g;
        })->filter(fn ($g) => $g->remaining_calc > 0.004)->values();
    }

    /** Nilai bersih gantungan yang ikut dihitung sebagai kas saat closing (keluar - kembalian menggantung). */
    public static function netAt(string $cutoff): float
    {
        return round((float) static::openAt($cutoff)->sum('signed_calc'), 2);
    }
}
