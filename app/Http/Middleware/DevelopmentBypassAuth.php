<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DevelopmentBypassAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        // Never allow this mechanism outside a local development environment.
        $enabled = app()->environment('local')
            && (bool) config('app.dev_bypass_auth', false);

        if (!$enabled) {
            return $next($request);
        }

        $devUser = [
            'username' => 'admin',
            'full_name' => 'Administrator',
            'role' => 'owner',
        ];

        $request->attributes->set('dev_user', $devUser);

        $response = $next($request);

        // The dashboard currently initializes its UI authentication from
        // localStorage. Seed the same shape before its scripts execute.
        if (
            $response->headers->get('Content-Type')
            && str_contains($response->headers->get('Content-Type'), 'text/html')
        ) {
            $content = $response->getContent();
            $bootstrap = <<<'HTML'
<script>
(function () {
    try {
        localStorage.setItem('mc_currentUser', JSON.stringify({
            username: 'admin',
            fullName: 'Administrator',
            role: 'owner'
        }));
    } catch (e) {}
})();
</script>
HTML;
            $content = str_replace('</head>', $bootstrap . "\n</head>", $content);
            $response->setContent($content);
        }

        return $response;
    }
}
