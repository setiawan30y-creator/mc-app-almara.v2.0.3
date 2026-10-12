<?php
require 'c:/laragon/www/mc-app-almara.v1/vendor/autoload.php';
$app = require_once 'c:/laragon/www/mc-app-almara.v1/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

$columns = Schema::getColumnListing('currencies');
echo "Columns in 'currencies' table:\n" . json_encode($columns, JSON_PRETTY_PRINT) . "\n";
