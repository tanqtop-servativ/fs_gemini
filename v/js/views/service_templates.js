
import { supabase } from '../supabase.js';
import { getTenantId } from '../utils.js';
import { renderAuditHistory } from './audit.js';

export async function renderServiceTemplates(container) {
    const tenantId = getTenantId();
    let templates = [];
    let jobTemplates = []; // For selection in modal

    // --- FETCH ---
    const fetchTemplates = async () => {
        // Fetch Service Templates
        const { data: st, error: err1 } = await supabase
            .from('service_templates')
            .select('*, service_workflow_steps(*, job_templates(name, name_es))')
            .eq('tenant_id', tenantId)
            .order('name');

        if (err1) return alert("Error fetching templates: " + err1.message);
        templates = st;

        // Fetch Job Templates (for dropdowns)
        const { data: jt, error: err2 } = await supabase
            .from('job_templates')
            .select('id, name, name_es')
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)
            .order('name');

        if (err2) console.error("Error fetching job templates", err2);
        else jobTemplates = jt;

        renderList();
    };

    // --- RENDER LIST ---
    const renderList = () => {
        container.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold text-slate-900">Service Templates</h1>
                    <p class="text-gray-500">Define standard service workflows (e.g. Turnaround, Warranty)</p>
                </div>
                <button id="btn-new-st" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
                    <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Service
                </button>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                            <th class="px-6 py-4">Service Name</th>
                            <th class="px-6 py-4">Description</th>
                            <th class="px-6 py-4">Workflow Steps</th>
                            <th class="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="st-body"></tbody>
                </table>
            </div>
            <div id="modal-container"></div>
        `;

        const tbody = document.getElementById('st-body');
        if (templates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">No services defined. Create one to get started.</td></tr>`;
        } else {
            tbody.innerHTML = templates.map(t => {
                const steps = (t.service_workflow_steps || []).sort((a, b) => a.sort_order - b.sort_order);
                const stepCount = steps.length;
                const stepNames = steps.slice(0, 3).map(s => s.job_templates?.name || 'Unknown').join(' → ');

                return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer" onclick="window.viewST('${t.id}')">
                    <td class="px-6 py-4 font-bold text-slate-900">${t.name}</td>
                    <td class="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">${t.description || '-'}</td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1">
                            <span class="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold w-fit">${stepCount} Steps</span>
                            <span class="text-xs text-gray-400">${stepNames}${stepCount > 3 ? '...' : ''}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-slate-400 hover:text-blue-600 p-2" onclick="event.stopPropagation(); window.viewST('${t.id}')"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        window.viewST = (id) => {
            const t = templates.find(x => x.id === id);
            if (t) openDetailModal(t);
        };

        window.editST = (id) => {
            const t = templates.find(x => x.id === id);
            if (t) openEditModal(t);
        };

        document.getElementById('btn-new-st').onclick = () => openEditModal(null);
        lucide.createIcons();
    };

    // --- DETAIL MODAL ---
    const openDetailModal = (tmpl) => {
        const steps = (tmpl.service_workflow_steps || []).sort((a, b) => a.sort_order - b.sort_order);
        const modal = document.getElementById('modal-container');

        const stepsHtml = steps.length > 0 ? steps.map((s, idx) => {
            const jobName = s.job_templates?.name || 'Unknown Job';
            return `
            <div class="flex items-center gap-3 p-3 border-b border-gray-100 last:border-0 hover:bg-slate-50">
                <div class="font-mono text-gray-300 text-sm w-6 text-center select-none">${idx + 1}</div>
                <div class="flex-1">
                    <div class="font-bold text-slate-800">${jobName}</div>
                    <div class="flex gap-2 mt-1">
                        ${s.is_optional ? '<span class="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Optional</span>' : ''}
                        ${s.is_billing ? '<span class="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Billing</span>' : ''}
                        ${s.delay_hours ? `<span class="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Delay: ${s.delay_hours}h</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('') : '<div class="text-gray-400 italic text-sm p-4 text-center">No steps defined.</div>';

        modal.innerHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-100 flex justify-between items-start bg-slate-50 rounded-t-xl">
                        <div>
                            <h2 class="text-xl font-bold text-slate-900">${tmpl.name}</h2>
                        </div>
                        <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-6 h-6"></i></button>
                    </div>
                    
                    <div class="p-6 overflow-y-auto flex-1">
                        <div class="mb-6">
                            <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Description</h3>
                            <p class="text-sm text-gray-700">${tmpl.description || 'No description provided.'}</p>
                        </div>

                        <div class="mb-6">
                            <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Workflow Steps</h3>
                            <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                ${stepsHtml}
                            </div>
                        </div>

                        <div id="st-audit-log" class="mt-8 pt-4 border-t border-gray-100"></div>
                    </div>

                    <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                        <button id="btn-edit-st" class="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 flex items-center">
                            <i data-lucide="pencil" class="w-4 h-4 mr-2"></i> Edit Template
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-close-modal').onclick = () => modal.innerHTML = '';
        document.getElementById('btn-edit-st').onclick = () => openEditModal(tmpl);

        renderAuditHistory('st-audit-log', 'service_templates', tmpl.id);
        lucide.createIcons();
    };

    // --- EDIT MODAL ---
    const openEditModal = (tmpl) => {
        const isEdit = !!tmpl;
        // Clone steps so we can edit in memory
        let steps = tmpl ? (tmpl.service_workflow_steps || []).sort((a, b) => a.sort_order - b.sort_order).map(s => ({ ...s })) : [];
        // Add temp ID for new steps to track them locally
        steps.forEach((s, i) => s._tempId = i);
        let nextTempId = steps.length;

        const modal = document.getElementById('modal-container');

        const renderSteps = () => {
            const list = document.getElementById('step-list');
            if (!list) return;

            if (steps.length === 0) {
                list.innerHTML = `<div class="text-center text-gray-400 text-xs italic py-6 border border-dashed border-gray-300 rounded bg-gray-50">No workflow steps defined. Add a job template below.</div>`;
                return;
            }

            list.innerHTML = steps.map((s, idx) => {
                const jobName = s.job_templates?.name || jobTemplates.find(j => j.id === s.job_template_id)?.name || 'Unknown Job';

                return `
                <div class="flex items-center gap-3 bg-white p-3 rounded border border-gray-200 shadow-sm group step-item" data-idx="${idx}">
                    <div class="text-gray-300 font-bold text-lg select-none w-6 text-center cursor-grab active:cursor-grabbing handle">${idx + 1}</div>
                    
                    <div class="flex-1">
                        <div class="font-bold text-slate-800 flex items-center gap-2">
                             ${jobName}
                        </div>
                        <div class="flex gap-4 mt-2">
                            <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" class="chk-optional rounded text-blue-600 focus:ring-0" data-idx="${idx}" ${s.is_optional ? 'checked' : ''}>
                                <span class="text-xs text-gray-600 font-medium">Optional</span>
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" class="chk-billing rounded text-green-600 focus:ring-0" data-idx="${idx}" ${s.is_billing ? 'checked' : ''}>
                                <span class="text-xs text-gray-600 font-medium">Billing Event</span>
                            </label>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs text-gray-400">Delay:</span>
                                <input type="number" class="inp-delay w-12 border rounded text-xs p-0.5 text-center" value="${s.delay_hours || 0}" min="0" data-idx="${idx}">
                                <span class="text-xs text-gray-400">hrs</span>
                            </div>
                        </div>
                    </div>

                    <button class="text-red-300 hover:text-red-500 p-2 btn-remove" data-idx="${idx}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>`;
            }).join('');

            // Bindings
            list.querySelectorAll('.chk-optional').forEach(el => el.onchange = (e) => steps[el.dataset.idx].is_optional = e.target.checked);
            list.querySelectorAll('.chk-billing').forEach(el => el.onchange = (e) => steps[el.dataset.idx].is_billing = e.target.checked);
            list.querySelectorAll('.inp-delay').forEach(el => el.onchange = (e) => steps[el.dataset.idx].delay_hours = parseInt(e.target.value) || 0);
            list.querySelectorAll('.btn-remove').forEach(el => el.onclick = () => {
                steps.splice(el.dataset.idx, 1);
                renderSteps();
            });

            lucide.createIcons();

            // Sortable
            if (Sortable) {
                Sortable.create(list, {
                    animation: 150,
                    handle: '.handle',
                    ghostClass: 'bg-blue-50',
                    onEnd: () => {
                        const newOrder = [];
                        list.querySelectorAll('.step-item').forEach(el => {
                            newOrder.push(steps[parseInt(el.dataset.idx)]);
                        });
                        steps = newOrder;
                        renderSteps();
                    }
                });
            }
        };

        const jobOptions = jobTemplates.map(j => `<option value="${j.id}">${j.name}</option>`).join('');

        modal.innerHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl flex-shrink-0">
                        <h2 class="text-xl font-bold text-slate-800">${isEdit ? 'Edit Service Workflow' : 'New Service Workflow'}</h2>
                        <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1 space-y-6">
                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Service Name</label>
                                <input id="inp-name" class="w-full border p-2 rounded font-bold text-lg" placeholder="e.g. Full Turnaround" value="${tmpl ? tmpl.name : ''}">
                            </div>
                            <div>
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
                                <textarea id="inp-desc" class="w-full border p-2 rounded text-sm h-16 resize-none" placeholder="Description...">${tmpl ? (tmpl.description || '') : ''}</textarea>
                            </div>
                        </div>

                        <div class="border-t border-gray-100 pt-4">
                            <h3 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <i data-lucide="git-merge" class="w-4 h-4 text-blue-500"></i> Workflow Steps
                            </h3>
                            
                            <div id="step-list" class="space-y-2 mb-4"></div>

                            <div class="flex gap-2 bg-slate-50 p-3 rounded border border-dashed border-gray-300 items-center">
                                <select id="sel-add-job" class="flex-1 border border-gray-300 rounded text-sm p-1.5 bg-white">
                                    <option value="">-- Select Job Template to Add --</option>
                                    ${jobOptions}
                                </select>
                                <button id="btn-add-step" class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-blue-700 whitespace-nowrap">
                                    + Add Step
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center flex-shrink-0">
                        ${isEdit ? '<button id="btn-delete" class="text-red-500 hover:text-red-700 text-sm font-bold">Delete Service</button>' : '<div></div>'}
                        <div class="flex gap-2">
                            <button id="btn-cancel" class="px-4 py-2 text-sm hover:bg-gray-200 rounded text-gray-600">Cancel</button>
                            <button id="btn-save" class="bg-black text-white px-6 py-2 rounded text-sm font-bold hover:bg-gray-800">Save Workflow</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderSteps();

        // Listeners
        document.getElementById('btn-close-modal').onclick = () => isEdit ? openDetailModal(tmpl) : modal.innerHTML = '';
        document.getElementById('btn-cancel').onclick = () => isEdit ? openDetailModal(tmpl) : modal.innerHTML = '';

        document.getElementById('btn-add-step').onclick = () => {
            const sel = document.getElementById('sel-add-job');
            const jId = sel.value;
            if (!jId) return;

            steps.push({
                job_template_id: jId,
                is_optional: false,
                is_billing: false,
                delay_hours: 0,
                sort_order: steps.length,
                _tempId: nextTempId++ // internal tracking
            });
            sel.value = "";
            renderSteps();
        };

        if (isEdit) {
            document.getElementById('btn-delete').onclick = async () => {
                if (!confirm("Are you sure? This will delete the service template.")) return;
                const { error } = await supabase.from('service_templates').delete().eq('id', tmpl.id);
                if (error) alert("Error: " + error.message);
                else { modal.innerHTML = ''; fetchTemplates(); }
            };
        }

        document.getElementById('btn-save').onclick = async () => {
            const name = document.getElementById('inp-name').value.trim();
            const desc = document.getElementById('inp-desc').value.trim();
            if (!name) return alert("Service Name is required");

            // 1. Upsert Service Template
            const stPayload = { name: name, description: desc, tenant_id: tenantId };
            let stId = tmpl ? tmpl.id : null;

            if (stId) {
                const { error } = await supabase.from('service_templates').update(stPayload).eq('id', stId);
                if (error) return alert("Error saving service: " + error.message);
            } else {
                const { data, error } = await supabase.from('service_templates').insert(stPayload).select().single();
                if (error) return alert("Error creating service: " + error.message);
                stId = data.id;
            }

            // 2. Sync Steps
            // Strategy: Delete all existing steps for this service, then recreate.
            // (Simpler than diffing, efficient enough for small lists)

            // First delete
            await supabase.from('service_workflow_steps').delete().eq('service_template_id', stId);

            // Then insert
            if (steps.length > 0) {
                const stepRows = steps.map((s, idx) => ({
                    tenant_id: tenantId,
                    service_template_id: stId,
                    job_template_id: s.job_template_id,
                    sort_order: idx,
                    is_optional: s.is_optional,
                    is_billing: s.is_billing,
                    delay_hours: s.delay_hours
                }));

                const { error: errSteps } = await supabase.from('service_workflow_steps').insert(stepRows);
                if (errSteps) return alert("Error saving steps: " + errSteps.message);
            }

            modal.innerHTML = '';
            fetchTemplates();
        };

        lucide.createIcons();
    };

    fetchTemplates();
}
