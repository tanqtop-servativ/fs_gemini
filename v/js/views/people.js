import { supabase } from '../supabase.js';
import { renderAuditHistory } from './audit.js';
import { setupModalGuard } from '../modal_utils.js'; // <--- NEW IMPORT

// --- HELPERS ---
function getTenantId() {
    if (window.currentUser && window.currentUser.tenant_id) return window.currentUser.tenant_id;
    try { return JSON.parse(localStorage.getItem('mock_user')).tenant_id || 1; } catch (e) { return 1; }
}

// --- MAIN RENDER ---
export async function renderPeople(container) {
    const tenantId = getTenantId();

    container.innerHTML = `
      <div class="mb-6 flex justify-between items-center">
        <div><h1 class="text-2xl font-bold text-slate-900">People</h1><p class="text-gray-500">Tenant #${tenantId}</p></div>
        <button id="btn-new-person" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
            <i data-lucide="plus" class="w-4 h-4 mr-2"></i> Add Person
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th class="px-6 py-4">Name</th><th class="px-6 py-4">Roles</th><th class="px-6 py-4">Contact</th><th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="people-body"><tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading...</td></tr></tbody>
        </table>
      </div>`;

    document.getElementById('btn-new-person').onclick = () => openEditPersonModal(null);
    await loadPeopleTable();
}

async function loadPeopleTable() {
    const { data: people, error } = await supabase
        .from('people_enriched')
        .select('*')
        .eq('tenant_id', getTenantId())
        .order('last_name');

    const tbody = document.getElementById('people-body');

    if (error) return tbody.innerHTML = `<tr><td colspan="4" class="text-red-500 px-6 py-4">Error: ${error.message}</td></tr>`;
    if (!people || !people.length) return tbody.innerHTML = `<tr><td colspan="4" class="text-center px-6 py-8 text-gray-400">No people found.</td></tr>`;

    tbody.innerHTML = people.map(p => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer" onclick="window.viewPerson('${p.id}')">
            <td class="px-6 py-4 font-bold text-slate-900">${p.first_name} ${p.last_name || ''}</td>
            <td class="px-6 py-4">
                ${p.roles_display ? `<span class="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded border border-gray-200">${p.roles_display}</span>` : '<span class="text-gray-300">-</span>'}
            </td>
            <td class="px-6 py-4 text-sm text-slate-600"><div class="flex items-center gap-1"><i data-lucide="mail" class="w-3 h-3"></i> ${p.email || '-'}</div></td>
            <td class="px-6 py-4 text-right"><button class="text-slate-400 hover:text-blue-600 p-2"><i data-lucide="eye" class="w-4 h-4"></i></button></td>
        </tr>
    `).join('');

    window.viewPerson = (id) => openDetailPersonModal(id);
    lucide.createIcons();
}

// --- DETAIL VIEW ---
async function openDetailPersonModal(id) {
    const { data: p, error } = await supabase.from('people_enriched').select('*').eq('id', id).single();
    if (error) return alert("Error: " + error.message);

    const container = document.getElementById('modal-container');
    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
            <div class="flex justify-between items-start mb-6">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">${p.first_name[0]}${p.last_name ? p.last_name[0] : ''}</div>
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900">${p.first_name} ${p.last_name || ''}</h2>
                        <p class="text-gray-500">${p.email || 'No email'}</p>
                    </div>
                </div>
                <button id="btn-close" class="text-gray-400 hover:text-black"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
            <div class="mb-6">
                <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Assigned Roles</h3>
                <div class="text-sm text-slate-700 font-medium bg-slate-50 p-3 rounded border border-slate-100">
                    ${p.roles_display || 'None'}
                </div>
            </div>

            <!-- AUDIT HISTORY -->
            <div class="mt-6 border-t border-gray-100 pt-4">
                <details class="group">
                    <summary class="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-500 hover:text-slate-800 select-none">
                        <i data-lucide="chevron-right" class="w-4 h-4 transition-transform group-open:rotate-90"></i>
                        Audit History
                    </summary>
                    <div id="audit-log-container" class="mt-4 pl-2"></div>
                </details>
            </div>

             <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <button id="btn-edit" class="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center">
                    <i data-lucide="pencil" class="w-4 h-4 mr-2"></i> Edit
                </button>
            </div>
        </div>
    </div>`;

    lucide.createIcons();
    renderAuditHistory('audit-log-container', 'people', id);

    // Simple close for read-only
    const close = () => container.innerHTML = '';
    document.getElementById('btn-close').onclick = close;
    container.firstElementChild.addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });

    document.getElementById('btn-edit').onclick = () => openEditPersonModal(p);
}

// --- EDIT/CREATE MODAL ---
async function openEditPersonModal(person) {
    const tenantId = getTenantId();
    const container = document.getElementById('modal-container');

    // FIXED: Fetch Tenant Roles OR Global Roles
    const { data: roles } = await supabase
        .from('roles')
        .select('*')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const currentRoleIds = person && person.role_ids ? person.role_ids : [];

    const roleChecks = roles && roles.length > 0 ? roles.map(r => `
        <label class="flex items-center space-x-2 cursor-pointer border p-2 rounded hover:bg-gray-50">
            <input type="checkbox" name="role_checkbox" value="${r.id}" ${currentRoleIds.includes(r.id) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-black border-gray-300 rounded">
            <span class="text-sm text-gray-700">${r.name}</span>
        </label>
    `).join('') : '<div class="text-gray-400 text-sm italic p-2">No roles defined.</div>';

    // User Creation UI (Only for new people or those without a user_id)
    const showUserCreation = !person || !person.user_id;

    const userCreationHTML = showUserCreation ? `
        <div class="mt-6 border-t pt-4">
            <label class="flex items-center gap-2 cursor-pointer mb-4">
                <input type="checkbox" id="chk-create-login" class="w-4 h-4 text-black rounded">
                <span class="font-bold text-sm text-slate-900">Create User Login?</span>
            </label>
            
            <div id="login-fields" class="hidden space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div class="flex gap-4 text-sm mb-2">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="auth_method" value="invite" checked>
                        <span>Send Invite Email</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="auth_method" value="manual">
                        <span>Set Password Manually</span>
                    </label>
                </div>
                
                <div id="manual-password-field" class="hidden">
                    <input id="inp-password" type="password" class="w-full border p-2 rounded" placeholder="Temporary Password">
                    <p class="text-xs text-gray-500 mt-1">Must be at least 6 characters.</p>
                </div>
            </div>
        </div>
    ` : `<div class="mt-4 text-xs text-green-600 font-bold flex items-center"><i data-lucide="check" class="w-3 h-3 mr-1"></i> User Login Active</div>`;

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 class="font-bold text-lg mb-4">${person ? 'Edit' : 'New'} Person</h3>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <input id="inp-first" class="w-full border p-2 rounded" placeholder="First Name" value="${person ? person.first_name : ''}">
                    <input id="inp-last" class="w-full border p-2 rounded" placeholder="Last Name" value="${person ? person.last_name || '' : ''}">
                </div>
                <input id="inp-email" class="w-full border p-2 rounded" placeholder="Email" value="${person ? person.email || '' : ''}">
                
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Assign Roles</label>
                    <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-100 rounded p-2">
                        ${roleChecks}
                    </div>
                </div>

                ${userCreationHTML}
            </div>
            <div class="flex justify-between mt-6 gap-3">
                 ${person ? `<button onclick="window.deletePerson(${person.id})" class="text-red-500 hover:text-red-700 font-bold text-sm">Delete</button>` : '<div></div>'}
                <div class="flex gap-2">
                    <button id="btn-cancel" class="px-4 py-2 hover:bg-gray-100 rounded">Cancel</button>
                    <button id="btn-save" class="bg-black text-white px-4 py-2 rounded">Save</button>
                </div>
            </div>
        </div>
    </div>`;

    // --- APPLY GUARD ---
    const safeClose = setupModalGuard('modal-container', () => { container.innerHTML = ''; });
    document.getElementById('btn-cancel').onclick = safeClose;

    // UI Toggles
    if (showUserCreation) {
        const chkCreate = document.getElementById('chk-create-login');
        const loginFields = document.getElementById('login-fields');
        const radios = document.getElementsByName('auth_method');
        const passField = document.getElementById('manual-password-field');

        chkCreate.onchange = () => {
            loginFields.classList.toggle('hidden', !chkCreate.checked);
        };

        radios.forEach(r => {
            r.onchange = () => {
                passField.classList.toggle('hidden', r.value !== 'manual');
            };
        });
    }

    // SAVE HANDLER
    document.getElementById('btn-save').onclick = async () => {
        const first = document.getElementById('inp-first').value;
        const last = document.getElementById('inp-last').value;
        const email = document.getElementById('inp-email').value;
        const btnSave = document.getElementById('btn-save');

        if (!first) return alert("First Name required");
        if (!email) return alert("Email required");

        btnSave.innerText = "Saving...";
        btnSave.disabled = true;

        let userId = person ? person.user_id : null;

        // 1. Handle User Creation (if checked)
        const chkCreate = document.getElementById('chk-create-login');
        if (chkCreate && chkCreate.checked) {
            const method = document.querySelector('input[name="auth_method"]:checked').value;
            const password = document.getElementById('inp-password').value;

            if (method === 'manual' && (!password || password.length < 6)) {
                btnSave.innerText = "Save";
                btnSave.disabled = false;
                return alert("Password must be at least 6 characters.");
            }

            try {
                // Call local API Server
                const response = await fetch('http://localhost:3000/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        invite: method === 'invite'
                    })
                });

                const result = await response.json();
                if (!result.success && !result.user) {
                    throw new Error(result.error || "Failed to create user");
                }

                // Get the new User ID
                userId = result.user.id || result.user.user.id; // Structure varies slightly by endpoint
                console.log("User Created:", userId);

            } catch (e) {
                console.error(e);
                alert("Error creating login: " + e.message);
                btnSave.innerText = "Save";
                btnSave.disabled = false;
                return;
            }
        }

        // 2. Save Person Record
        const roleIds = Array.from(document.querySelectorAll('input[name="role_checkbox"]:checked'))
            .map(cb => parseInt(cb.value));

        // We need to pass user_id to save_person_safe if we have it
        // But save_person_safe might not accept p_user_id yet.
        // Let's check if we need to update the RPC or just do a direct update.
        // For now, let's assume we update the person record directly if we have a userId

        const { data: savedPerson, error } = await supabase.rpc('save_person_safe', {
            p_id: person ? person.id : null,
            p_tenant_id: tenantId,
            p_first: first,
            p_last: last,
            p_email: email,
            p_role_ids: roleIds
        });

        if (error) {
            alert("Database Error: " + error.message);
            btnSave.innerText = "Save";
            btnSave.disabled = false;
        } else {
            // If we created a user, link it now (since save_person_safe might not handle it)
            if (userId) {
                await supabase.from('people').update({ user_id: userId }).eq('id', savedPerson);

                // Also create a Profile entry for them so they can log in!
                // The API server creates the Auth User, but WE need to create the public.profile
                await supabase.from('profiles').insert({
                    id: userId,
                    tenant_id: tenantId,
                    first_name: first,
                    last_name: last,
                    is_superuser: false
                });
            }

            container.innerHTML = '';
            loadPeopleTable();
        }
    };
}

window.deletePerson = async (id) => {
    if (!confirm("Delete this person?")) return;
    await supabase.from('people').delete().eq('id', id);
    document.getElementById('modal-container').innerHTML = '';
    loadPeopleTable();
};
