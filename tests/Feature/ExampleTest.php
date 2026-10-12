<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200)
            ->assertSee('ALMARA PUTRA VALASINDO');
    }

    public function test_transactions_endpoint_validates_required_payload(): void
    {
        $user = User::create([
            'id' => 'u_test',
            'username' => 'owner',
            'full_name' => 'Master Owner',
            'password' => 'secret123',
            'role' => 'owner',
        ]);

        $response = $this->actingAs($user)->postJson('/api/transactions', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['id', 'timestamp', 'tipe', 'valuta']);
    }

    public function test_transactions_endpoint_requires_login(): void
    {
        $this->postJson('/api/transactions', [])->assertUnauthorized();
    }

    public function test_database_login_returns_public_user_profile(): void
    {
        User::create([
            'id' => 'u_owner',
            'username' => 'owner',
            'full_name' => 'Master Owner',
            'password' => 'owner123',
            'role' => 'owner',
        ]);

        $response = $this->postJson('/login', [
            'username' => 'owner',
            'password' => 'owner123',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('user.username', 'owner')
            ->assertJsonMissing(['password' => 'owner123']);
    }
}
