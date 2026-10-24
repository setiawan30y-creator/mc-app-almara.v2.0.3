<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mc_backup_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('mc_backup_settings', 'storage_path')) {
                $table->string('storage_path', 500)->nullable()->after('timezone');
            }
            if (!Schema::hasColumn('mc_backup_settings', 'secondary_path')) {
                $table->string('secondary_path', 500)->nullable()->after('storage_path');
            }
            if (!Schema::hasColumn('mc_backup_settings', 'include_uploads')) {
                $table->boolean('include_uploads')->default(true)->after('secondary_path');
            }
            if (!Schema::hasColumn('mc_backup_settings', 'keep_min_backups')) {
                $table->unsignedSmallInteger('keep_min_backups')->default(7)->after('include_uploads');
            }
            if (!Schema::hasColumn('mc_backup_settings', 'alert_after_hours')) {
                $table->unsignedSmallInteger('alert_after_hours')->default(26)->after('keep_min_backups');
            }
        });
    }

    public function down(): void
    {
        Schema::table('mc_backup_settings', function (Blueprint $table) {
            foreach (['storage_path', 'secondary_path', 'include_uploads', 'keep_min_backups', 'alert_after_hours'] as $column) {
                if (Schema::hasColumn('mc_backup_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
