<?php

namespace App\Http\Controllers;

use App\Models\TenantDomain;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function showLogin(Request $request)
    {
        return view('auth.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('username', $credentials['username'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return $this->loginError($request, 'Username atau password salah.');
        }

        $host = strtolower($request->getHost());
        $tenantDomain = TenantDomain::query()
            ->with('tenant')
            ->where('host', $host)
            ->where('status', 'active')
            ->first();

        /*
         * Subdomain is the authoritative tenant context.
         * A user assigned to another tenant cannot log in through
         * this tenant's hostname.
         */
        if ($tenantDomain?->tenant) {
            if ($user->tenant_id === null || $user->tenant_id !== $tenantDomain->tenant->id) {
                return $this->loginError($request, 'Akun tidak memiliki akses ke workspace tenant ini.');
            }

            if (
                $user->branch_id === null ||
                !$tenantDomain->tenant->branches()
                    ->where('id', $user->branch_id)
                    ->where('status', 'active')
                    ->exists()
            ) {
                return $this->loginError($request, 'Cabang akun tidak aktif atau tidak berada pada tenant ini.');
            }
        } elseif ($user->tenant_id !== null) {
            /*
             * Existing/local mode: allow the legacy main domain while
             * tenant migration is being rolled out.
             */
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        $sessionToken = Str::random(64);
        $request->session()->put('mc_active_session_token', $sessionToken);

        if (Schema::hasColumn('users', 'active_session_token')) {
            $user->forceFill([
                'active_session_token' => $sessionToken,
            ])->save();
        }

        return response()->json([
            'status' => 'success',
            'user' => $user->publicProfile(),
            'tenant' => $tenantDomain?->tenant?->only(['id', 'name', 'slug', 'code', 'status']),
            'redirect' => url('/'),
            'csrfToken' => csrf_token(),
        ]);
    }

    protected function loginError(Request $request, string $message)
    {
        if ($request->expectsJson()) {
            return response()->json([
                'status' => 'error',
                'message' => $message,
            ], 422);
        }

        return back()
            ->withErrors(['username' => $message])
            ->withInput($request->only('username'));
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $sessionToken = (string) $request->session()->get('mc_active_session_token', '');

        if (
            $user &&
            Schema::hasColumn('users', 'active_session_token') &&
            $sessionToken !== '' &&
            hash_equals((string) ($user->active_session_token ?? ''), $sessionToken)
        ) {
            $user->forceFill(['active_session_token' => null])->save();
        }

        Auth::guard('web')->logout();
        $request->session()->forget('mc_active_session_token');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson()) {
            return response()->json(['status' => 'success']);
        }

        return redirect()->route('login.form');
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'status' => 'success',
            'user' => $user?->publicProfile(),
            'tenant' => $user?->tenant?->only(['id', 'name', 'slug', 'code', 'status']),
            'branch' => $user?->branch?->only(['id', 'tenant_id', 'name', 'code', 'status']),
            'csrfToken' => csrf_token(),
        ]);
    }

    public function users()
    {
        return response()->json([
            'status' => 'success',
            'data' => User::orderBy('role')->orderBy('username')->get()->map->publicProfile()->values(),
        ]);
    }

    public function saveUser(Request $request)
    {
        $actor = $request->user();
        $isOwner = $actor && strtolower((string) $actor->role) === 'owner';
        $isSuperAdmin = $actor && strtolower((string) $actor->role) === 'superadmin';

        abort_unless($isOwner || $isSuperAdmin, 403, 'Hanya owner atau superadmin yang boleh mengelola pengguna.');

        $id = $request->input('id');
        $validated = $request->validate([
            'id' => ['nullable', 'string', 'max:50'],
            'username' => ['required', 'string', 'max:100'],
            'fullName' => ['required', 'string', 'max:150'],
            'role' => ['required', 'string', 'max:50'],
            'photo' => ['nullable', 'string', 'max:500'],
            'password' => [$id ? 'nullable' : 'required', 'string', 'min:4', 'max:255'],
        ]);

        if ($id) {
            $user = User::findOrFail($id);
        } else {
            $user = new User([
                'id' => 'u_' . now()->format('YmdHis') . '_' . substr(md5((string) microtime(true)), 0, 6),
            ]);
        }

        $user->username = $validated['username'];
        $user->full_name = $validated['fullName'];
        $user->role = $validated['role'];
        $user->photo = $validated['photo'] ?? $user->photo;

        if (!$id && $actor?->tenant_id) {
            $user->tenant_id = $actor->tenant_id;
            $user->branch_id = $actor->branch_id;
        }

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return response()->json([
            'status' => 'success',
            'user' => $user->publicProfile(),
        ]);
    }

    public function updateMe(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'fullName' => ['required', 'string', 'max:150'],
            'photo' => ['nullable', 'string', 'max:500'],
            'password' => ['nullable', 'string', 'min:6', 'max:255'],
        ]);

        $user->username = $validated['username'];
        $user->full_name = $validated['fullName'];
        $user->photo = $validated['photo'] ?? $user->photo;

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return response()->json([
            'status' => 'success',
            'user' => $user->publicProfile(),
        ]);
    }
}
