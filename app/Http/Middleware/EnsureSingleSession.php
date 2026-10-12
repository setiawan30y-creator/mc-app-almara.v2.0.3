<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureSingleSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        if (!Schema::hasColumn('users', 'active_session_token')) {
            return $next($request);
        }

        $sessionKeyName = 'mc_active_session_token';
        $sessionToken = (string) $request->session()->get($sessionKeyName, '');
        $activeToken = (string) ($user->active_session_token ?? '');

        if ($activeToken === '') {
            $sessionToken = $sessionToken !== '' ? $sessionToken : Str::random(64);
            $request->session()->put($sessionKeyName, $sessionToken);
            $user->forceFill(['active_session_token' => $sessionToken])->save();
            return $next($request);
        }

        if ($sessionToken === '') {
            $sessionToken = (string) $request->session()->getId();
            $request->session()->put($sessionKeyName, $sessionToken);
        }

        if (!hash_equals($activeToken, $sessionToken)) {
            Auth::guard('web')->logout();
            $request->session()->forget($sessionKeyName);
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            // API/AJAX requests must not return 423 here because the dashboard
            // fetch interceptor treats 423 as a single-session conflict and
            // reloads the page. That creates an endless reload loop when an
            // old browser tab/session is still active. Return 401 so the
            // dashboard can perform its existing silent re-login flow.
            $isApiRequest = $request->expectsJson()
                || $request->ajax()
                || $request->is('api/*');

            return response()->json([
                'status' => 'error',
                'message' => 'Sesi login sudah tidak aktif. Silakan autentikasi kembali.',
                'code' => 'single_session_conflict',
            ], $isApiRequest ? 401 : 423);
        }

        return $next($request);
    }
}
