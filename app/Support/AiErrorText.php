<?php
// @2026-Alifiandra

namespace App\Support;

/**
 * Pesan galat layanan AI (Gemini / OpenAI) dalam bahasa yang jelas dan bisa ditindaklanjuti,
 * dipakai oleh Tes koneksi, Tanya AI, Chat Regulatory AI, OCR identitas, dan Penerjemah.
 */
class AiErrorText
{
    public static function friendly(string $name, int $status, $json): string
    {
        $err = is_array($json) ? ($json['error'] ?? []) : [];
        $raw = is_array($err) ? (string) ($err['message'] ?? '') : '';
        $code = is_array($err) ? strtolower((string) ($err['code'] ?? $err['status'] ?? $err['type'] ?? '')) : '';
        $isOpenAi = stripos($name, 'openai') !== false;

        // Saldo / kredit OpenAI habis
        if ($isOpenAi && ($code === 'insufficient_quota' || preg_match('/no credits|insufficient[_ ]quota|exceeded your current quota|billing/i', $raw))) {
            return 'Saldo OpenAI habis. Silakan isi kredit di platform.openai.com › Settings › Billing, lalu coba lagi. '
                . 'Sementara itu, Anda bisa memakai Google Gemini (gratis) sebagai penyedia aktif.';
        }
        // Key tidak valid / sudah dihapus
        if (($status === 400 && preg_match('/api key not valid|api_key_invalid/i', $raw . $code))
            || ($status === 401 && preg_match('/invalid_api_key|incorrect api key|invalid authentication/i', $raw . $code))) {
            return "API key {$name} tidak valid atau sudah dihapus. Buat key baru, lalu tempel di Pengaturan › Asisten AI.";
        }
        if ($status === 401) {
            return "API key {$name} ditolak. Pastikan key masih aktif, lalu tempel ulang di Pengaturan › Asisten AI.";
        }
        // Lokasi / izin
        if (preg_match('/location is not supported|unsupported_country|country, region, or territory not supported/i', $raw . $code)) {
            return "{$name} belum tersedia dari lokasi server ini. Gunakan penyedia AI lain.";
        }
        if ($status === 403) {
            return "Akses ke {$name} ditolak. Pastikan API key aktif dan layanan {$name} diizinkan untuk proyek / akun Anda.";
        }
        if ($status === 404 || preg_match('/model .* (does not exist|not found)|no longer available/i', $raw)) {
            return "Model {$name} yang dipilih tidak tersedia untuk key ini. Pilih model lain di Pengaturan › Asisten AI.";
        }
        // Kuota / batas permintaan
        if ($status === 429) {
            return $isOpenAi
                ? 'Terlalu banyak permintaan ke OpenAI dalam waktu singkat. Tunggu sebentar, lalu coba lagi.'
                : 'Kuota gratis Gemini sedang habis. Tunggu beberapa menit (atau sampai besok untuk kuota harian), lalu coba lagi.';
        }
        if (in_array($status, [500, 502, 503, 504], true) || preg_match('/high demand|overloaded|try again later/i', $raw)) {
            return "Layanan {$name} sedang sibuk. Sudah dicoba ulang otomatis; silakan coba lagi beberapa saat.";
        }
        $raw = trim(preg_replace('/\s+/', ' ', $raw));
        return "{$name} menolak permintaan (HTTP {$status})" . ($raw !== '' ? ': ' . mb_substr($raw, 0, 160) : '.');
    }
}
