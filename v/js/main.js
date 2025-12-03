import { supabase } from './supabase.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCalendar } from './views/calendar.js';
import { renderProperties } from './views/properties.js';
import { renderPeople } from './views/people.js';
import { renderBOM } from './views/bom.js';
import { renderRoles } from './views/roles.js';
import { renderJobTemplates } from './views/job_templates.js';
import { renderSuperuserDashboard } from './views/superuser.js';

// --- STATE ---
window.currentUser = null;

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Live Status', icon: 'activity' },
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
    'calendar': renderCalendar,
    'properties': renderProperties,
    'people': renderPeople,
    'roles': renderRoles,
    'bom': renderBOM,
    'job_templates': renderJobTemplates,
    'superuser': renderSuperuserDashboard
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Starting...");
    checkAuth();

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

    // Handle Deep Links on Load
    window.addEventListener('hashchange', () => {
        if (!window.currentUser) return;
        const hash = window.location.hash.substring(1); // remove #
        const [view, params] = hash.split('?');
        if (view && ROUTES[view]) navigate(view, params);
    });
});

// --- AUTH ---
function checkAuth() {
    let stored = null;
    try { stored = localStorage.getItem('mock_user'); } catch (e) { }

    if (stored) {
        window.currentUser = JSON.parse(stored);
        showAppShell();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        lucide.createIcons();
    }
}

window.attemptLogin = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    btn.innerText = "Verifying...";

    // Call updated RPC
    const { data: result, error } = await supabase.rpc('verify_app_access', {
        p_email: email,
        p_password: password
    });

    if (error) {
        console.error(error);
        alert("System Error: " + error.message);
        btn.innerText = "Login";
        return;
    }

    // Result is now a JSON object: { success: true/false, user: {...}, message: "..." }
    if (result && result.success) {
        console.log("✅ Access Granted", result.user);

        const user = {
            id: result.user.id,
            tenant_id: result.user.tenant_id,
            name: `${result.user.first_name} ${result.user.last_name}`,
            email: result.user.email,
            role: result.user.is_superuser ? 'Super Admin' : 'Manager', // simplified role logic for now
            is_superuser: result.user.is_superuser,
            avatar: `https://ui-avatars.com/api/?name=${result.user.first_name}+${result.user.last_name}&background=random`
        };

        window.currentUser = user;
        try { localStorage.setItem('mock_user', JSON.stringify(user)); } catch (e) { }
        showAppShell();
    } else {
        console.warn("❌ Login Failed", result?.message);
        errorMsg.innerText = result?.message || "Invalid credentials";
        errorMsg.classList.remove('hidden');
        btn.innerText = "Login";
        document.getElementById('login-password').value = '';
    }
};

window.logout = () => {
    window.currentUser = null;
    try { localStorage.removeItem('mock_user'); } catch (e) { }
    location.reload();
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
        await renderFn(container, params);

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
