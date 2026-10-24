<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Support\LoginPageStore;
use Illuminate\Http\Request;

/**
 * Pengaturan halaman login (owner/superadmin/admin).
 *
 *  GET    /login-page                 pengaturan + warna tema yang dipakai
 *  POST   /login-page                 simpan teks
 *  POST   /login-page/asset           unggah logo (type=logo) atau gambar latar (type=bg)
 *  DELETE /login-page/asset/{type}    hapus logo / gambar latar
 */
class LoginPageController extends Controller
{
    private const LIMITS = ['logo' => 1024, 'bg' => 3072]; // KB

    public function show()
    {
        return response()->json(['status' => 'success', 'data' => $this->payload()]);
    }

    public function save(Request $request)
    {
        $v = $request->validate([
            'company_name' => ['nullable', 'string', 'max:120'],
            'headline' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:260'],
            'features' => ['nullable', 'array', 'max:4'],
            'features.*' => ['nullable', 'string', 'max:90'],
            'welcome_title' => ['nullable', 'string', 'max:80'],
            'welcome_desc' => ['nullable', 'string', 'max:200'],
            'button_label' => ['nullable', 'string', 'max:30'],
            'security_note' => ['nullable', 'string', 'max:200'],
            'show_art' => ['nullable', 'boolean'],
        ]);
        LoginPageStore::save($v, (string) ($request->user()?->username ?? ''));

        return response()->json(['status' => 'success', 'message' => 'Pengaturan halaman login tersimpan.', 'data' => $this->payload()]);
    }

    public function uploadAsset(Request $request)
    {
        $request->validate(['type' => ['required', 'in:logo,bg'], 'file' => ['required', 'file']]);
        $type = $request->input('type');
        $file = $request->file('file');
        $max = self::LIMITS[$type];

        if (!$file->isValid() || $file->getSize() > $max * 1024) {
            return $this->fail('Ukuran gambar maksimal ' . ($max / 1024) . ' MB.');
        }
        $info = @getimagesize($file->getRealPath());
        $ext = match ($info[2] ?? null) {
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        if (!$ext) {
            return $this->fail('Gunakan gambar PNG, JPG, atau WebP.');
        }
        if ($type === 'logo' && ($info[0] > 2000 || $info[1] > 2000)) {
            return $this->fail('Dimensi logo maksimal 2000 x 2000 piksel.');
        }
        if ($type === 'bg' && ($info[0] > 4000 || $info[1] > 4000)) {
            return $this->fail('Dimensi gambar latar maksimal 4000 x 4000 piksel.');
        }

        $dir = public_path('branding');
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return $this->fail('Folder branding tidak bisa dibuat. Periksa izin folder public.', 500);
        }
        $name = 'login-' . $type . '-' . time() . '.' . $ext;
        $file->move($dir, $name);

        $this->removeOld($type);
        LoginPageStore::setAsset($type, 'branding/' . $name, (string) ($request->user()?->username ?? ''));

        return response()->json(['status' => 'success', 'message' => $type === 'logo' ? 'Logo tersimpan.' : 'Gambar latar tersimpan.', 'data' => $this->payload()]);
    }

    public function deleteAsset(Request $request, string $type)
    {
        if (!in_array($type, ['logo', 'bg'], true)) {
            return $this->fail('Jenis berkas tidak dikenal.', 404);
        }
        $this->removeOld($type);
        LoginPageStore::setAsset($type, '', (string) ($request->user()?->username ?? ''));

        return response()->json(['status' => 'success', 'message' => 'Berkas dihapus.', 'data' => $this->payload()]);
    }

    private function payload(): array
    {
        $s = LoginPageStore::settings();
        $view = LoginPageStore::view();

        return [
            'settings' => $s,
            'defaults' => LoginPageStore::DEFAULTS,
            'company_name_effective' => $view['name'],
            'logo_url' => $view['logo_url'],
            'bg_url' => $view['bg_url'],
            'theme' => LoginPageStore::theme(),
        ];
    }

    /** Hapus berkas lama (hanya yang namanya cocok pola, tidak pernah path sembarang). */
    private function removeOld(string $type): void
    {
        $s = LoginPageStore::settings();
        $old = $s[$type === 'logo' ? 'logo_file' : 'bg_file'];
        if ($old !== '' && preg_match(LoginPageStore::assetRegex(), $old) && is_file(public_path($old))) {
            @unlink(public_path($old));
        }
    }

    private function fail(string $message, int $code = 422)
    {
        return response()->json(['status' => 'error', 'message' => $message], $code);
    }
}
