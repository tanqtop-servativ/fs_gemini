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
            job_templates (name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('opp-body');

    if (error) return tbody.innerHTML = `<tr><td colspan="5" class="text-red-500 px-6 py-4">Error: ${error.message}</td></tr>`;
    if (!opps || !opps.length) return tbody.innerHTML = `<tr><td colspan="5" class="text-center px-6 py-8 text-gray-400">No opportunities found.</td></tr>`;

    // Fetch active jobs for these opportunities to show workflow status
    const oppIds = opps.map(o => o.id);
    const { data: jobs } = await supabase.from('jobs').select('*').in('service_opportunity_id', oppIds);

    tbody.innerHTML = opps.map(o => {
        const relatedJobs = jobs ? jobs.filter(j => j.service_opportunity_id === o.id) : [];
        const propertyName = o.properties ? o.properties.name : 'Unknown Property';
        const templateName = o.job_templates ? o.job_templates.name : 'Unknown Service';

        // Workflow Visualization
        let workflowHTML = '<span class="text-gray-400 text-xs">-</span>';
        if (relatedJobs.length > 0) {
            workflowHTML = `<div class="flex gap-1">
                ${relatedJobs.map(j => {
                let color = 'bg-gray-100 text-gray-600';
                if (j.status === 'Complete') color = 'bg-green-100 text-green-700';
                if (j.status === 'In Progress') color = 'bg-blue-100 text-blue-700';
                if (j.status === 'Pending') color = 'bg-yellow-50 text-yellow-600 border border-yellow-100';

                return `<span class="text-[10px] px-2 py-0.5 rounded ${color} font-medium border border-transparent" title="${j.type}: ${j.status}">${j.type}</span>`;
            }).join('')}
            </div>`;
        } else if (o.status === 'Pending') {
            workflowHTML = `<button onclick="window.generateWorkflow(${o.id})" class="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 font-bold">Generate Jobs</button>`;
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
                <button class="text-slate-400 hover:text-blue-600 p-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
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
async function openEditOppModal(opp) {
    const tenantId = getTenantId();
    const container = document.getElementById('modal-container');

    // Fetch Properties & Templates
    const { data: properties } = await supabase.from('properties').select('id, name').eq('tenant_id', tenantId);
    const { data: templates } = await supabase.from('job_templates').select('id, name').eq('tenant_id', tenantId);

    const propOptions = properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const tempOptions = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 class="font-bold text-lg mb-4">New Service Opportunity</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Property</label>
                    <select id="sel-property" class="w-full border p-2 rounded bg-white">${propOptions}</select>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Service Template</label>
                    <select id="sel-template" class="w-full border p-2 rounded bg-white">${tempOptions}</select>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Source</label>
                    <select id="sel-source" class="w-full border p-2 rounded bg-white">
                        <option value="Manual">Manual Entry</option>
                        <option value="Phone">Phone Call</option>
                        <option value="Email">Email Request</option>
                        <option value="Text">Text Message</option>
                        <option value="In Person">In Person</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Due Date</label>
                    <input type="date" id="inp-date" class="w-full border p-2 rounded">
                </div>
            </div>
            <div class="flex justify-end mt-6 gap-2">
                <button id="btn-cancel" class="px-4 py-2 hover:bg-gray-100 rounded">Cancel</button>
                <button id="btn-save" class="bg-black text-white px-4 py-2 rounded">Create</button>
            </div>
        </div>
    </div>`;

    const safeClose = setupModalGuard('modal-container', () => { container.innerHTML = ''; });
    document.getElementById('btn-cancel').onclick = safeClose;

    document.getElementById('btn-save').onclick = async () => {
        const propId = document.getElementById('sel-property').value;
        const tempId = document.getElementById('sel-template').value;
        const source = document.getElementById('sel-source').value;
        const date = document.getElementById('inp-date').value;

        if (!propId || !tempId) return alert("Please select Property and Template");

        const { error } = await supabase.from('service_opportunities').insert({
            tenant_id: tenantId,
            property_id: propId,
            job_template_id: tempId,
            trigger_source: source,
            due_date: date || null,
            status: 'Pending'
        });

        if (error) {
            alert("Error: " + error.message);
        } else {
            container.innerHTML = '';
            loadOppTable();
        }
    };
}
