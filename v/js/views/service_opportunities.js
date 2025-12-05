import { supabase } from '../supabase.js';
import { renderAuditHistory } from './audit.js';
import { setupModalGuard } from '../modal_utils.js';

// --- HELPERS ---
function getTenantId() {
    if (window.currentUser && window.currentUser.tenant_id) return window.currentUser.tenant_id;
    return 1;
}

// --- MAIN RENDER ---
export async function renderServiceOpportunities(container) {
    const tenantId = getTenantId();

    container.innerHTML = `
      <div class="mb-6 flex justify-between items-center">
        <div>
            <h1 class="text-2xl font-bold text-slate-900">Service Opportunities</h1>
            <p class="text-gray-500">Manage service requests and job workflows.</p>
        </div>
        <button id="btn-new-opp" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
            <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Opportunity
        </button>
      </div>
      
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th class="px-6 py-4">Property</th>
              <th class="px-6 py-4">Service Type</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4">Workflow</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="opp-body"><tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Loading...</td></tr></tbody>
        </table>
      </div>`;

    document.getElementById('btn-new-opp').onclick = () => openEditOppModal(null);
    await loadOppTable();
}

async function loadOppTable() {
    const tenantId = getTenantId();

    // Fetch Opportunities with Property and Template names
    // Note: We need to join manually or use a view. For now, let's fetch raw and enrich client-side or use a view if we had one.
    // Let's try to fetch related data using Supabase syntax if RLS allows.

    const { data: opps, error } = await supabase
        .from('service_opportunities')
        .select(`
            *,
            properties (name),
            service_templates (name)
        `)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('opp-body');
    if (!tbody) return; // Exit if not on the view

    if (error) return tbody.innerHTML = `<tr><td colspan="5" class="text-red-500 px-6 py-4">Error: ${error.message}</td></tr>`;
    if (!opps || !opps.length) return tbody.innerHTML = `<tr><td colspan="5" class="text-center px-6 py-8 text-gray-400">No opportunities found.</td></tr>`;

    // Fetch active jobs for these opportunities to show workflow status
    const oppIds = opps.map(o => o.id);
    const { data: jobs } = await supabase.from('jobs').select('*').in('service_opportunity_id', oppIds);

    tbody.innerHTML = opps.map(o => {
        const relatedJobs = jobs ? jobs.filter(j => j.service_opportunity_id === o.id) : [];
        const propertyName = o.properties ? o.properties.name : 'Unknown Property';
        const templateName = o.service_templates ? o.service_templates.name : 'Unknown Service';

        // Workflow Visualization
        let workflowHTML = '<span class="text-gray-400 text-xs">-</span>';
        if (relatedJobs.length > 0) {
            workflowHTML = `<div class="flex items-center gap-1">
                ${relatedJobs.sort((a, b) => a.id - b.id).map((j, index) => {
                let color = 'bg-gray-100 text-gray-600';
                if (j.status === 'Complete') color = 'bg-green-100 text-green-700';
                if (j.status === 'In Progress') color = 'bg-blue-100 text-blue-700';
                if (j.status === 'Pending') color = 'bg-yellow-50 text-yellow-600 border border-yellow-100';

                const badge = `<span class="text-[10px] px-2 py-0.5 rounded ${color} font-medium border border-transparent" title="${j.type}: ${j.status}">${j.type}</span>`;

                if (index === 0) return badge;
                return `<i data-lucide="arrow-right" class="w-3 h-3 text-gray-300"></i>${badge}`;
            }).join('')}
            </div>`;
        } else if (o.status === 'Pending') {
            workflowHTML = `<button onclick="window.generateWorkflow('${o.id}')" class="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 font-bold">Generate Jobs</button>`;
        }

        return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 group">
            <td class="px-6 py-4 font-medium text-slate-900">${propertyName}</td>
            <td class="px-6 py-4 text-slate-600">${templateName}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(o.status)}">
                    ${o.status}
                </span>
            </td>
            <td class="px-6 py-4">${workflowHTML}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.viewServiceOpp('${o.id}')" class="text-slate-400 hover:text-blue-600 p-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `}).join('');

    window.generateWorkflow = generateWorkflow;
    lucide.createIcons();
}

function getStatusColor(status) {
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'In Progress') return 'bg-blue-100 text-blue-800';
    if (status === 'Complete') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
}

// --- ACTIONS ---
async function generateWorkflow(oppId) {
    const btn = document.activeElement;
    const originalText = btn.innerText;
    btn.innerText = "Generating...";
    btn.disabled = true;

    const { data, error } = await supabase.rpc('generate_service_workflow', {
        p_service_opportunity_id: oppId
    });

    if (error) {
        alert("Error: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    } else {
        console.log("Workflow Generated:", data);
        loadOppTable(); // Refresh
    }
}

// --- MODAL ---
export async function openEditOppModal(opp = null, defaults = {}) {
    // Import dynamically to avoid circular deps if any, or ensuring we have the latest
    const { spawnModal } = await import('../modal_utils.js');
    const tenantId = getTenantId();

    // Fetch Properties & Templates
    const { data: properties } = await supabase.from('properties').select('id, name').eq('tenant_id', tenantId);
    const { data: templates } = await supabase.from('service_templates').select('id, name').eq('tenant_id', tenantId);

    // Determine initial values
    const initialPropId = opp?.property_id || defaults.property_id || '';
    const initialDate = opp?.due_date ? opp.due_date.split('T')[0] : (defaults.due_date || '');

    const propOptions = properties.map(p => `<option value="${p.id}" ${p.id === initialPropId ? 'selected' : ''}>${p.name}</option>`).join('');
    const tempOptions = templates.map(t => `<option value="${t.id}" ${opp && opp.service_template_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('');
    const isEdit = opp && opp.id;
    const uniqueId = Date.now(); // Unique ID for inputs in this specific modal instance

    const html = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 class="font-bold text-lg mb-4">${isEdit ? 'Edit' : 'New'} Service Opportunity</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Property</label>
                    ${(defaults.lock_property && initialPropId) ? (() => {
            const pName = properties.find(p => p.id == initialPropId)?.name || 'Unknown Property';
            return `
                        <div class="w-full border p-2 rounded bg-gray-50 text-gray-600 text-sm font-medium flex items-center justify-between">
                            <span>${pName}</span>
                            <i data-lucide="lock" class="w-3 h-3 text-gray-400"></i>
                        </div>
                        <input type="hidden" id="sel-property-${uniqueId}" value="${initialPropId}">
                        `;
        })() : `
                    <select id="sel-property-${uniqueId}" class="w-full border p-2 rounded bg-white" ${isEdit ? 'disabled' : ''}>
                        ${propOptions}
                    </select>
                    `}
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Service Template</label>
                    <select id="sel-template-${uniqueId}" class="w-full border p-2 rounded bg-white">
                        ${tempOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Source</label>
                    <select id="sel-source-${uniqueId}" class="w-full border p-2 rounded bg-white">
                        <option value="Manual" ${opp && opp.trigger_source === 'Manual' ? 'selected' : ''}>Manual Entry</option>
                        <option value="Phone" ${opp && opp.trigger_source === 'Phone' ? 'selected' : ''}>Phone Call</option>
                        <option value="Email" ${opp && opp.trigger_source === 'Email' ? 'selected' : ''}>Email Request</option>
                        <option value="Text" ${opp && opp.trigger_source === 'Text' ? 'selected' : ''}>Text Message</option>
                        <option value="In Person" ${opp && opp.trigger_source === 'In Person' ? 'selected' : ''}>In Person</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Due Date</label>
                    <input type="date" id="inp-date-${uniqueId}" class="w-full border p-2 rounded" value="${initialDate}">
                </div>
            </div>
            <div class="flex justify-between mt-6">
                ${isEdit ? `<button id="btn-delete-${uniqueId}" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded font-medium">Delete</button>` : '<div></div>'}
                <div class="flex gap-2">
                    <button id="btn-cancel-${uniqueId}" class="px-4 py-2 hover:bg-gray-100 rounded">Cancel</button>
                    <button id="btn-save-${uniqueId}" class="bg-black text-white px-4 py-2 rounded">${isEdit ? 'Save Changes' : 'Create'}</button>
                </div>
            </div>
        </div>
    </div>`;

    const { container, attemptClose, close } = spawnModal(html);

    // Bind Actions
    container.querySelector(`#btn-cancel-${uniqueId}`).onclick = attemptClose;

    if (isEdit) {
        const delBtn = container.querySelector(`#btn-delete-${uniqueId}`);
        if (delBtn) delBtn.onclick = async () => {
            if (!confirm("Are you sure you want to delete this opportunity?")) return;
            const { error } = await supabase.from('service_opportunities').update({ deleted_at: new Date().toISOString() }).eq('id', opp.id);
            if (error) alert("Error deleting: " + error.message);
            else { close(); if (typeof loadOppTable === 'function') loadOppTable(); else window.location.reload(); }
        };
    }

    container.querySelector(`#btn-save-${uniqueId}`).onclick = async () => {
        const propEl = container.querySelector(`#sel-property-${uniqueId}`);
        const tempEl = container.querySelector(`#sel-template-${uniqueId}`);

        const propId = propEl ? propEl.value : null;
        let tempId = tempEl ? tempEl.value : null;
        const source = container.querySelector(`#sel-source-${uniqueId}`).value;
        const date = container.querySelector(`#inp-date-${uniqueId}`).value;



        if (!propId) return alert("Please select Property");

        // allow empty/null tempId
        if (tempId === "") tempId = null;

        // Derive Title
        let title = "New Service Opportunity";
        if (tempId) {
            const t = templates.find(tpl => tpl.id === tempId);
            if (t) title = t.name;
        }

        let error;
        if (isEdit) {
            const { error: err } = await supabase.from('service_opportunities').update({ service_template_id: tempId, trigger_source: source, due_date: date || null }).eq('id', opp.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('service_opportunities').insert({ tenant_id: tenantId, property_id: propId, service_template_id: tempId, trigger_source: source, due_date: date || null, status: 'Pending', title: title });
            error = err;
        }

        if (error) alert("Error: " + error.message);
        else { close(); if (typeof loadOppTable === 'function') loadOppTable(); }
    };
}

async function openDetailModal(opp) {
    const container = document.getElementById('modal-container');

    // Fetch related names if not present (though we usually fetch them in the table)
    // For simplicity, let's just show what we have or fetch if needed.
    // The 'opp' object passed from viewServiceOpp comes from a fresh fetch, so let's enrich it there or here.

    // Fetch related names if not present (though we usually fetch them in the table)
    // For simplicity, let's just show what we have or fetch if needed.
    // The 'opp' object passed from viewServiceOpp comes from a fresh fetch, so let's enrich it there or here.

    // Let's fetch enriched data for the modal
    const { data: enrichedOpp, error } = await supabase
        .from('service_opportunities')
        .select(`
            *,
            properties (name),
            service_templates (name, description)
        `)
        .eq('id', opp.id)
        .single();

    if (error) return alert("Error fetching details: " + error.message);

    const propName = enrichedOpp.properties ? enrichedOpp.properties.name : 'Unknown';
    const serviceName = enrichedOpp.service_templates ? enrichedOpp.service_templates.name : 'Unknown';
    const serviceDesc = enrichedOpp.service_templates ? enrichedOpp.service_templates.description : '';

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 class="font-bold text-lg text-slate-800">Opportunity Details</h3>
                <span class="px-2 py-1 rounded text-xs font-bold ${getStatusColor(enrichedOpp.status)}">${enrichedOpp.status}</span>
            </div>
            
            <div class="p-6 space-y-6">
                <div>
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Property</h4>
                    <p class="text-slate-900 font-medium text-lg">${propName}</p>
                </div>

                <div>
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Service</h4>
                    <p class="text-slate-900 font-medium text-lg">${serviceName}</p>
                    <p class="text-slate-500 text-sm">${serviceDesc || 'No description'}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Source</h4>
                        <p class="text-slate-700">${enrichedOpp.trigger_source || 'Manual'}</p>
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Due Date</h4>
                        <p class="text-slate-700">${enrichedOpp.due_date ? new Date(enrichedOpp.due_date).toLocaleDateString() : 'None'}</p>
                    </div>
                </div>

                <div class="pt-4 border-t border-gray-100">
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Workflow Status</h4>
                    <div id="modal-workflow-status" class="text-sm text-gray-500">Loading jobs...</div>
                </div>
            </div>

            <div class="bg-gray-50 px-6 py-4 flex justify-between items-center">
                <button id="btn-edit-opp" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit Details</button>
                <button id="btn-close" class="bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded hover:bg-gray-50 font-medium shadow-sm">Close</button>
            </div>
        </div>
    </div>`;

    // Fetch jobs AND tasks for this opp
    const { data: jobs } = await supabase
        .from('jobs')
        .select(`
            *,
            job_tasks (id, title, status),
            job_inputs (
                id, 
                value, 
                job_template_inputs (label, input_type)
            )
        `)
        .eq('service_opportunity_id', opp.id)
        .order('id', { ascending: true });

    const workflowContainer = document.getElementById('modal-workflow-status');

    if (jobs && jobs.length > 0) {
        workflowContainer.innerHTML = `<div class="space-y-3">
            ${jobs.map(j => {
            // Sort tasks by ID for now (or order_index if we had it joined)
            const tasks = j.job_tasks ? j.job_tasks.sort((a, b) => a.id - b.id) : [];

            return `
                <div class="bg-white p-3 rounded border border-gray-200">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-slate-700 text-sm">${j.type}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded ${j.status === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${j.status}</span>
                    </div>
                    
                    ${tasks.length > 0 ? `
                        <div class="space-y-1 pl-2 border-l-2 border-gray-100">
                            ${tasks.map(t => `
                                <div class="flex items-center gap-2 text-xs text-gray-600">
                                    <i data-lucide="${t.status === 'Complete' ? 'check-square' : 'square'}" class="w-3 h-3 ${t.status === 'Complete' ? 'text-green-500' : 'text-gray-300'}"></i>
                                    <span class="${t.status === 'Complete' ? 'line-through text-gray-400' : ''}">${t.title}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="text-[10px] text-gray-400 italic pl-2">No tasks</div>'}

                    ${j.job_inputs && j.job_inputs.length > 0 ? `
                        <div class="mt-3 pt-2 border-t border-gray-50">
                            <h5 class="text-[10px] font-bold text-gray-400 uppercase mb-1">Required Inputs</h5>
                            <div class="space-y-2">
                                ${j.job_inputs.map(i => {
                const label = i.job_template_inputs ? i.job_template_inputs.label : 'Input';
                const type = i.job_template_inputs ? i.job_template_inputs.input_type : 'text';
                const value = i.value || '';

                return `
                                    <div class="flex flex-col gap-1">
                                        <label class="text-xs text-gray-600 font-medium">${label}</label>
                                        <input type="${type === 'photo' ? 'text' : type}" 
                                            value="${value}" 
                                            placeholder="${type === 'photo' ? 'Photo URL' : 'Enter value...'}"
                                            class="w-full text-xs p-1.5 border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-300 outline-none transition-colors"
                                            disabled> <!-- Read-only for now -->
                                    </div>`;
            }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('')}
        </div>`;
        lucide.createIcons();
    } else {
        workflowContainer.innerHTML = '<p class="italic">No active workflow jobs.</p>';
    }

    const safeClose = setupModalGuard('modal-container', () => { container.innerHTML = ''; });
    document.getElementById('btn-close').onclick = safeClose;

    document.getElementById('btn-edit-opp').onclick = () => {
        openEditOppModal(enrichedOpp);
    };
}

window.viewServiceOpp = async (id) => {
    // We pass a minimal object, openDetailModal will fetch the rest
    openDetailModal({ id });
};
