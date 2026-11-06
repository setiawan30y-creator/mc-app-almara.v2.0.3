<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpCashClosing;
use App\Services\Erp\ValasValuation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GET /dashboard/position[?date=YYYY-MM-DD]
 * Posisi Kas, Bank, dan nilai Valas (Rp) untuk kartu Dashboard, dari buku besar server.
 * - Tanpa tanggal / hari ini : saldo saat ini.
 * - Tanggal lalu             : saldo akhir tanggal itu; bila closing tanggal itu sudah dikunci,
 *                              kas & valas memakai angka yang dibekukan saat closing.
 */
class DashboardPositionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $today = now()->toDateString();
        $date = (string) $request->query('date', '');
        if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return response()->json(['status' => 'error', 'message' => 'Format tanggal tidak valid.'], 422);
        }
        $past = $date !== '' && $date < $today;
        $end = $past ? $date . ' 23:59:59' : null;
        $closing = $past ? ErpCashClosing::query()->whereDate('closing_date', $date)->first() : null;
        $closed = $closing && $closing->status === 'CLOSED';

        $balance = function ($account) use ($end) {
            $q = $account->movements();
            if ($end) {
                $q->where('posted_at', '<=', $end);
            }
            return (float) $account->opening_balance + (float) $q->sum(DB::raw("CASE WHEN direction = 'IN' THEN amount ELSE -amount END"));
        };

        $cash = 0.0;
        foreach (ErpCashAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->get() as $a) {
            $cash += $balance($a);
        }
        if ($closed) {
            $cash = (float) $closing->expected_cash;
        }

        $banks = ['total' => 0.0, 'BCA' => 0.0, 'MANDIRI' => 0.0, 'accounts' => []];
        foreach (ErpBankAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->orderBy('bank_name')->get() as $b) {
            $v = $balance($b);
            $key = strtoupper($b->code . ' ' . $b->bank_name);
            $banks['total'] += $v;
            if (str_contains($key, 'MANDIRI')) {
                $banks['MANDIRI'] += $v;
            } elseif (str_contains($key, 'BCA')) {
                $banks['BCA'] += $v;
            }
            $banks['accounts'][] = ['name' => $b->bank_name, 'balance' => round($v, 2)];
        }

        $valas = (new ValasValuation())->at($past ? $date : null);

        return response()->json(['status' => 'success', 'data' => [
            'date' => $past ? $date : $today,
            'source' => !$past ? 'live' : ($closed ? 'closing' : 'end_of_day'),
            'closing_no' => $closing->closing_no ?? null,
            'cash' => round($cash, 2),
            'bank' => array_merge($banks, ['total' => round($banks['total'], 2), 'BCA' => round($banks['BCA'], 2), 'MANDIRI' => round($banks['MANDIRI'], 2)]),
            'valas' => ['total' => $valas['total'], 'source' => $valas['source']],
        ]])->header('Cache-Control', 'no-store');
    }
}
