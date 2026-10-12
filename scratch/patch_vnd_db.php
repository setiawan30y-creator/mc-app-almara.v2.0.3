<?php
require 'c:/laragon/www/mc-app-almara.v1/vendor/autoload.php';
$app = require_once 'c:/laragon/www/mc-app-almara.v1/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$vnd = App\Models\Currency::where('code', 'LIKE', '%VND%')->first();
if ($vnd) {
    echo "Current VND in DB:\n" . json_encode($vnd, JSON_PRETTY_PRINT) . "\n";
    
    // Perbarui nilai VND desimal
    $vnd->buy = 0.63; // 0.66 - 0.03 margin
    $vnd->sell = 0.70; // 0.70 + 0 margin
    
    // Update raw_json
    $raw = json_decode($vnd->raw_json, true) ?? [];
    $raw['buy'] = 0.63;
    $raw['sell'] = 0.70;
    $raw['base_buy'] = 0.66;
    $raw['base_sell'] = 0.70;
    $raw['margin_buy'] = -0.03;
    $raw['margin_sell'] = 0.00;
    
    $vnd->raw_json = json_encode($raw);
    $vnd->save();
    
    echo "Updated VND in DB:\n" . json_encode($vnd, JSON_PRETTY_PRINT) . "\n";
} else {
    echo "VND not found in DB\n";
}

// Update mc_currencies di Datastore jika ada
$ds = App\Models\Datastore::where('store_key', 'mc_currencies')->first();
if ($ds) {
    $currencies = json_decode($ds->json_data, true);
    $updated = false;
    foreach ($currencies as &$c) {
        if (strpos(strtoupper($c['code'] ?? ''), 'VND') !== false) {
            $c['buy'] = 0.63;
            $c['sell'] = 0.70;
            $c['base_buy'] = 0.66;
            $c['base_sell'] = 0.70;
            $c['margin_buy'] = -0.03;
            $c['margin_sell'] = 0.00;
            $updated = true;
        }
    }
    if ($updated) {
        $ds->json_data = json_encode($currencies);
        $ds->save();
        echo "Updated mc_currencies Datastore.\n";
    }
}
echo "Done!\n";
