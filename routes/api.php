<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\CurrencyDenominationController;
use App\Http\Controllers\DatastoreController;
use App\Http\Controllers\HrisPinController;
use App\Http\Controllers\PtRepresentativeController;
use App\Http\Controllers\TranslateController;
use App\Http\Controllers\ErpOpeningBalanceController;
use App\Http\Controllers\ErpBankMutationController;
use App\Http\Controllers\ErpManualBankMutationController;
use App\Http\Controllers\ErpExpenseLedgerController;
use App\Http\Controllers\KursSourceController;
use App\Http\Controllers\SessionPolicyController;
use App\Http\Controllers\IntegrationKeyController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\AiChatController;
use App\Http\Controllers\UserChatController;
use App\Http\Controllers\OcrController;
use App\Http\Controllers\LetterNumberController;
use App\Http\Controllers\RegulatoryChatController;
use App\Http\Controllers\RegulatoryDocumentController;
use App\Http\Controllers\WhatsAppGatewayController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\DataResetController;
use App\Http\Controllers\ThemeController;
use App\Http\Controllers\LoginPageController;
use App\Http\Controllers\ClosingDailyController;
use App\Http\Controllers\GantunganController;
use App\Http\Controllers\InvestorController;
use App\Http\Controllers\PickupController;
use App\Http\Controllers\PosDocumentController;
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

// Pelacak GPS kurir (OwnTracks / Traccar Client): autentikasi lewat token di URL, tanpa sesi login.
Route::match(['get', 'post'], '/tracker/{token}', [PickupController::class, 'trackerIngest'])->middleware('throttle:240,1');

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

    // GOAML / Compliance Engine
    Route::get('/goaml/rules', [GoamlComplianceController::class, 'rules']);
    Route::post('/goaml/rules', [GoamlComplianceController::class, 'storeRule'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::put('/goaml/rules/{rule}', [GoamlComplianceController::class, 'updateRule'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/goaml/alerts', [GoamlComplianceController::class, 'alerts']);
    Route::post('/goaml/evaluate', [GoamlComplianceController::class, 'evaluate']);
    Route::post('/goaml/alerts/{alert}/review', [GoamlComplianceController::class, 'review'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/goaml/ltkm', [GoamlComplianceController::class, 'ltkmReports']);
Route::get('/goaml/ltkm/{report}', [GoamlComplianceController::class, 'ltkmReport']);
Route::post('/goaml/alerts/{alert}/ltkm', [GoamlComplianceController::class, 'createLtkmDraft'])
        ->middleware('role:owner,superadmin,admin,supervisor');

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

    Route::get('/kurs-source', [KursSourceController::class, 'fetch'])->middleware('throttle:90,1');
    Route::get('/session-policy', [SessionPolicyController::class, 'show']);
    Route::post('/session-policy', [SessionPolicyController::class, 'update'])->middleware('role:owner,superadmin,admin');
    Route::post('/session/ping', [SessionPolicyController::class, 'ping'])->middleware('throttle:60,1');

    Route::post('/uploads', [UploadController::class, 'store']);
    Route::post('/ocr/vision', [OcrController::class, 'vision'])->middleware('throttle:20,1');
    Route::get('/integrations/vision', [IntegrationKeyController::class, 'visionStatus'])->middleware('role:owner,superadmin,admin');
    Route::post('/integrations/vision', [IntegrationKeyController::class, 'visionSave'])->middleware('role:owner,superadmin,admin');
    Route::delete('/integrations/vision', [IntegrationKeyController::class, 'visionClear'])->middleware('role:owner,superadmin,admin');
    Route::post('/integrations/vision/test', [IntegrationKeyController::class, 'visionTest'])->middleware(['role:owner,superadmin,admin', 'throttle:10,1']);
    Route::get('/wa-gateway/status', [WhatsAppGatewayController::class, 'status']);
    Route::post('/wa-gateway/send', [WhatsAppGatewayController::class, 'send'])->middleware('throttle:60,1');
    Route::get('/wa-gateway', [WhatsAppGatewayController::class, 'show'])->middleware('role:owner,superadmin,admin');
    Route::post('/wa-gateway', [WhatsAppGatewayController::class, 'save'])->middleware('role:owner,superadmin,admin');
    Route::post('/wa-gateway/test', [WhatsAppGatewayController::class, 'test'])->middleware(['role:owner,superadmin,admin', 'throttle:10,1']);
    Route::get('/login-page', [LoginPageController::class, 'show'])->middleware('role:owner,superadmin,admin');
    Route::post('/login-page', [LoginPageController::class, 'save'])->middleware('role:owner,superadmin,admin');
    Route::post('/login-page/asset', [LoginPageController::class, 'uploadAsset'])->middleware(['role:owner,superadmin,admin', 'throttle:20,1']);
    Route::delete('/login-page/asset/{type}', [LoginPageController::class, 'deleteAsset'])->middleware('role:owner,superadmin,admin');

    Route::get('/hris/pins', [HrisPinController::class, 'status'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/hris/pins', [HrisPinController::class, 'set'])->middleware(['role:owner,superadmin,admin,supervisor', 'throttle:30,1']);
    Route::delete('/hris/pins', [HrisPinController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/hris/pins/verify', [HrisPinController::class, 'verify'])->middleware('throttle:30,1');
    Route::get('/pt-representatives', [PtRepresentativeController::class, 'index'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/pt-representatives', [PtRepresentativeController::class, 'store'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::put('/pt-representatives/{representative}', [PtRepresentativeController::class, 'update'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/pt-representatives/{representative}', [PtRepresentativeController::class, 'destroy'])->middleware('role:owner,superadmin,admin');
    Route::post('/translate', [TranslateController::class, 'translate'])->middleware('throttle:60,1');
    Route::get('/translate/key', [TranslateController::class, 'keyStatus'])->middleware('role:owner,superadmin,admin');
    Route::post('/translate/key', [TranslateController::class, 'keySave'])->middleware(['role:owner,superadmin,admin', 'throttle:10,1']);
    Route::delete('/translate/key', [TranslateController::class, 'keyClear'])->middleware('role:owner,superadmin,admin');
    Route::get('/datastore', [DatastoreController::class, 'index']);
    Route::post('/datastore', [DatastoreController::class, 'store']);
    Route::delete('/datastore', [DatastoreController::class, 'destroy']);

    // Saldo awal kas, bank, dan stok valuta disimpan ke ledger ERP.
    Route::get('/erp/bank-mutations', [ErpBankMutationController::class, 'index']);
    Route::post('/erp/bank-mutations/sync', [ErpManualBankMutationController::class, 'sync']);
    Route::post('/erp/expenses/sync', [ErpExpenseLedgerController::class, 'sync']);
    Route::get('/erp/expenses', [ErpExpenseLedgerController::class, 'index']);
    Route::get('/erp/expenses/bi-summary', [ErpExpenseLedgerController::class, 'biSummary']);
    Route::post('/erp/opening-balances', [ErpOpeningBalanceController::class, 'store'])->middleware('role:owner,superadmin,admin');

    // Closing Harian (ledger ERP)
    // Nomor invoice/booking dialokasikan server saat submit
    Route::post('/pos/next-document', [PosDocumentController::class, 'next']);
    Route::get('/pickups', [PickupController::class, 'index']);
    Route::get('/pickups/couriers', [PickupController::class, 'couriers']);
    Route::get('/pickups/trackers', [PickupController::class, 'trackerStatus']);
    Route::post('/pickups/couriers/{userId}/tracker', [PickupController::class, 'trackerToken']);
    Route::post('/pickups', [PickupController::class, 'store']);
    Route::get('/pickups/{pickup}', [PickupController::class, 'show']);
    Route::post('/pickups/{pickup}/start', [PickupController::class, 'start']);
    Route::post('/pickups/{pickup}/location', [PickupController::class, 'location']);
    Route::post('/pickups/{pickup}/deliver', [PickupController::class, 'deliver']);
    Route::post('/pickups/{pickup}/complete', [PickupController::class, 'complete']);
    Route::post('/pickups/{pickup}/cancel', [PickupController::class, 'cancel']);
    Route::post('/pickups/{pickup}/reset-pin', [PickupController::class, 'resetPin']);

    Route::get('/closing/day', [ClosingDailyController::class, 'day']);
    Route::get('/closing/history', [ClosingDailyController::class, 'history']);
    Route::post('/closing', [ClosingDailyController::class, 'save']);
    Route::post('/closing/{date}/reopen', [ClosingDailyController::class, 'reopen'])->middleware('role:owner,superadmin');
    // Gantungan (catatan Rp di luar laci saat closing)
    Route::get('/gantungan', [GantunganController::class, 'index']);
    Route::post('/gantungan', [GantunganController::class, 'store']);
    Route::post('/gantungan/import-legacy', [GantunganController::class, 'importLegacy']);
    Route::post('/gantungan/pay-person', [GantunganController::class, 'payPerson']);
    Route::post('/gantungan/{gantungan}/pay', [GantunganController::class, 'pay']);
    Route::post('/gantungan/{gantungan}/settle', [GantunganController::class, 'settle']);
    Route::delete('/gantungan/{gantungan}', [GantunganController::class, 'destroy'])->middleware('role:owner,superadmin,admin');
    // Penanam Saham (investor) + riwayat modal
    Route::get('/investors', [InvestorController::class, 'index']);
    Route::post('/investors', [InvestorController::class, 'store'])->middleware('role:owner,superadmin,admin');
    Route::post('/investors/import-legacy', [InvestorController::class, 'importLegacy'])->middleware('role:owner,superadmin,admin');
    Route::put('/investors/{investor}', [InvestorController::class, 'update'])->middleware('role:owner,superadmin,admin');
    Route::delete('/investors/{investor}', [InvestorController::class, 'destroy'])->middleware('role:owner,superadmin');
    Route::post('/investors/{investor}/capital', [InvestorController::class, 'capitalStore'])->middleware('role:owner,superadmin,admin');
    Route::delete('/investors/{investor}/capital/{movement}', [InvestorController::class, 'capitalDestroy'])->middleware('role:owner,superadmin');

    Route::get('/theme', [ThemeController::class, 'show']);
    Route::post('/theme', [ThemeController::class, 'save'])->middleware('role:owner,superadmin,admin');

    Route::get('/data-reset/summary', [DataResetController::class, 'summary'])->middleware('role:owner,superadmin');
    Route::post('/data-reset', [DataResetController::class, 'reset'])->middleware('role:owner,superadmin');

    Route::post('/backups/restore-upload', [BackupController::class, 'restoreUpload'])->middleware('role:owner,superadmin');
    Route::post('/backups/{backupLog}/restore', [BackupController::class, 'restore'])->middleware('role:owner,superadmin');

    Route::get('/backups/settings', [BackupController::class, 'settings'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/backups/settings', [BackupController::class, 'saveSettings'])->middleware('role:owner,superadmin,admin');
    Route::post('/backups/test-path', [BackupController::class, 'testPath'])->middleware('role:owner,superadmin,admin');
    Route::post('/backups/{backupLog}/verify', [BackupController::class, 'verify'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/backups', [BackupController::class, 'index'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/backups/run', [BackupController::class, 'run'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/backups/{backupLog}/download', [BackupController::class, 'download'])->middleware('role:owner,superadmin,admin,supervisor');

    // Almara Regulatory AI - pusat dokumen regulasi
    Route::get('/regulatory-documents', [RegulatoryDocumentController::class, 'index']);
    Route::post('/regulatory-documents', [RegulatoryDocumentController::class, 'store'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/regulatory-documents/{regulatoryDocument}', [RegulatoryDocumentController::class, 'show']);
    Route::get('/regulatory-documents/{regulatoryDocument}/download', [RegulatoryDocumentController::class, 'download']);
    Route::put('/regulatory-documents/{regulatoryDocument}', [RegulatoryDocumentController::class, 'update'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/regulatory-documents/{regulatoryDocument}/reindex', [RegulatoryDocumentController::class, 'reindex'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::post('/regulatory-documents/{regulatoryDocument}/summarize', [RegulatoryDocumentController::class, 'summarize'])->middleware(['role:owner,superadmin,admin,supervisor', 'throttle:10,1']);
    Route::delete('/regulatory-documents/{regulatoryDocument}', [RegulatoryDocumentController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/regulatory-chat/status', [RegulatoryChatController::class, 'status']);
    Route::post('/regulatory-chat', [RegulatoryChatController::class, 'ask'])->middleware(['role:owner,superadmin,admin,supervisor', 'throttle:30,1']);
    Route::get('/letter-numbers/settings', [LetterNumberController::class, 'settings']);
    Route::post('/letter-numbers/settings', [LetterNumberController::class, 'saveSettings'])->middleware('role:owner,superadmin,admin');
    Route::get('/letter-numbers/records', [LetterNumberController::class, 'index']);
    Route::get('/letter-numbers/preview', [LetterNumberController::class, 'preview']);
    Route::post('/letter-numbers/next', [LetterNumberController::class, 'next']);
    Route::get('/letter-numbers/documents/{documentId}/preview', [LetterNumberController::class, 'previewDocument']);
    Route::get('/letter-numbers/documents/{documentId}/download', [LetterNumberController::class, 'downloadDocument']);
    Route::get('/letter-numbers/records/{id}', [LetterNumberController::class, 'documents']);
    Route::post('/letter-numbers/records/{id}/documents', [LetterNumberController::class, 'uploadDocument']);
    Route::put('/letter-numbers/records/{id}', [LetterNumberController::class, 'updateRecord'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/letter-numbers/documents/{documentId}', [LetterNumberController::class, 'deleteDocument'])->middleware('role:owner,superadmin,admin,supervisor');
});

Route::get('/public/currencies', [App\Http\Controllers\CurrencyController::class, 'index']);
