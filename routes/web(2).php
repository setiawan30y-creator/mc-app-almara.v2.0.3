<?php

use App\Http\Controllers\AuthController;
use App\Models\Datastore;
use Illuminate\Support\Facades\Route;

function decodeDatastorePayload($payload)
{
    $decoded = $payload;
    for ($i = 0; $i < 2; $i++) {
        if (!is_string($decoded)) {
            break;
        }
        $next = json_decode($decoded, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            break;
        }
        $decoded = $next;
    }

    return is_array($decoded) ? $decoded : null;
}

Route::get('/', function () {
    if (auth()->check() && strtolower((string) auth()->user()->role) === 'papan') {
        return redirect('/papan-kurs');
    }

    return view('dashboard');
});

Route::get('/login', function () {
    return redirect('/');
})->name('login.form');

Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth')->name('logout');
Route::get('/auth/me', [AuthController::class, 'me'])->middleware('auth');

Route::get('/papan-kurs', function () {
    $profileData = null;
    $papanSettings = null;
    try {
        $profileStore = Datastore::where('store_key', 'mc_profile')->first();
        if ($profileStore) {
            $profileData = decodeDatastorePayload($profileStore->json_data);
        }

        $settingsStore = Datastore::where('store_key', 'mc_papan_settings')->first();
        if ($settingsStore) {
            $papanSettings = decodeDatastorePayload($settingsStore->json_data);
        }
    } catch (\Exception $e) {
        // Fallback
    }
    return view('papan-kurs', [
        'profile' => $profileData,
        'papanSettings' => $papanSettings,
    ]);
})->middleware('auth');
