<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Support\SessionPolicy;
use Symfony\Component\HttpFoundation\Response;

class EnsureSingleSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        if ($expired = $this->rejectIfIdle($request, $user)) {
            return $expired;
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

    /**
     * Logout otomatis bila tidak ada aktivitas pengguna melebihi batas kebijakan.
     * Aktivitas dicatat lewat POST /api/session/ping (bukan polling sinkronisasi).
     */
    private function rejectIfIdle(Request $request, $user): ?Response
    {
        $limit = SessionPolicy::idleSecondsFor($user->role ?? '');
        $now = time();
        $last = (int) $request->session()->get('mc_last_activity', 0);

        if ($last === 0) {
            $request->session()->put('mc_last_activity', $now);
            return null;
        }

        if ($limit === 0 || ($now - $last) <= $limit + SessionPolicy::GRACE_SECONDS) {
            return null;
        }

        $sessionKeyName = 'mc_active_session_token';
        if (Schema::hasColumn('users', 'active_session_token')) {
            $sessionToken = (string) $request->session()->get($sessionKeyName, '');
            if ($sessionToken !== '' && hash_equals((string) ($user->active_session_token ?? ''), $sessionToken)) {
                $user->forceFill(['active_session_token' => null])->save();
            }
        }

        Auth::guard('web')->logout();
        $request->session()->forget([$sessionKeyName, 'mc_last_activity']);
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $isApiRequest = $request->expectsJson() || $request->ajax() || $request->is('api/*');
        if (!$isApiRequest) {
            return redirect()->route('login.form');
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.',
            'code' => 'session_idle_timeout',
        ], 401);
    }
}
