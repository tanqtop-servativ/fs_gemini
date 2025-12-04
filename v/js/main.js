import { supabase } from './supabase.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCalendar } from './views/calendar.js';
import { renderProperties } from './views/properties.js';
import { renderPeople } from './views/people.js';
import { renderBOM } from './views/bom.js';
import { renderRoles } from './views/roles.js';
import { renderJobTemplates } from './views/job_templates.js';
import { renderServiceOpportunities } from './views/service_opportunities.js';
import { renderSuperuserDashboard } from './views/superuser.js';

import { renderActivityFeed } from './views/activity_feed.js';

// --- STATE ---
window.currentUser = null;

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Horizon Board', icon: 'trello' },
    { id: 'activity', label: 'Activity Feed', icon: 'list' }, // New Item
    { id: 'service_opportunities', label: 'Service Ops', icon: 'git-branch' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { type: 'separator' },
    { id: 'people', label: 'People', icon: 'users' },
    { id: 'roles', label: 'Roles', icon: 'shield' },
    { id: 'properties', label: 'Properties', icon: 'home' },
    { id: 'job_templates', label: 'Job Templates', icon: 'clipboard-check' },
    { id: 'bom', label: 'BOM Templates', icon: 'clipboard-list' },
    { type: 'separator' },
    { id: 'superuser', label: 'Superuser', icon: 'lock' },
];

const ROUTES = {
    'dashboard': renderDashboard,
    'activity': renderActivityFeed, // New Route
    'calendar': renderCalendar,
    'properties': renderProperties,
    'people': renderPeople,
    'roles': renderRoles,
    'bom': renderBOM,
    'job_templates': renderJobTemplates,
    'service_opportunities': renderServiceOpportunities,
    'superuser': renderSuperuserDashboard
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Starting...");
    initApp();

    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('hidden');
            document.getElementById('sidebar').classList.toggle('flex');
        });
    }

    const passInput = document.getElementById('login-password');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.attemptLogin();
        });
    }
});

// --- AUTH ---
async function initApp() {
    // 1. Check for existing session
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        await handleSession(session);
    } else {
        renderLogin();
    }

    // --- Password Reset Logic ---
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const loginForm = document.getElementById('login-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const sendResetBtn = document.getElementById('send-reset-btn');
    const resetMessage = document.getElementById('reset-message');
    const updatePasswordForm = document.getElementById('update-password-form');
    const updatePasswordBtn = document.getElementById('update-password-btn');

    // Toggle Forgot Password Form
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            forgotPasswordForm.classList.remove('hidden');
            resetMessage.classList.add('hidden');
        });
    }

    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            forgotPasswordForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            resetMessage.classList.add('hidden');
        });
    }

    // Send Reset Link
    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', async () => {
            const email = document.getElementById('reset-email').value;
            if (!email) return;

            sendResetBtn.disabled = true;
            sendResetBtn.innerText = 'Sending...';

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/v/index.html', // Redirect back to app
            });

            sendResetBtn.disabled = false;
            sendResetBtn.innerText = 'Send Reset Link';

            if (error) {
                resetMessage.innerText = 'Error: ' + error.message;
                resetMessage.classList.remove('text-green-600');
                resetMessage.classList.add('text-red-500');
            } else {
                resetMessage.innerText = 'Check your email for the reset link!';
                resetMessage.classList.remove('text-red-500');
                resetMessage.classList.add('text-green-600');
            }
            resetMessage.classList.remove('hidden');
        });
    }

    // Update Password (after clicking magic link)
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const newPassword = document.getElementById('new-password').value;
            if (!newPassword) return;

            updatePasswordBtn.disabled = true;
            updatePasswordBtn.innerText = 'Updating...';

            const { error } = await supabase.auth.updateUser({ password: newPassword });

            if (error) {
                alert('Error updating password: ' + error.message);
                updatePasswordBtn.disabled = false;
                updatePasswordBtn.innerText = 'Update Password';
            } else {
                alert('Password updated successfully! Logging you in...');
                // Redirect to dashboard
                window.location.href = '/v/index.html';
            }
        });
    }

    // 2. Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth Event:", event);

        if (event === 'PASSWORD_RECOVERY') {
            // Show Update Password Form
            document.getElementById('login-screen').classList.remove('hidden'); // Ensure container is visible
            loginForm.classList.add('hidden');
            forgotPasswordForm.classList.add('hidden');
            updatePasswordForm.classList.remove('hidden');
        } else if (event === 'SIGNED_IN') {
            await handleSession(session);
        } else if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            renderLogin();
        }
    });

    // Login Button Listener
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.attemptLogin();
        });
    }

    // Handle hash routing
    window.addEventListener('hashchange', () => {
        if (window.currentUser) {
            const hash = window.location.hash.slice(1) || 'dashboard';
            navigate(hash);
        }
    });
}

async function handleSession(session) {
    // Fetch profile data (tenant_id, role, etc.)
    // We need to query our 'public.profiles' table
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        console.error("Profile fetch error:", error);
        alert("Error loading user profile. Please contact support.");
        await supabase.auth.signOut();
        return;
    }

    // Construct currentUser object compatible with our app
    window.currentUser = {
        id: session.user.id,
        email: session.user.email,
        tenant_id: profile.tenant_id,
        original_tenant_id: profile.tenant_id, // Keep track of real tenant
        is_superuser: profile.is_superuser,
        first_name: profile.first_name,
        last_name: profile.last_name,
        name: `${profile.first_name} ${profile.last_name}`,
        role: profile.is_superuser ? 'Super Admin' : 'Manager',
        avatar: `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name}&background=random`
    };

    // Check for impersonation in localStorage (only if superuser)
    if (window.currentUser.is_superuser) {
        const impersonatedTenantId = localStorage.getItem('impersonated_tenant_id');
        if (impersonatedTenantId) {
            window.currentUser.tenant_id = parseInt(impersonatedTenantId);
            window.currentUser.is_impersonating = true;
            console.log("🕵️ Impersonating Tenant:", window.currentUser.tenant_id);
        }
    }

    // Fetch Tenant Name
    const { data: tenantData } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', window.currentUser.tenant_id)
        .single();

    window.currentUser.tenant_name = tenantData ? tenantData.name : 'Unknown Tenant';

    showAppShell();
}

// --- IMPERSONATION ---
window.impersonateTenant = function (tenantId) {
    if (!window.currentUser || !window.currentUser.is_superuser) return;

    if (tenantId) {
        localStorage.setItem('impersonated_tenant_id', tenantId);
    } else {
        localStorage.removeItem('impersonated_tenant_id');
    }
    location.reload(); // Reload to refresh all views with new tenant_id
};

function renderLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('flex');
    if (window.lucide) window.lucide.createIcons();
}
window.attemptLogin = async function attemptLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');
    const errorMsg = document.getElementById('login-error');

    if (!email || !password) {
        errorMsg.innerText = "Please enter email and password.";
        errorMsg.classList.remove('hidden');
        return;
    }

    btn.innerText = "Verifying...";
    btn.disabled = true;
    errorMsg.classList.add('hidden');

    // Supabase Auth Login
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Login failed:", error);
        errorMsg.innerText = error.message;
        errorMsg.classList.remove('hidden');
        btn.innerText = "Sign In";
        btn.disabled = false;
        return;
    }

    // Success! 
    console.log("Login successful:", data);
    // Force navigation to Dashboard on manual login
    window.location.hash = 'dashboard';
};

window.logout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will handle the renderLogin()
    window.currentUser = null;
    try { localStorage.removeItem('mock_user'); } catch (e) { }
    // Redirect to base URL to clear hash
    window.location.href = window.location.pathname;
};

// --- SHELL & NAVIGATION ---
function showAppShell() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('flex');

    if (window.currentUser) {
        document.getElementById('header-user-name').innerText = window.currentUser.name;
        document.getElementById('header-user-role').innerText = window.currentUser.role;
        document.getElementById('header-user-avatar').src = window.currentUser.avatar;

        // Tenant Name Display
        const tenantEl = document.getElementById('header-tenant-name');
        if (tenantEl) {
            tenantEl.innerText = window.currentUser.tenant_name + (window.currentUser.is_impersonating ? ' (impersonating)' : '');
            if (window.currentUser.is_impersonating) {
                tenantEl.classList.remove('text-slate-700');
                tenantEl.classList.add('text-red-600');
            } else {
                tenantEl.classList.remove('text-red-600');
                tenantEl.classList.add('text-slate-700');
            }
        }
    }

    renderSidebar();

    // Check Hash
    const hash = window.location.hash.substring(1);
    const [view, params] = hash.split('?');
    if (view && ROUTES[view]) {
        navigate(view, params);
    } else {
        navigate('dashboard');
    }
}

function renderSidebar() {
    const list = document.getElementById('sidebar-list');
    list.innerHTML = '';

    MENU_ITEMS.forEach(item => {
        // Superuser Check
        if (item.id === 'superuser' && (!window.currentUser || !window.currentUser.is_superuser)) {
            return; // Skip if not superuser
        }

        if (item.type === 'separator') {
            list.innerHTML += `<div class="h-px bg-gray-200 my-4 mx-4"></div>`;
        } else {
            // FIXED: Direct window.navigate call
            list.innerHTML += `
            <li>
                <button 
                    id="nav-${item.id}" 
                    onclick="window.navigate('${item.id}')" 
                    class="sidebar-link w-full flex items-center px-6 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                    <i data-lucide="${item.icon}" class="w-5 h-5 mr-3 pointer-events-none"></i>
                    <span class="font-medium pointer-events-none">${item.label}</span>
                </button>
            </li>`;
        }
    });
    lucide.createIcons();
}

export async function navigate(viewId, paramsString = null) {
    console.log("🔄 Navigating to:", viewId);

    // Update Hash if not already set (to avoid loop)
    const currentHash = window.location.hash.substring(1).split('?')[0];
    if (currentHash !== viewId) {
        window.history.pushState(null, '', `#${viewId}${paramsString ? '?' + paramsString : ''}`);
    }

    // 1. Highlight Sidebar
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${viewId}`);
    if (activeLink) activeLink.classList.add('active');

    // 2. Container Reset
    const container = document.getElementById('main-canvas');

    // CLEANUP PREVIOUS VIEW
    if (window.currentViewCleanup) {
        try {
            window.currentViewCleanup();
            console.log("🧹 Cleaned up previous view");
        } catch (e) {
            console.error("Cleanup error:", e);
        }
        window.currentViewCleanup = null;
    }

    container.innerHTML = '';

    const loader = document.createElement('div');
    loader.className = "flex h-full items-center justify-center text-gray-400";
    loader.innerText = "Loading...";
    container.appendChild(loader);

    const renderFn = ROUTES[viewId];
    if (!renderFn) {
        container.innerHTML = `<div class="p-10 text-center text-red-500">Error: View '${viewId}' not found.</div>`;
        return;
    }

    // 3. Render
    try {
        await new Promise(r => setTimeout(r, 0));
        container.innerHTML = '';
        await new Promise(r => setTimeout(r, 0));
        container.innerHTML = '';

        // Parse params
        const params = new URLSearchParams(paramsString);

        // Execute Render and capture Cleanup function
        const cleanupFn = await renderFn(container, params);
        if (typeof cleanupFn === 'function') {
            window.currentViewCleanup = cleanupFn;
        }

        console.log("✅ Rendered:", viewId);
    } catch (err) {
        console.error("❌ Error rendering view:", err);
        container.innerHTML = `
            <div class="p-6 bg-red-50 border border-red-200 text-red-800 rounded-lg m-6">
                <h3 class="font-bold">View Error</h3>
                <p>${err.message}</p>
                <pre class="text-xs mt-2 opacity-75">${err.stack}</pre>
            </div>`;
    }

    lucide.createIcons();
}

window.navigate = navigate;
