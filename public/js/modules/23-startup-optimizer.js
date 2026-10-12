/*
 * Almara startup optimizer
 * Keeps DOMContentLoaded and first interaction free from bulk datastore sync.
 * It does not remove data sync; it moves the initial background work until the
 * browser has had a chance to paint and become interactive.
 */
(function () {
    'use strict';

    if (window.__almaraStartupOptimizerInstalled) return;
    window.__almaraStartupOptimizerInstalled = true;

    var names = [
        'syncFromMySQL_Currencies',
        'syncFromMySQL_Customers',
        'syncFromMySQL_Transactions',
        'syncUniversalDatastore'
    ];

    var originals = {};
    var queued = {};

    function scheduleIdle(fn, delay) {
        var run = function () {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(function () { fn(); }, { timeout: 1500 });
            } else {
                setTimeout(fn, 0);
            }
        };
        setTimeout(run, delay || 0);
    }

    function installWrappers() {
        names.forEach(function (name) {
            if (typeof window[name] !== 'function' || originals[name]) return;
            originals[name] = window[name];

            window[name] = function () {
                var args = arguments;

                if (window.__almaraStartupUnlocked) {
                    return originals[name].apply(this, args);
                }

                // The first startup call is intentionally skipped. One background
                // refresh is queued for after the UI is interactive instead.
                if (!queued[name]) {
                    queued[name] = true;
                    scheduleIdle(function () {
                        if (!window.__almaraStartupUnlocked) return;
                        try { originals[name].apply(window, args); } catch (e) { console.warn('[StartupOptimizer]', name, e); }
                    }, 3500);
                }

                return Promise.resolve();
            };
        });
    }

    installWrappers();

    // Stop the  realtime timer during first paint. The optimizer will restart it
    // after the startup window if the sync module exposes its public starter.
    try {
        if (typeof window.stopAlmaraRealtimeSync === 'function') {
            window.stopAlmaraRealtimeSync();
        }
    } catch (e) {}

    // DOMContentLoaded listeners from sync.js are already registered by the time
    // this deferred script executes. Unlock before DOMContentLoaded is dispatched.
    var unlock = function () {
        if (window.__almaraStartupUnlocked) return;
        window.__almaraStartupUnlocked = true;

        if (typeof window.startAlmaraRealtimeSync === 'function') {
            scheduleIdle(function () {
                try { window.startAlmaraRealtimeSync(); } catch (e) { console.warn('[StartupOptimizer] realtime restart failed', e); }
            }, 9000);
        }

        console.info('[StartupOptimizer] first paint protected; background sync deferred.');
    };

    // Give the browser a short first-paint window, then unlock the normal sync API.
    setTimeout(unlock, 1800);
    window.addEventListener('load', unlock, { once: true });
})();
