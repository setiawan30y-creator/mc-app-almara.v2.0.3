<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $old = DB::table('goaml_rules')->where('code', 'IM-CUSTOMER-3TX-7D-500M')->first();

        if ($old) {
            DB::table('goaml_rules')
                ->where('id', $old->id)
                ->update([
                    'name' => 'Monitoring LTKM Internal - JUAL > Rp500 Juta / 3 Hari',
                    'code' => 'IM-LTKM-CUSTOMER-JUAL-3D-500M',
                    'rule_type' => 'INTERNAL_MONITORING',
                    'classification' => 'INTERNAL_WARNING',
                    'severity' => 'WARNING',
                    'action' => 'REVIEW',
                    'min_transactions' => null,
                    'period_days' => 3,
                    'total_amount_idr' => 500000000,
                    'amount_operator' => '>',
                    'conditions' => json_encode([
                        'logic' => 'AND',
                        'aggregation' => 'CUSTOMER',
                        'amount_basis' => 'IDR_TOTAL',
                        'transaction_type' => 'JUAL',
                    ]),
                    'is_active' => true,
                    'priority' => 100,
                    'version' => ((int) $old->version) + 1,
                    'updated_at' => now(),
                ]);

            $existing = DB::table('goaml_rules')->where('code', 'IM-LTKM-CUSTOMER-BELI-3D-500M')->first();

            if (!$existing) {
                DB::table('goaml_rules')->insert([
                    'name' => 'Monitoring LTKM Internal - BELI > Rp500 Juta / 3 Hari',
                    'code' => 'IM-LTKM-CUSTOMER-BELI-3D-500M',
                    'rule_type' => 'INTERNAL_MONITORING',
                    'target' => 'CUSTOMER',
                    'classification' => 'INTERNAL_WARNING',
                    'severity' => 'WARNING',
                    'action' => 'REVIEW',
                    'result_type' => 'LTKM',
                    'min_transactions' => null,
                    'period_days' => 3,
                    'total_amount_idr' => 500000000,
                    'amount_operator' => '>',
                    'payment_method' => null,
                    'conditions' => json_encode([
                        'logic' => 'AND',
                        'aggregation' => 'CUSTOMER',
                        'amount_basis' => 'IDR_TOTAL',
                        'transaction_type' => 'BELI',
                    ]),
                    'is_active' => true,
                    'priority' => 101,
                    'version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('goaml_rules')->where('id', $old->id)->update(['result_type' => 'LTKM']);
        }
    }

    public function down(): void
    {
        DB::table('goaml_rules')->where('code', 'IM-LTKM-CUSTOMER-BELI-3D-500M')->delete();

        DB::table('goaml_rules')
            ->where('code', 'IM-LTKM-CUSTOMER-JUAL-3D-500M')
            ->update([
                'name' => 'Monitoring 3 Transaksi / 7 Hari > Rp500 Juta',
                'code' => 'IM-CUSTOMER-3TX-7D-500M',
                'min_transactions' => 3,
                'period_days' => 7,
                'conditions' => json_encode([
                    'logic' => 'AND',
                    'aggregation' => 'CUSTOMER',
                    'amount_basis' => 'IDR_TOTAL',
                ]),
                'result_type' => 'COMPLIANCE_REVIEW',
                'version' => 1,
                'updated_at' => now(),
            ]);
    }
};
