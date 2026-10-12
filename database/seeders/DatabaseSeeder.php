<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(['id' => 'u1'], [
            'username' => 'owner',
            'full_name' => 'Master Owner',
            'password' => Hash::make('owner123'),
            'role' => 'owner',
        ]);
    }
}
