/**
 * UI Diagnostics Utility
 * Provides monitoring tools for debugging UI unresponsiveness.
 * 
 * Enable by calling `window.enableDiagnostics()` in the console.
 * Disable by calling `window.disableDiagnostics()`.
 */

import { supabase } from './supabase.js';

// --- STATE ---
let diagnosticsEnabled = false;
let heartbeatInterval = null;
let sessionWatchdogInterval = null;
let longTaskObserver = null;

// Tracking Counters
let listenerCount = 0;
let intervalCount = 0;
let timeoutCount = 0;
const activeIntervals = new Map();
const activeTimeouts = new Map();

// --- SHIMS (Applied on Enable) ---
const originalSetInterval = window.setInterval;
const originalClearInterval = window.clearInterval;
const originalSetTimeout = window.setTimeout;
const originalClearTimeout = window.clearTimeout;
const originalAddEventListener = EventTarget.prototype.addEventListener;
const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

function shimmedSetInterval(fn, ms, ...args) {
    intervalCount++;
    const id = originalSetInterval.call(window, fn, ms, ...args);
    const stack = new Error().stack.split('\n').slice(2, 4).join(' | ');
    activeIntervals.set(id, { ms, stack, createdAt: Date.now() });
    console.log(`[DIAG] setInterval created: ID=${id}, ms=${ms}. Active: ${activeIntervals.size}`, stack);
    return id;
}

function shimmedClearInterval(id) {
    if (activeIntervals.has(id)) {
        activeIntervals.delete(id);
        console.log(`[DIAG] clearInterval: ID=${id}. Active: ${activeIntervals.size}`);
    }
    return originalClearInterval.call(window, id);
}

function shimmedSetTimeout(fn, ms, ...args) {
    timeoutCount++;
    const id = originalSetTimeout.call(window, fn, ms, ...args);
    activeTimeouts.set(id, { ms, createdAt: Date.now() });
    // Don't log every timeout, too noisy. Track only.
    return id;
}

function shimmedClearTimeout(id) {
    activeTimeouts.delete(id);
    return originalClearTimeout.call(window, id);
}

function shimmedAddEventListener(type, listener, options) {
    listenerCount++;
    // Only log for common culprits
    if (['click', 'change', 'input', 'scroll', 'resize'].includes(type)) {
        // Avoid logging shim itself
    }
    return originalAddEventListener.call(this, type, listener, options);
}

function shimmedRemoveEventListener(type, listener, options) {
    listenerCount--;
    return originalRemoveEventListener.call(this, type, listener, options);
}

// --- HEARTBEAT ---
function startHeartbeat() {
    heartbeatInterval = originalSetInterval.call(window, () => {
        const heap = performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : 'N/A';
        const domNodes = document.getElementsByTagName('*').length;
        console.log(`[DIAG HEARTBEAT] Heap: ${heap} MB | DOM Nodes: ${domNodes} | Listeners: ~${listenerCount} | Intervals: ${activeIntervals.size} | Timeouts: ${activeTimeouts.size}`);
    }, 30000); // Every 30 seconds
}

// --- SESSION WATCHDOG ---
function startSessionWatchdog() {
    sessionWatchdogInterval = originalSetInterval.call(window, async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                console.warn(`[DIAG SESSION] ⚠️ Session invalid or expired!`, error);
            } else {
                console.log(`[DIAG SESSION] ✅ Session valid. Expires: ${new Date(session.expires_at * 1000).toLocaleTimeString()}`);
            }
        } catch (e) {
            console.error(`[DIAG SESSION] ❌ Error checking session:`, e);
        }
    }, 60000); // Every 60 seconds
}

// --- LONG TASK OBSERVER ---
function startLongTaskObserver() {
    if (!window.PerformanceObserver) {
        console.warn('[DIAG] PerformanceObserver not supported in this browser.');
        return;
    }
    try {
        longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.warn(`[DIAG LONG TASK] ⏱️ Duration: ${entry.duration.toFixed(2)}ms`, entry);
            }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        console.log('[DIAG] Long Task Observer started.');
    } catch (e) {
        console.warn('[DIAG] Could not start Long Task Observer:', e.message);
    }
}

// --- PUBLIC API ---
export function enableDiagnostics() {
    if (diagnosticsEnabled) {
        console.log('[DIAG] Diagnostics already enabled.');
        return;
    }

    console.log('%c[DIAG] 🔬 Enabling UI Diagnostics...', 'color: green; font-weight: bold;');

    // Apply Shims
    window.setInterval = shimmedSetInterval;
    window.clearInterval = shimmedClearInterval;
    window.setTimeout = shimmedSetTimeout;
    window.clearTimeout = shimmedClearTimeout;
    EventTarget.prototype.addEventListener = shimmedAddEventListener;
    EventTarget.prototype.removeEventListener = shimmedRemoveEventListener;

    // Start Monitors
    startHeartbeat();
    startSessionWatchdog();
    startLongTaskObserver();

    diagnosticsEnabled = true;
    console.log('[DIAG] ✅ Diagnostics enabled. Heartbeat every 30s. Session check every 60s.');
}

export function disableDiagnostics() {
    if (!diagnosticsEnabled) {
        console.log('[DIAG] Diagnostics not enabled.');
        return;
    }

    console.log('%c[DIAG] 🛑 Disabling UI Diagnostics...', 'color: red; font-weight: bold;');

    // Restore Original Functions
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    EventTarget.prototype.addEventListener = originalAddEventListener;
    EventTarget.prototype.removeEventListener = originalRemoveEventListener;

    // Stop Monitors
    if (heartbeatInterval) originalClearInterval.call(window, heartbeatInterval);
    if (sessionWatchdogInterval) originalClearInterval.call(window, sessionWatchdogInterval);
    if (longTaskObserver) longTaskObserver.disconnect();

    heartbeatInterval = null;
    sessionWatchdogInterval = null;
    longTaskObserver = null;

    diagnosticsEnabled = false;
    console.log('[DIAG] ✅ Diagnostics disabled.');
}

export function getDiagnosticsReport() {
    return {
        enabled: diagnosticsEnabled,
        listeners: listenerCount,
        activeIntervals: Array.from(activeIntervals.entries()),
        activeTimeouts: activeTimeouts.size,
        heapMB: performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : 'N/A',
        domNodes: document.getElementsByTagName('*').length
    };
}

// Expose to window for easy console access
window.enableDiagnostics = enableDiagnostics;
window.disableDiagnostics = disableDiagnostics;
window.getDiagnosticsReport = getDiagnosticsReport;

console.log('[DIAG] 📦 Diagnostics module loaded. Run `enableDiagnostics()` in console to start.');
