import { supabase } from '../supabase.js';
import { setupModalGuard } from '../modal_utils.js';

// --- STATE ---
let currentItems = [];
let currentTemplateId = null; 

// --- HELPERS ---
function getTenantId() {
    if (window.currentUser && window.currentUser.tenant_id) return window.currentUser.tenant_id;
    try { return JSON.parse(localStorage.getItem('mock_user')).tenant_id || 1; } catch (e) { return 1; }
}

// --- MAIN RENDER ---
export async function renderBOM(container) {
    const tenantId = getTenantId();

    container.innerHTML = `
      <div class="mb-6 flex justify-between items-center">
        <div>
            <h1 class="text-2xl font-bold text-slate-900">BOM Templates</h1>
            <p class="text-gray-500">Standardize inventory kits (Tenant #${tenantId})</p>
        </div>
        <button id="btn-new-bom" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
            <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Template
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th class="px-6 py-4">Template Name</th>
              <th class="px-6 py-4">Description</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="bom-body"><tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">Loading...</td></tr></tbody>
        </table>
      </div>`;

    document.getElementById('btn-new-bom').onclick = () => openEditBOMModal(null);
    await loadBOMTable(tenantId);
}

async function loadBOMTable(tenantId) {
    const { data: templates, error } = await supabase
        .from('bom_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

    const tbody = document.getElementById('bom-body');

    if (error) return tbody.innerHTML = `<tr><td colspan="3" class="text-red-500 px-6 py-4">Error: ${error.message}</td></tr>`;
    if (templates.length === 0) return tbody.innerHTML = `<tr><td colspan="3" class="text-center px-6 py-8 text-gray-400">No templates found.</td></tr>`;

    tbody.innerHTML = templates.map(t => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer" onclick="window.viewBOM('${t.id}')">
            <td class="px-6 py-4 font-bold text-slate-900">${t.name}</td>
            <td class="px-6 py-4 text-gray-500">${t.description || '-'}</td>
            <td class="px-6 py-4 text-right">
                <button class="text-slate-400 hover:text-blue-600 p-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        </tr>`).join('');
    
    window.viewBOM = (id) => openDetailBOMModal(id);
    lucide.createIcons();
}

// --- DETAIL VIEW ---
async function openDetailBOMModal(id) {
    const container = document.getElementById('modal-container');
    const { data: tmpl } = await supabase.from('bom_templates').select('*').eq('id', id).single();
    const { data: items } = await supabase.from('bom_template_items').select('*').eq('template_id', id).order('sort_order');

    const itemsHtml = items && items.length 
        ? items.map(i => `<div class="flex justify-between items-center border-b border-gray-50 py-2"><div class="flex gap-3 items-center"><span class="bg-slate-100 px-2 rounded text-sm font-bold text-slate-700">${i.quantity}x</span> <span class="font-medium">${i.item_name}</span></div><span class="text-xs text-gray-400">${i.category}</span></div>`).join('')
        : '<div class="text-center py-4 text-gray-400">No items in this template.</div>';

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 h-[80vh] flex flex-col">
            <div class="flex justify-between items-start mb-4">
                <div><h2 class="text-2xl font-bold text-slate-900">${tmpl.name}</h2><p class="text-gray-500">${tmpl.description || ''}</p></div>
                <button id="btn-close-view" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto border-t border-gray-100 pt-4">
                ${itemsHtml}
            </div>
            <div class="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button id="btn-edit-bom" class="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center">
                    <i data-lucide="pencil" class="w-4 h-4 mr-2"></i> Edit Template
                </button>
            </div>
        </div>
    </div>`;
    
    lucide.createIcons();
    
    const close = () => container.innerHTML = '';
    document.getElementById('btn-close-view').onclick = close;
    container.firstElementChild.addEventListener('click', (e) => { if(e.target === e.currentTarget) close(); });

    document.getElementById('btn-edit-bom').onclick = () => openEditBOMModal(tmpl);
}

// --- EDIT MODAL ---
async function openEditBOMModal(template) {
    currentItems = [];
    currentTemplateId = template ? template.id : null;
    const container = document.getElementById('modal-container');

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 h-[80vh] flex flex-col">
            <h3 class="font-bold text-lg mb-4">${template ? 'Edit' : 'New'} BOM Template</h3>
            <div class="space-y-3 mb-4">
                <input id="inp-bom-name" class="w-full border p-2 rounded" placeholder="Template Name" value="${template ? template.name : ''}">
                <input id="inp-bom-desc" class="w-full border p-2 rounded" placeholder="Description" value="${template ? template.description || '' : ''}">
            </div>
            <div class="flex-1 border-t border-gray-100 pt-4 flex flex-col min-h-0">
                <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Items (Drag to Reorder)</label>
                
                <!-- Add Row -->
                <div class="flex gap-2 mb-2">
                    <input id="new-item-name" class="flex-1 border p-2 rounded text-sm" placeholder="Item Name">
                    <!-- FIXED: Default to 0 -->
                    <input id="new-item-qty" type="number" class="w-16 border p-2 rounded text-sm" placeholder="Qty" value="0">
                    <select id="new-item-cat" class="border p-2 rounded text-sm bg-white">
                        <option>Linens</option>
                        <option>Consumables</option>
                        <option>Kitchen</option>
                        <option>Cleaning</option>
                    </select>
                    <button id="btn-add-item" class="bg-slate-100 hover:bg-slate-200 p-2 rounded"><i data-lucide="plus" class="w-4 h-4"></i></button>
                </div>
                
                <!-- List -->
                <div id="bom-items-list" class="flex-1 overflow-y-auto border border-gray-100 rounded p-2 bg-gray-50 space-y-1"></div>
            </div>
            <div class="flex justify-between mt-4 gap-3">
                ${template ? `<button onclick="window.deleteBOM(${template.id})" class="text-red-500 hover:text-red-700 font-bold text-sm">Delete</button>` : '<div></div>'}
                <div class="flex gap-2">
                    <button id="btn-cancel" class="px-4 py-2">Cancel</button>
                    <button id="btn-save" class="bg-black text-white px-4 py-2 rounded">Save</button>
                </div>
            </div>
        </div>
    </div>`;

    // LOAD ITEMS
    if (template) {
        const { data: items } = await supabase
            .from('bom_template_items')
            .select('*')
            .eq('template_id', template.id)
            .order('sort_order', { ascending: true });
        
        if (items) currentItems = items.map(i => ({ name: i.item_name, qty: i.quantity, category: i.category, notes: i.notes || '' }));
    }
    renderItemsList();

    // INIT SORTABLE
    const listEl = document.getElementById('bom-items-list');
    if(Sortable) Sortable.create(listEl, { animation: 150, handle: '.drag-handle', ghostClass: 'bg-blue-50' });

    // GUARD
    const safeClose = setupModalGuard('modal-container', () => { container.innerHTML = ''; });
    document.getElementById('btn-cancel').onclick = safeClose;

    document.getElementById('btn-add-item').onclick = handleAddItem;
    document.getElementById('new-item-name').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleAddItem(); });
    
    document.getElementById('btn-save').onclick = async () => {
        // SYNC ORDER
        const newOrder = [];
        listEl.querySelectorAll('.bom-item').forEach((el) => { newOrder.push(currentItems[parseInt(el.dataset.originalIdx)]); });
        if(newOrder.length > 0) currentItems = newOrder;

        const name = document.getElementById('inp-bom-name').value;
        if (!name) return alert("Name required");
        const tenantId = getTenantId();
        const payload = { p_name: name, p_description: document.getElementById('inp-bom-desc').value, p_items: currentItems };

        let error = null;
        if (currentTemplateId) {
            const { error: err } = await supabase.rpc('update_bom_template', { ...payload, p_id: currentTemplateId });
            error = err;
        } else {
            const { error: err } = await supabase.rpc('create_bom_template', { ...payload, p_tenant_id: tenantId });
            error = err;
        }

        if (error) alert("Error: " + error.message);
        else {
            document.getElementById('modal-container').innerHTML = '';
            loadBOMTable(tenantId);
        }
    };
    lucide.createIcons();
}

function handleAddItem() {
    const nameIn = document.getElementById('new-item-name');
    const qtyIn = document.getElementById('new-item-qty');
    const catIn = document.getElementById('new-item-cat');
    if (!nameIn.value.trim()) return;
    
    // FIXED: Default to 0 if empty
    const qty = parseInt(qtyIn.value);
    currentItems.push({ 
        name: nameIn.value.trim(), 
        qty: isNaN(qty) ? 0 : qty, 
        category: catIn.value, 
        notes: '' 
    });
    
    nameIn.value = ''; qtyIn.value = '0'; nameIn.focus();
    renderItemsList();
}

function renderItemsList() {
    const list = document.getElementById('bom-items-list');
    list.innerHTML = currentItems.length ? currentItems.map((item, idx) => `
        <div class="bom-item flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-sm" data-original-idx="${idx}">
            <div class="flex items-center gap-2">
                <i data-lucide="grip-vertical" class="drag-handle w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing"></i>
                <!-- FIXED: Editable Quantity Input -->
                <input type="number" class="w-12 text-center border rounded text-xs p-1 font-bold bg-slate-50 item-qty-edit" 
                       data-idx="${idx}" value="${item.qty}">
                <span class="font-medium">${item.name}</span>
                <span class="text-[10px] text-gray-400 uppercase bg-gray-50 px-1 rounded tracking-wide">${item.category}</span>
            </div>
            <button onclick="window.removeBOMItem(${idx})" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`).join('') : '<div class="text-center text-gray-400 py-4 text-sm">No items. Add some above.</div>';
    
    // BIND CHANGE EVENTS
    list.querySelectorAll('.item-qty-edit').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            currentItems[idx].qty = parseInt(e.target.value) || 0;
        });
    });

    lucide.createIcons();
}

window.removeBOMItem = (idx) => { currentItems.splice(idx, 1); renderItemsList(); };
window.deleteBOM = async (id) => { if(confirm("Delete?")) { await supabase.from('bom_templates').delete().eq('id', id); document.getElementById('modal-container').innerHTML = ''; loadBOMTable(getTenantId()); } };
