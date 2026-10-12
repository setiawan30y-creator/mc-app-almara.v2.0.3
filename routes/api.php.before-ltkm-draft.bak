<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\CurrencyDenominationController;
use App\Http\Controllers\DatastoreController;
use App\Http\Controllers\SmartdealController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\AiChatController;
use App\Http\Controllers\UserChatController;
use App\Http\Controllers\OcrController;
use App\Http\Controllers\LetterNumberController;
use App\Http\Controllers\WhatsAppGatewayController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\GoamlComplianceController;
use App\Http\Controllers\DashboardAnalyticsController;
use App\Http\Middleware\DevelopmentBypassAuth;
use Illuminate\Support\Facades\Route;

// In local development, the existing DevelopmentBypassAuth is the source of
// the temporary teller identity. In every non-local environment the normal
// authenticated session remains mandatory.
$apiAuthMiddleware = app()->environment('local') && (bool) config('app.dev_bypass_auth', false)
    ? ['web', DevelopmentBypassAuth::class]
    : ['web', 'auth', 'single.session'];

Route::middleware($apiAuthMiddleware)->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateMe']);
    Route::post('/branding/favicon', [AuthController::class, 'uploadFavicon'])->middleware('role:owner,superadmin');
    Route::post('/ai/chat', [AiChatController::class, 'chat']);
    Route::get('/users', [AuthController::class, 'users']);
    Route::post('/users', [AuthController::class, 'saveUser']);
    Route::delete('/users/{user}', [AuthController::class, 'deleteUser']);

    // Chat Antar Pengguna Endpoints
    Route::get('/user-chats/messages', [UserChatController::class, 'getMessages']);
    Route::post('/user-chats/messages', [UserChatController::class, 'sendMessage']);
    Route::get('/user-chats/users', [UserChatController::class, 'getChatUsers']);
    Route::get('/user-chats/poll', [UserChatController::class, 'pollNewMessages']);

    Route::get('/dashboard/analytics', [DashboardAnalyticsController::class, 'index']);
    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::post('/transactions/bulk', [TransactionController::class, 'bulkStore']);
    Route::delete('/transactions', [TransactionController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/transactions/clear-all', [TransactionController::class, 'clearAll'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/audit', [TransactionController::class, 'audit']);

    // GOAML / Compliance Engine
    Route::get('/goaml/rules', [GoamlComplianceController::class, 'rules']);
    Route::post('/goaml/rules', [GoamlComplianceController::class, 'storeRule'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::put('/goaml/rules/{rule}', [GoamlComplianceController::class, 'updateRule'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/goaml/alerts', [GoamlComplianceController::class, 'alerts']);
    Route::post('/goaml/evaluate', [GoamlComplianceController::class, 'evaluate']);
    Route::post('/goaml/alerts/{alert}/review', [GoamlComplianceController::class, 'review'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/audit', [TransactionController::class, 'destroyAudit'])->middleware('role:owner,superadmin,admin,supervisor');

    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::post('/customers/bulk', [CustomerController::class, 'bulkStore']);
    Route::post('/customers/clear-all', [CustomerController::class, 'clearAll'])->middleware('role:owner,superadmin');
    Route::delete('/customers', [CustomerController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/customers/clear-all', [CustomerController::class, 'clearAll'])->middleware('role:owner,superadmin');

    Route::get('/currencies', [CurrencyController::class, 'index']);
    Route::post('/currencies', [CurrencyController::class, 'store']);
    Route::delete('/currencies', [CurrencyController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');

    // Master pecahan valuta: dipisahkan dari master valuta utama agar
    // pecahan dapat dipakai kembali oleh Manajemen Kurs, POS, dan Stok Valas.
    Route::get('/currency-denominations', [CurrencyDenominationController::class, 'index']);
    Route::post('/currency-denominations', [CurrencyDenominationController::class, 'store']);
    Route::post('/currency-denominations/sync', [CurrencyDenominationController::class, 'sync']);
    Route::get('/currency-denominations/{currencyDenomination}', [CurrencyDenominationController::class, 'show']);
    Route::put('/currency-denominations/{currencyDenomination}', [CurrencyDenominationController::class, 'update']);
    Route::patch('/currency-denominations/{currencyDenomination}', [CurrencyDenominationController::class, 'update']);
    Route::delete('/currency-denominations/{currencyDenomination}', [CurrencyDenominationController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');

    Route::get('/smartdeal-rates', [SmartdealController::class, 'rates']);

    Route::post('/uploads', [UploadController::class, 'store']);
    Route::post('/ocr/vision', [OcrController::class, 'vision']);
    Route::post('/wa-gateway/send', [WhatsAppGatewayController::class, 'send']);

    Route::get('/datastore', [DatastoreController::class, 'index']);
    Route::post('/datastore', [DatastoreController::class, 'store']);
    Route::delete('/datastore', [DatastoreController::class, 'destroy']);

    Route::get('/backups/settings', [BackupController::class, 'settings'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/backups/settings', [BackupController::class, 'saveSettings'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/backups', [BackupController::class, 'index'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/backups/run', [BackupController::class, 'run'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/backups/{backupLog}/download', [BackupController::class, 'download'])->middleware('role:owner,superadmin,admin,supervisor');

    Route::get('/letter-numbers/settings', [LetterNumberController::class, 'settings']);
    Route::post('/letter-numbers/settings', [LetterNumberController::class, 'saveSettings']);
    Route::get('/letter-numbers/records', [LetterNumberController::class, 'index']);
    Route::post('/letter-numbers/next', [LetterNumberController::class, 'next']);
    Route::get('/letter-numbers/documents/{documentId}/preview', [LetterNumberController::class, 'previewDocument']);
    Route::get('/letter-numbers/documents/{documentId}/download', [LetterNumberController::class, 'downloadDocument']);
    Route::get('/letter-numbers/records/{id}', [LetterNumberController::class, 'documents']);
    Route::post('/letter-numbers/records/{id}/documents', [LetterNumberController::class, 'uploadDocument']);
});

Route::get('/public/currencies', [App\Http\Controllers\CurrencyController::class, 'index']);
