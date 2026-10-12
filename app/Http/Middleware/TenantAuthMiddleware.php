<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $tenant = $request->attributes->get('tenant');

        if (!$user) {
            abort(401, 'Anda harus login terlebih dahulu.');
        }

        if (!$tenant) {
            abort(404, 'Tenant tidak ditemukan pada subdomain ini.');
        }

        if ($user->tenant_id !== $tenant->id) {
            abort(403, 'Akun tidak memiliki akses ke tenant ini.');
        }

        if (!$tenant->branches()->where('id', $user->branch_id)->where('status', 'active')->exists()) {
            abort(403, 'Cabang akun tidak berada pada tenant ini atau tidak aktif.');
        }

        return $next($request);
    }
}
