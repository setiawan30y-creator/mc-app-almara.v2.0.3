<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
         * ============================================================
         * TENANTS
         * ============================================================
         */
        Schema::create('tenants', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 150);
            $table->string('slug', 80)->unique();
            $table->string('code', 50)->unique();
            $table->string('status', 20)->default('active');

            $table->string('logo_path')->nullable();
            $table->string('primary_color', 20)->nullable();
            $table->string('timezone', 100)->default('Asia/Jakarta');
            $table->string('locale', 10)->default('id');

            $table->timestamps();

            $table->index(['status', 'slug']);
        });

        /*
         * ============================================================
         * BRANCHES
         * ============================================================
         */
        Schema::create('branches', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('tenant_id');

            $table->string('name', 150);
            $table->string('code', 50);
            $table->string('status', 20)->default('active');

            $table->string('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('phone', 50)->nullable();

            $table->timestamps();

            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->cascadeOnDelete();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'status']);
        });

        /*
         * ============================================================
         * TENANT DOMAINS
         * ============================================================
         *
         * type:
         * - subdomain
         * - custom
         */
        Schema::create('tenant_domains', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('tenant_id');

            $table->string('host', 255)->unique();
            $table->string('type', 20)->default('subdomain');
            $table->boolean('is_primary')->default(true);
            $table->string('status', 20)->default('active');

            $table->timestamps();

            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->cascadeOnDelete();

            $table->index(['tenant_id', 'status']);
        });

        /*
         * ============================================================
         * TENANT SETTINGS
         * ============================================================
         */
        Schema::create('tenant_settings', function (Blueprint $table) {
            $table->id();
            $table->ulid('tenant_id')->unique();

            $table->string('company_name', 150)->nullable();
            $table->string('company_short_name', 100)->nullable();

            $table->string('npwp', 50)->nullable();
            $table->string('license_number', 100)->nullable();

            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('country', 100)->default('Indonesia');

            $table->string('phone', 50)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('website', 255)->nullable();

            $table->string('logo_path')->nullable();
            $table->string('favicon_path')->nullable();

            $table->string('timezone', 100)->default('Asia/Jakarta');
            $table->string('locale', 10)->default('id');
            $table->string('default_currency', 10)->default('IDR');

            $table->text('receipt_header')->nullable();
            $table->text('receipt_footer')->nullable();

            $table->timestamps();

            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->cascadeOnDelete();
        });

        /*
         * ============================================================
         * USERS -> TENANT / BRANCH
         * ============================================================
         */
        Schema::table('users', function (Blueprint $table) {
            $table->ulid('tenant_id')
                ->nullable()
                ->after('id');

            $table->ulid('branch_id')
                ->nullable()
                ->after('tenant_id');

            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->nullOnDelete();

            $table->foreign('branch_id')
                ->references('id')
                ->on('branches')
                ->nullOnDelete();

            $table->index(['tenant_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropForeign(['tenant_id']);
            $table->dropIndex(['tenant_id', 'branch_id']);
            $table->dropColumn(['tenant_id', 'branch_id']);
        });

        Schema::dropIfExists('tenant_settings');
        Schema::dropIfExists('tenant_domains');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('tenants');
    }
};
