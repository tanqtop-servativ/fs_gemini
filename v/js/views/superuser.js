import { supabase } from '../supabase.js';
import { setupModalGuard } from '../modal_utils.js';
import { renderAuditHistory } from './audit.js';

export async function renderSuperuserDashboard(container) {
    // 1. Security Check
    if (!window.currentUser || !window.currentUser.is_superuser) {
        container.innerHTML = `<div class="p-10 text-center text-red-500">⛔ Access Denied: Superuser only.</div>`;
        return;
    }

    // 2. Fetch Tenants
    const { data: tenants, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="p-10 text-center text-red-500">Error fetching tenants: ${error.message}</div>`;
        return;
    }

    // 3. Render Dashboard
    container.innerHTML = `
        <div class="p-6 max-w-6xl mx-auto">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-2xl font-bold text-slate-900">Superuser Dashboard</h1>
                    <p class="text-slate-500">Manage tenants and system settings</p>
                </div>
                <button id="btn-new-tenant" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                    <i data-lucide="plus" class="w-4 h-4"></i> New Tenant
                </button>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 class="font-bold text-slate-700">All Tenants (${tenants.length})</h2>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th class="px-6 py-3">ID</th>
                                <th class="px-6 py-3">Tenant Name</th>
                                <th class="px-6 py-3">Created At</th>
                                <th class="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${tenants.map(t => `
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="px-6 py-4 text-gray-500 font-mono text-xs">#${t.id}</td>
                                    <td class="px-6 py-4 font-medium text-slate-900">${t.name}</td>
                                    <td class="px-6 py-4 text-gray-500">${new Date(t.created_at).toLocaleDateString()}</td>
                                    <td class="px-6 py-4 text-right">
                                        <button onclick="window.openManageTenantModal(${t.id}, '${t.name}')" class="text-gray-400 hover:text-indigo-600 transition-colors p-1" title="View Details">
                                            <i data-lucide="eye" class="w-5 h-5"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modals -->
        <div id="modal-container"></div>
    `;

    document.getElementById('btn-new-tenant').onclick = () => openCreateTenantModal();

    // Expose manage function globally for onclick
    window.openManageTenantModal = openManageTenantModal;

    if (window.lucide) window.lucide.createIcons();
}

// --- MANAGE TENANT MODAL ---
async function openManageTenantModal(tenantId, tenantName) {
    const container = document.getElementById('modal-container');

    // Fetch Admins
    const { data: admins } = await supabase.rpc('get_tenant_users', { p_tenant_id: tenantId });

    // Render Initial Read-Only View
    renderReadOnlyView();

    function renderReadOnlyView() {
        container.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 class="font-bold text-lg text-slate-800">${tenantName}</h3>
                        <div class="text-xs text-slate-500 font-mono">ID: ${tenantId}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="btn-edit-mode" class="text-gray-500 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-indigo-50" title="Edit Tenant">
                            <i data-lucide="pencil" class="w-5 h-5"></i>
                        </button>
                        <button id="btn-close-manage" class="text-gray-400 hover:text-gray-600 transition-colors p-2">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                
                <div class="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    <!-- SECTION 1: DETAILS -->
                    <div class="space-y-4">
                        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-gray-100 pb-2">Tenant Details</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Tenant Name</label>
                                <div class="text-sm text-slate-900 font-medium">${tenantName}</div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                                <div class="text-sm text-green-600 font-bold flex items-center gap-1">
                                    <div class="w-2 h-2 rounded-full bg-green-500"></div> Active
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 2: ADMINS -->
                    <div class="space-y-4">
                        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-gray-100 pb-2">Administrators</h4>
                        <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-gray-100 text-gray-500 font-medium">
                                    <tr>
                                        <th class="px-4 py-2">Name</th>
                                        <th class="px-4 py-2">Email</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                    ${admins && admins.length > 0 ? admins.map(u => `
                                        <tr>
                                            <td class="px-4 py-2 font-medium text-slate-700">${u.first_name} ${u.last_name}</td>
                                            <td class="px-4 py-2 text-gray-500 font-mono">${u.email}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="2" class="px-4 py-4 text-center text-gray-400 italic">No admins found.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- SECTION 3: AUDIT HISTORY -->
                    <div id="audit-history-container"></div>

                </div>
            </div>
        </div>`;

        setupHandlers();
        renderAuditHistory('audit-history-container', 'tenants', tenantId);
    }

    function renderEditView() {
        container.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 class="font-bold text-lg text-slate-800">Edit Tenant</h3>
                        <div class="text-xs text-slate-500 font-mono">ID: ${tenantId}</div>
                    </div>
                    <button id="btn-cancel-edit" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <div class="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    <!-- SECTION 1: DETAILS -->
                    <div class="space-y-4">
                        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-gray-100 pb-2">Tenant Details</h4>
                        <div class="flex gap-4 items-end">
                            <div class="flex-1">
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Tenant Name</label>
                                <input type="text" id="inp-edit-name" value="${tenantName}" class="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            </div>
                            <button id="btn-update-name" class="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded hover:bg-slate-700 transition-colors">
                                Update Name
                            </button>
                        </div>
                    </div>

                    <!-- SECTION 2: ADMINS -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                            <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">Administrators</h4>
                            <button id="btn-add-admin" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                <i data-lucide="plus" class="w-3 h-3"></i> Add Admin
                            </button>
                        </div>
                        
                        <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-gray-100 text-gray-500 font-medium">
                                    <tr>
                                        <th class="px-4 py-2">Name</th>
                                        <th class="px-4 py-2">Email</th>
                                        <th class="px-4 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                    ${admins && admins.length > 0 ? admins.map(u => `
                                        <tr>
                                            <td class="px-4 py-2 font-medium text-slate-700">${u.first_name} ${u.last_name}</td>
                                            <td class="px-4 py-2 text-gray-500 font-mono">${u.email}</td>
                                            <td class="px-4 py-2 text-right flex justify-end gap-2">
                                                <button onclick="window.editAdmin('${u.id}', '${u.email}', '${u.first_name}', '${u.last_name}')" class="text-blue-600 hover:underline">Edit</button>
                                                <button onclick="window.deleteAdmin('${u.id}')" class="text-red-600 hover:underline">Remove</button>
                                            </td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="3" class="px-4 py-4 text-center text-gray-400 italic">No admins found.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                        
                        <!-- Add/Edit Admin Form (Hidden by default) -->
                        <div id="admin-form-container" class="hidden bg-indigo-50 border border-indigo-100 rounded-lg p-4 mt-4">
                            <h5 id="admin-form-title" class="text-xs font-bold text-indigo-800 mb-3 uppercase">Add New Admin</h5>
                            <input type="hidden" id="inp-admin-id">
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <input type="text" id="inp-adm-first" placeholder="First Name" class="p-2 border rounded text-sm">
                                <input type="text" id="inp-adm-last" placeholder="Last Name" class="p-2 border rounded text-sm">
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <input type="email" id="inp-adm-email" placeholder="Email" class="p-2 border rounded text-sm">
                                <input type="password" id="inp-adm-pass" placeholder="Password (leave empty to keep)" class="p-2 border rounded text-sm">
                            </div>
                            <div class="flex justify-end gap-2">
                                <button id="btn-cancel-admin" class="px-3 py-1 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
                                <button id="btn-save-admin" class="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded">Save Admin</button>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 3: DANGER ZONE -->
                    <div class="pt-8 mt-8 border-t border-red-100">
                        <h4 class="text-sm font-bold text-red-700 uppercase tracking-wide mb-2">Danger Zone</h4>
                        <div class="bg-red-50 border border-red-100 rounded-lg p-4 flex justify-between items-center">
                            <div>
                                <div class="font-bold text-red-900 text-sm">Delete Tenant</div>
                                <div class="text-red-600 text-xs">Archive this tenant (Soft Delete).</div>
                            </div>
                            <button id="btn-delete-tenant" class="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded hover:bg-red-600 hover:text-white transition-colors">
                                Delete Tenant
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>`;

        setupHandlers(true); // Pass true for edit mode handlers
    }

    function setupHandlers(isEditMode = false) {
        const safeClose = setupModalGuard('modal-container', () => container.innerHTML = '');

        if (isEditMode) {
            document.getElementById('btn-cancel-edit').onclick = renderReadOnlyView;

            // 1. Update Name
            document.getElementById('btn-update-name').onclick = async () => {
                const newName = document.getElementById('inp-edit-name').value;
                if (!newName) return;

                const btn = document.getElementById('btn-update-name');
                btn.innerText = "...";

                const { error } = await supabase.rpc('update_tenant', {
                    p_tenant_id: tenantId,
                    p_name: newName,
                    p_acting_user_id: window.currentUser?.id
                });

                if (error) alert(error.message);
                else {
                    alert("Name updated!");
                    // Refresh main dashboard
                    const mainContainer = document.getElementById('main-canvas');
                    if (mainContainer) renderSuperuserDashboard(mainContainer);
                    // Stay in edit mode or switch to read-only? Let's switch to read-only to show updated name.
                    openManageTenantModal(tenantId, newName);
                }
            };

            // 2. Delete Tenant (Soft Delete)
            document.getElementById('btn-delete-tenant').onclick = async () => {
                const confirmation = prompt(`WARNING: You are about to archive "${tenantName}".\n\nThis will hide the tenant and all their data.\n\nType "DELETE" to confirm:`);

                if (confirmation === "DELETE") {
                    const { error } = await supabase.rpc('delete_tenant', {
                        p_tenant_id: tenantId,
                        p_acting_user_id: window.currentUser?.id
                    });
                    if (error) alert(error.message);
                    else {
                        alert("Tenant archived.");
                        safeClose(true);
                        const mainContainer = document.getElementById('main-canvas');
                        if (mainContainer) renderSuperuserDashboard(mainContainer);
                    }
                } else if (confirmation !== null) {
                    alert("Verification failed. Tenant was not deleted.");
                }
            };

            // 3. Admin Form Logic
            const formContainer = document.getElementById('admin-form-container');
            const formTitle = document.getElementById('admin-form-title');
            const inpId = document.getElementById('inp-admin-id');
            const inpFirst = document.getElementById('inp-adm-first');
            const inpLast = document.getElementById('inp-adm-last');
            const inpEmail = document.getElementById('inp-adm-email');
            const inpPass = document.getElementById('inp-adm-pass');

            document.getElementById('btn-add-admin').onclick = () => {
                formContainer.classList.remove('hidden');
                formTitle.innerText = "Add New Admin";
                inpId.value = "";
                inpFirst.value = "";
                inpLast.value = "";
                inpEmail.value = "";
                inpPass.value = "";
                inpPass.placeholder = "Password";
            };

            document.getElementById('btn-cancel-admin').onclick = () => {
                formContainer.classList.add('hidden');
            };

            window.editAdmin = (id, email, first, last) => {
                formContainer.classList.remove('hidden');
                formTitle.innerText = "Edit Admin";
                inpId.value = id;
                inpFirst.value = first;
                inpLast.value = last;
                inpEmail.value = email;
                inpPass.value = "";
                inpPass.placeholder = "New Password (leave empty to keep)";
            };

            window.deleteAdmin = async (id) => {
                if (confirm("Remove this admin user?")) {
                    const { error } = await supabase.rpc('manage_tenant_user', {
                        p_operation: 'DELETE',
                        p_tenant_id: tenantId,
                        p_user_id: id,
                        p_acting_user_id: window.currentUser?.id
                    });
                    if (error) alert(error.message);
                    else openManageTenantModal(tenantId, tenantName); // Refresh modal (will reset to read-only, which is fine)
                }
            };

            document.getElementById('btn-save-admin').onclick = async () => {
                const id = inpId.value;
                const op = id ? 'UPDATE' : 'CREATE';

                const { error } = await supabase.rpc('manage_tenant_user', {
                    p_operation: op,
                    p_tenant_id: tenantId,
                    p_user_id: id || null,
                    p_email: inpEmail.value,
                    p_password: inpPass.value,
                    p_first: inpFirst.value,
                    p_last: inpLast.value,
                    p_acting_user_id: window.currentUser?.id
                });

                if (error) alert(error.message);
                else {
                    openManageTenantModal(tenantId, tenantName); // Refresh modal
                }
            };

        } else {
            // Read-Only Handlers
            document.getElementById('btn-close-manage').onclick = safeClose;
            document.getElementById('btn-edit-mode').onclick = renderEditView;
        }

        if (window.lucide) window.lucide.createIcons();
    }
}

function openCreateTenantModal() {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="font-bold text-lg text-slate-800">Create New Tenant</h3>
                <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Tenant Name</label>
                    <input type="text" id="inp-tenant-name" class="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Acme Properties">
                </div>

                <div class="pt-4 border-t border-gray-100">
                    <h4 class="text-sm font-bold text-slate-700 mb-3">Administrator Details</h4>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">First Name</label>
                            <input type="text" id="inp-admin-first" class="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="John">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Last Name</label>
                            <input type="text" id="inp-admin-last" class="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Doe">
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
                        <input type="email" id="inp-admin-email" class="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="admin@acme.com">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Password</label>
                        <input type="password" id="inp-admin-pass" class="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••">
                    </div>
                </div>
            </div>

            <div class="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button id="btn-cancel" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                <button id="btn-save-tenant" class="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                    <i data-lucide="check" class="w-4 h-4"></i> Create Tenant
                </button>
            </div>
        </div>
    </div>`;

    const safeClose = setupModalGuard('modal-container', () => container.innerHTML = '');
    document.getElementById('btn-close-modal').onclick = safeClose;
    document.getElementById('btn-cancel').onclick = safeClose;

    document.getElementById('btn-save-tenant').onclick = async () => {
        const btn = document.getElementById('btn-save-tenant');
        const name = document.getElementById('inp-tenant-name').value;
        const first = document.getElementById('inp-admin-first').value;
        const last = document.getElementById('inp-admin-last').value;
        const email = document.getElementById('inp-admin-email').value;
        const pass = document.getElementById('inp-admin-pass').value;

        if (!name || !first || !last || !email || !pass) {
            alert("Please fill in all fields.");
            return;
        }

        btn.innerText = "Creating...";
        btn.disabled = true;

        const { data, error } = await supabase.rpc('create_tenant_with_admin', {
            p_tenant_name: name,
            p_admin_email: email,
            p_admin_password: pass,
            p_admin_first_name: first,
            p_admin_last_name: last,
            p_acting_user_id: window.currentUser?.id
        });

        if (error) {
            console.error(error);
            alert("Error creating tenant: " + error.message);
            btn.innerText = "Create Tenant";
            btn.disabled = false;
            return;
        }

        alert("Tenant created successfully!");
        safeClose(true);
        // Refresh dashboard
        const mainContainer = document.getElementById('main-canvas'); // Hacky way to refresh
        if (mainContainer) renderSuperuserDashboard(mainContainer);
    };

    if (window.lucide) window.lucide.createIcons();
}
