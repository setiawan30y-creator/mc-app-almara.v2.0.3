<?php

namespace App\Http\Controllers;

use App\Models\Datastore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Tema tampilan global (berlaku untuk semua pengguna). Nilai divalidasi ketat
 * karena disuntikkan ke CSS halaman: hanya warna hex, ukuran, dan daftar putih.
 */
class ThemeController extends Controller
{
    private const KEY = 'mc_global_theme_v2';

    private const COLORS = [
        'primary', 'primaryHover', 'secondary', 'pageBg', 'cardBg', 'sidebarBg', 'sidebarText', 'headerBg',
        'text', 'textMuted', 'border', 'inputBg', 'inputBorder', 'buttonBg', 'buttonText',
        'buy', 'sell', 'draft', 'final', 'info', 'warning', 'danger', 'link', 'tableHeadBg', 'tableHover',
    ];

    private const SIZES = ['radius', 'btnRadius', 'inputRadius', 'navRadius'];

    private const ENUMS = [
        'fontFamily' => ['inter', 'jakarta', 'poppins', 'manrope', 'dmsans', 'nunito', 'roboto', 'source', 'merriweather', 'system'],
        'fontSize' => ['13', '14', '15', '16', '17', '18'],
        'headingWeight' => ['500', '600', '700', '800'],
        'btnWeight' => ['500', '600', '700', '800'],
        'btnCase' => ['none', 'uppercase'],
        'cardBorderWidth' => ['0', '1', '2'],
        'density' => ['compact', 'normal', 'comfortable'],
        'tabularNums' => ['0', '1'],
        'btnShadow' => ['0', '1'],
        'tableZebra' => ['0', '1'],
        'sidebarGradient' => ['0', '1'],
        'smoothMotion' => ['0', '1'],
    ];

    public function show(): JsonResponse
    {
        $row = Datastore::query()->where('store_key', self::KEY)->first();
        $data = $row ? $row->json_data : null;
        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        return response()->json(['status' => 'success', 'data' => is_array($data) ? $data : null]);
    }

    public function save(Request $request): JsonResponse
    {
        $input = $request->input('theme');
        if ($input === null) {
            Datastore::query()->where('store_key', self::KEY)->delete();

            return response()->json(['status' => 'success', 'message' => 'Tema global dikembalikan ke bawaan.']);
        }
        if (!is_array($input)) {
            return response()->json(['status' => 'error', 'message' => 'Format tema tidak valid.'], 422);
        }

        $clean = [];
        foreach (self::COLORS as $key) {
            $v = $input[$key] ?? '';
            if ($v === '' || $v === null) {
                $clean[$key] = '';
            } elseif (is_string($v) && preg_match('/^#[0-9A-Fa-f]{6}$/', $v)) {
                $clean[$key] = strtoupper($v);
            } else {
                return response()->json(['status' => 'error', 'message' => "Warna '$key' tidak valid (gunakan #RRGGBB)."], 422);
            }
        }
        foreach (self::SIZES as $key) {
            $v = $input[$key] ?? '';
            if ($v === '' || $v === null) {
                $clean[$key] = '';
            } elseif (is_string($v) && preg_match('/^\d{1,3}(px|rem)$/', $v)) {
                $clean[$key] = $v;
            } else {
                return response()->json(['status' => 'error', 'message' => "Ukuran '$key' tidak valid (contoh 12px)."], 422);
            }
        }
        foreach (self::ENUMS as $key => $allowed) {
            $v = isset($input[$key]) ? (string) $input[$key] : '';
            if ($v !== '' && !in_array($v, $allowed, true)) {
                return response()->json(['status' => 'error', 'message' => "Nilai '$key' tidak valid."], 422);
            }
            $clean[$key] = $v;
        }

        $shadow = (string) ($input['shadow'] ?? '');
        if ($shadow !== '' && !preg_match('/^[0-9a-zA-Z#(),.\s%-]{1,300}$/', $shadow)) {
            return response()->json(['status' => 'error', 'message' => 'Nilai shadow tidak valid.'], 422);
        }
        $clean['shadow'] = $shadow !== '' ? $shadow : '0 2px 12px rgba(0,0,0,.06)';

        Datastore::updateOrCreate(['store_key' => self::KEY], ['json_data' => $clean]);

        return response()->json(['status' => 'success', 'message' => 'Tema global disimpan untuk semua pengguna.', 'data' => $clean]);
    }
}
