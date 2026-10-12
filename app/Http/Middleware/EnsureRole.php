<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $role = strtolower((string) ($user?->role ?? ''));
        $allowed = array_map(fn ($item) => strtolower(trim($item)), $roles);

        abort_unless($user && in_array($role, $allowed, true), 403, 'Akses tidak diizinkan untuk role ini.');

        return $next($request);
    }
}
