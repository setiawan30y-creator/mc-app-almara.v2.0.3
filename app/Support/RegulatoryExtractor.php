<?php
// @2026-Alifiandra

namespace App\Support;

/** Mengambil teks dari berkas regulasi yang diunggah. */
class RegulatoryExtractor
{
    public const MAX_CHARS = 1500000;

    /** @return array{text:string,error:?string} */
    public static function extract(string $path, string $ext, string $mime, array $ai): array
    {
        $ext = strtolower($ext);
        try {
            switch ($ext) {
                case 'txt': case 'csv': case 'json': case 'xml': case 'html':
                    $raw = (string) @file_get_contents($path);
                    if ($ext === 'html' || $ext === 'xml') {
                        $raw = preg_replace('#<(script|style)\b[^>]*>.*?</\1>#is', ' ', $raw);
                        $raw = preg_replace('#</(p|div|li|tr|h[1-6]|br)\s*>|<br\s*/?>#i', "\n", $raw);
                        $raw = html_entity_decode(strip_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    }
                    return self::done($raw);
                case 'docx':
                    return self::done(self::zipXml($path, ['word/document.xml'], '#</w:p>#', '#<w:tab/>#'));
                case 'pptx':
                    return self::done(self::zipXml($path, null, '#</a:p>#', null, 'ppt/slides/slide'));
                case 'xlsx':
                    return self::done(self::zipXml($path, ['xl/sharedStrings.xml'], '#</si>#', null));
                case 'pdf':
                    $local = self::pdftotext($path);
                    if ($local !== null && mb_strlen(trim($local)) > 80) {
                        return self::done($local);
                    }
                    return self::viaAi($path, 'application/pdf', $ai);
                case 'jpg': case 'jpeg': case 'png':
                    return self::viaAi($path, $ext === 'png' ? 'image/png' : 'image/jpeg', $ai);
                default:
                    return ['text' => '', 'error' => 'Format .' . $ext . ' belum dapat dibaca otomatis. Gunakan menu "Tempel/ganti teks" untuk mengisi teksnya.'];
            }
        } catch (\Throwable $e) {
            return ['text' => '', 'error' => 'Gagal membaca berkas: ' . $e->getMessage()];
        }
    }

    private static function viaAi(string $path, string $mime, array $ai): array
    {
        $r = RegulatoryAi::extractFile($ai, $path, $mime);
        if (!$r['ok']) {
            return ['text' => '', 'error' => $r['message'] . ' Anda dapat menempel teksnya secara manual.'];
        }
        return self::done($r['text']);
    }

    private static function pdftotext(string $path): ?string
    {
        if (!function_exists('shell_exec') || stripos((string) ini_get('disable_functions'), 'shell_exec') !== false) {
            return null;
        }
        $bin = stripos(PHP_OS_FAMILY, 'Windows') === 0 ? 'where pdftotext 2>NUL' : 'command -v pdftotext 2>/dev/null';
        if (trim((string) @shell_exec($bin)) === '') {
            return null;
        }
        $out = @shell_exec('pdftotext -layout -enc UTF-8 ' . escapeshellarg($path) . ' -');
        return is_string($out) ? $out : null;
    }

    private static function zipXml(string $path, ?array $names, string $breakRe, ?string $tabRe, ?string $prefix = null): string
    {
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return '';
        }
        $files = $names ?? [];
        if ($prefix !== null) {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $n = $zip->getNameIndex($i);
                if (str_starts_with($n, $prefix) && str_ends_with($n, '.xml')) {
                    $files[] = $n;
                }
            }
            natsort($files);
        }
        $out = '';
        foreach ($files as $name) {
            $xml = $zip->getFromName($name);
            if ($xml === false) {
                continue;
            }
            if ($tabRe) {
                $xml = preg_replace($tabRe, "\t", $xml);
            }
            $xml = preg_replace($breakRe, "\n", $xml);
            $out .= html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8') . "\n";
        }
        $zip->close();
        return $out;
    }

    /** @return array{text:string,error:?string} */
    private static function done(string $raw): array
    {
        if (!mb_check_encoding($raw, 'UTF-8')) {
            $raw = mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');
        }
        $raw = ltrim($raw, "\xEF\xBB\xBF");
        $text = self::clean($raw);
        if (mb_strlen($text) < 40) {
            return ['text' => '', 'error' => 'Tidak ada teks yang dapat dibaca dari berkas (mungkin hasil pindai). Tempel teksnya secara manual atau atur key Gemini untuk pembacaan otomatis.'];
        }
        return ['text' => mb_substr($text, 0, self::MAX_CHARS), 'error' => null];
    }

    public static function clean(string $text): string
    {
        $text = str_replace(["\r\n", "\r", "\f", "\0"], ["\n", "\n", "\n", ''], $text);
        $text = preg_replace('/[ \t]+/u', ' ', $text);
        $text = preg_replace('/ *\n */u', "\n", $text);
        $text = preg_replace("/\n{3,}/", "\n\n", $text);
        return trim($text);
    }
}
