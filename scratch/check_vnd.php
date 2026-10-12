<?php
require 'c:/laragon/www/mc-app-almara.v1/vendor/autoload.php';
$app = require_once 'c:/laragon/www/mc-app-almara.v1/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$vnd = App\Models\Currency::where('code', 'LIKE', '%VND%')->first();
if ($vnd) {
    echo "Currency Model VND: " . json_encode($vnd, JSON_PRETTY_PRINT) . "\n";
} else {
    echo "VND not found in Currency model.\n";
}

$ds = App\Models\Datastore::where('store_key', 'mc_currencies')->first();
if ($ds) {
    $currencies = json_decode($ds->json_data, true);
    $found = false;
    foreach ($currencies as $c) {
        if (strpos(strtoupper($c['code'] ?? ''), 'VND') !== false) {
            echo "Datastore VND: " . json_encode($c, JSON_PRETTY_PRINT) . "\n";
            $found = true;
        }
    }
    if (!$found) {
        echo "VND not found in Datastore mc_currencies.\n";
    }
} else {
    echo "mc_currencies not found in Datastore.\n";
}
