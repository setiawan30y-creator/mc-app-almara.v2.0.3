<?php

use App\Http\Controllers\ErpPaymentController;
use Illuminate\Support\Facades\Route;

Route::post('/transactions/{transactionId}/payments', [ErpPaymentController::class, 'store'])
    ->name('erp.transactions.payments.store');
