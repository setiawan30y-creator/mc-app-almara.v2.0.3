<?php

namespace App\Services;

class DashboardService
{
    public function summary(): array
    {
        return [
            'total_valuta'      => 0,
            'today_profit'      => 0,
            'total_customer'    => 0,
            'total_transaction' => 0,
        ];
    }
}