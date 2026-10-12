<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goaml_rules', function (Blueprint $table) {
            $table->string('regulation_source', 80)->nullable()->after('rule_type');
            $table->string('regulation_no', 120)->nullable()->after('regulation_source');
            $table->string('regulation_article', 120)->nullable()->after('regulation_no');
            $table->date('effective_from')->nullable()->after('regulation_article');
            $table->date('effective_until')->nullable()->after('effective_from');
            $table->string('result_type', 40)->default('COMPLIANCE_REVIEW')->after('action');
            $table->text('internal_note')->nullable()->after('conditions');
        });

        Schema::table('goaml_alerts', function (Blueprint $table) {
            $table->string('result_type', 40)->default('COMPLIANCE_REVIEW')->after('rule_type');
            $table->string('invoice_summary', 1000)->nullable()->after('transaction_count');
        });
    }

    public function down(): void
    {
        Schema::table('goaml_alerts', function (Blueprint $table) {
            $table->dropColumn(['result_type', 'invoice_summary']);
        });

        Schema::table('goaml_rules', function (Blueprint $table) {
            $table->dropColumn([
                'regulation_source',
                'regulation_no',
                'regulation_article',
                'effective_from',
                'effective_until',
                'result_type',
                'internal_note',
            ]);
        });
    }
};
