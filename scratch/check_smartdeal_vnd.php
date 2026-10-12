<?php
require 'c:/laragon/www/mc-app-almara.v1/vendor/autoload.php';
$app = require_once 'c:/laragon/www/mc-app-almara.v1/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Http;

$url = 'https://smartdeal.co.id/rates/dki_banten';
echo "Fetching $url ...\n";
try {
    $response = Http::timeout(20)->get($url);
    if ($response->successful()) {
        $html = $response->body();
        echo "HTML fetched. Length: " . strlen($html) . "\n";
        
        $dom = new DOMDocument();
        @$dom->loadHTML($html);
        $xpath = new DOMXPath($dom);
        $rows = $xpath->query('//tr');
        echo "Found " . $rows->length . " table rows.\n";
        
        foreach ($rows as $row) {
            $text = $row->nodeValue;
            // Let's print the actual cells
            $cells = $row->getElementsByTagName('td');
            if ($cells->length >= 4) {
                $cellData = [];
                foreach ($cells as $cell) {
                    $cellData[] = trim($cell->nodeValue);
                }
                echo "Row: " . json_encode($cellData) . "\n";
            }
        }
    } else {
        echo "Failed to fetch: Status " . $response->status() . "\n";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
