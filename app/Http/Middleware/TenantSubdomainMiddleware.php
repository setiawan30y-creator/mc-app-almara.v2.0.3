<?php

namespace App\Http\Middleware;

use App\Models\TenantDomain;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantSubdomainMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $host = strtolower($request->getHost());

        /*
         * Local:
         *   abc.mc-app-almara.v2.0.2.test
         *
         * Production:
         *   abc.mc-almara.com
         */
        $tenantDomain = TenantDomain::query()
            ->with('tenant')
            ->where('host', $host)
            ->where('status', 'active')
            ->first();

        if ($tenantDomain?->tenant?->status === 'active') {
            $request->attributes->set('tenant', $tenantDomain->tenant);
            $request->attributes->set('tenant_id', $tenantDomain->tenant->id);

            return $next($request);
        }

        /*
         * Main domain remains tenant-neutral.
         * Tenant is resolved after successful login when the
         * application is later opened through a tenant subdomain.
         */
        $request->attributes->set('tenant', null);
        $request->attributes->set('tenant_id', null);

        return $next($request);
    }
}
