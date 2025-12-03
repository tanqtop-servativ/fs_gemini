import { supabase } from '../supabase.js';
import { setupModalGuard } from '../modal_utils.js'; // <--- NEW IMPORT

function getTenantId() {
    if (window.currentUser && window.currentUser.tenant_id) return window.currentUser.tenant_id;
    try { return JSON.parse(localStorage.getItem('mock_user')).tenant_id || 1; } catch (e) { return 1; }
}

export async function renderRoles(container) {
    const tenantId = getTenantId();
    container.innerHTML = `
      <div class="mb-6 flex justify-between items-center">
        <div><h1 class="text-2xl font-bold text-slate-900">Roles</h1><p class="text-gray-500">Define permissions for Tenant #${tenantId}</p></div>
        <button id="btn-new-role" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
            <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Role
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th class="px-6 py-4">Role Name</th><th class="px-6 py-4">Description</th><th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="roles-body"><tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">Loading...</td></tr></tbody>
        </table>
      </div>`;
    document.getElementById('btn-new-role').onclick = () => openEditRoleModal(null);
    await loadRolesTable(tenantId);
}

async function loadRolesTable(tenantId) {
    const { data: roles } = await supabase.from('roles').select('*').eq('tenant_id', tenantId).order('name');
    const tbody = document.getElementById('roles-body');
    
    if (!roles || !roles.length) return tbody.innerHTML = `<tr><td colspan="3" class="text-center px-6 py-8 text-gray-400">No roles found.</td></tr>`;

    tbody.innerHTML = roles.map(r => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer" onclick="window.viewRole('${r.id}')">
            <td class="px-6 py-4 font-medium text-slate-900">${r.name}</td>
            <td class="px-6 py-4 text-gray-500">${r.description || '-'}</td>
            <td class="px-6 py-4 text-right"><button class="text-slate-400 hover:text-blue-600 p-2"><i data-lucide="eye" class="w-4 h-4"></i></button></td>
        </tr>`).join('');
    
    window.viewRole = (id) => openDetailRoleModal(id);
    lucide.createIcons();
}

async function openDetailRoleModal(id) {
    const { data: r } = await supabase.from('roles').select('*').eq('id', id).single();
    const container = document.getElementById('modal-container');
    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold text-slate-900">${r.name}</h2>
                <button id="btn-close" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
            <p class="text-gray-600 mb-8">${r.description || 'No description provided.'}</p>
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button id="btn-edit" class="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center">
                    <i data-lucide="pencil" class="w-4 h-4 mr-2"></i> Edit
                </button>
            </div>
        </div>
    </div>`;
    lucide.createIcons();
    
    // Simple close
    const close = () => container.innerHTML = '';
    document.getElementById('btn-close').onclick = close;
    container.firstElementChild.addEventListener('click', (e) => { if(e.target === e.currentTarget) close(); });

    document.getElementById('btn-edit').onclick = () => openEditRoleModal(r);
}

async function openEditRoleModal(role) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 class="font-bold text-lg mb-4">${role ? 'Edit' : 'New'} Role</h3>
            <div class="space-y-3">
                <input id="inp-name" class="w-full border p-2 rounded" placeholder="Role Name" value="${role ? role.name : ''}">
                <input id="inp-desc" class="w-full border p-2 rounded" placeholder="Description" value="${role ? role.description || '' : ''}">
            </div>
            <div class="flex justify-between mt-6 gap-3">
                 ${role ? `<button onclick="window.deleteRole(${role.id})" class="text-red-500 hover:text-red-700 font-bold text-sm">Delete</button>` : '<div></div>'}
                <div class="flex gap-2">
                    <button id="btn-cancel" class="px-4 py-2">Cancel</button>
                    <button id="btn-save" class="bg-black text-white px-4 py-2 rounded">Save</button>
                </div>
            </div>
        </div>
    </div>`;

    // --- APPLY GUARD ---
    const safeClose = setupModalGuard('modal-container', () => { container.innerHTML = ''; });
    document.getElementById('btn-cancel').onclick = safeClose;

    document.getElementById('btn-save').onclick = async () => {
        const name = document.getElementById('inp-name').value;
        if(!name) return alert("Name required");
        
        if (role) {
            await supabase.from('roles').update({ name, description: document.getElementById('inp-desc').value }).eq('id', role.id);
        } else {
            await supabase.from('roles').insert({ name, description: document.getElementById('inp-desc').value, tenant_id: getTenantId() });
        }
        container.innerHTML = '';
        loadRolesTable(getTenantId());
    };
}

window.deleteRole = async (id) => { if(confirm("Delete?")) { await supabase.from('roles').delete().eq('id', id); document.getElementById('modal-container').innerHTML = ''; loadRolesTable(getTenantId()); } };
