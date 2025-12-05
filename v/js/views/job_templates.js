import { supabase } from '../supabase.js';
import { setupModalGuard } from '../modal_utils.js';
import { renderAuditHistory } from './audit.js';
import { getTenantId } from '../utils.js';

export async function renderJobTemplates(container) {
    const tenantId = getTenantId();
    let templates = [];

    // --- FETCH ---
    const fetchTemplates = async (showArchived = false) => {
        let query = supabase
            .from('job_templates')
            .select('*, job_template_tasks(*, job_template_checklist_items(*))')
            .eq('tenant_id', tenantId)
            .order('name');

        if (!showArchived) {
            query = query.is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) return alert("Error fetching templates: " + error.message);
        templates = data;
        renderList(showArchived);
    };

    // --- RENDER LIST ---
    const renderList = (showArchived) => {
        container.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <div><h1 class="text-2xl font-bold text-slate-900">Job Templates</h1><p class="text-gray-500">Manage standard job workflows</p></div>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" id="chk-show-archived" class="rounded border-gray-300 text-black focus:ring-0" ${showArchived ? 'checked' : ''}>
                        Show Archived
                    </label>
                    <button id="btn-new-tmpl" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Template
                    </button>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                            <th class="px-6 py-4">Template Name</th>
                            <th class="px-6 py-4">Description</th>
                            <th class="px-6 py-4">Tasks</th>
                            <th class="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="tmpl-body"></tbody>
                </table>
            </div>
            <div id="modal-container"></div>
        `;

        const tbody = document.getElementById('tmpl-body');
        if (templates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">No templates found. Create one to get started.</td></tr>`;
        } else {
            tbody.innerHTML = templates.map(t => {
                const isDeleted = !!t.deleted_at;
                const taskCount = t.job_template_tasks ? t.job_template_tasks.length : 0;
                const rowClass = isDeleted ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50';
                const nameClass = isDeleted ? 'line-through text-gray-500' : 'text-slate-900';

                return `
                <tr class="border-b border-gray-100 ${rowClass} group cursor-pointer" onclick="window.viewTmpl('${t.id}')">
                    <td class="px-6 py-4 font-bold ${nameClass}">
                        ${t.name}
                        ${isDeleted ? '<span class="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded no-underline">ARCHIVED</span>' : ''}
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">${t.description || '-'}</td>
                    <td class="px-6 py-4">
                        <span class="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-bold">${taskCount} Tasks</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-slate-400 hover:text-blue-600 p-2" onclick="event.stopPropagation(); window.viewTmpl('${t.id}')"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        window.viewTmpl = (id) => {
            const t = templates.find(x => x.id === id);
            if (t) openDetailModal(t);
        };

        window.editTmpl = (id) => {
            const t = templates.find(x => x.id === id);
            if (t) openEditModal(t);
        };

        document.getElementById('btn-new-tmpl').onclick = () => openEditModal(null);
        document.getElementById('chk-show-archived').onchange = (e) => fetchTemplates(e.target.checked);
        lucide.createIcons();
    };

    // --- DETAIL MODAL ---
    const openDetailModal = (tmpl) => {
        const isDeleted = !!tmpl.deleted_at;
        const tasks = (tmpl.job_template_tasks || []).sort((a, b) => a.sort_order - b.sort_order);
        const modal = document.getElementById('modal-container');

        const taskListHTML = tasks.length > 0 ? tasks.map((t, idx) => {
            const checklist = (t.job_template_checklist_items || []).sort((a, b) => a.sort_order - b.sort_order);
            const checklistHTML = checklist.length > 0 ? `
                <div class="mt-3 bg-slate-50/50 rounded p-2 border border-slate-100">
                    <div class="text-[10px] font-bold uppercase text-slate-400 mb-1">Checklist</div>
                    <ul class="space-y-1">
                        ${checklist.map(c => `
                            <li class="flex items-start gap-2 text-xs text-slate-600">
                                <i data-lucide="${c.item_type === 'input' ? 'pen-tool' : 'check-square'}" class="w-3 h-3 mt-0.5 text-slate-400"></i>
                                <div>
                                    <span>${c.description}</span>
                                    ${c.item_type === 'input' ? '<span class="ml-1 text-[10px] bg-slate-200 px-1 rounded text-slate-500">Input</span>' : ''}
                                    ${c.description_es ? `<div class="text-[10px] text-slate-400 italic">${c.description_es}</div>` : ''}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>` : '';

            return `
            <div class="flex gap-3 items-start p-3 border-b border-gray-100 last:border-0">
                <div class="mt-1 text-slate-400 font-mono text-xs w-6">${idx + 1}.</div>
                <div class="flex-1">
                    <div class="font-bold text-sm text-slate-800">${t.title}</div>
                    ${t.description ? `<div class="text-xs text-gray-500 mt-1">${t.description}</div>` : ''}
                    <div class="flex gap-2 mt-2">
                        ${t.is_required ? '<span class="text-[10px] font-bold uppercase text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Required</span>' : ''}
                        ${t.require_photo ? '<span class="text-[10px] font-bold uppercase text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Photo Req.</span>' : ''}
                    </div>
                    ${checklistHTML}
                </div>
                ${t.title_es ? `
                <div class="flex-1 border-l border-gray-100 pl-3">
                    <div class="font-bold text-sm text-slate-600">${t.title_es}</div>
                    ${t.description_es ? `<div class="text-xs text-gray-400 mt-1">${t.description_es}</div>` : ''}
                </div>` : ''}
            </div>
        `}).join('') : '<div class="text-gray-400 text-sm italic p-4 text-center">No tasks defined.</div>';

        modal.innerHTML = `
        < div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" >
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div class="p-6 border-b border-gray-100 flex justify-between items-start bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                            ${tmpl.name}
                            ${isDeleted ? '<span class="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold uppercase">Archived</span>' : ''}
                        </h2>
                        ${tmpl.name_es ? `<p class="text-sm text-blue-600 font-medium mt-1">${tmpl.name_es}</p>` : ''}
                    </div>
                    <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-6 h-6"></i></button>
                </div>

                <div class="p-6 overflow-y-auto flex-1">
                    <div class="mb-6">
                        <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Description</h3>
                        <p class="text-sm text-gray-700">${tmpl.description || 'No description provided.'}</p>
                        ${tmpl.description_es ? `<p class="text-sm text-gray-500 mt-2 italic border-l-2 border-blue-200 pl-2">${tmpl.description_es}</p>` : ''}
                    </div>

                    <div>
                        <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Tasks (${tasks.length})</h3>
                        <div class="bg-slate-50 rounded-lg border border-gray-200">
                            ${taskListHTML}
                        </div>
                        <div id="job-audit-log" class="mt-6 pt-4 border-t border-gray-100"></div>
                    </div>
                </div>

                <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
                    ${!isDeleted ? `<button id="btn-edit-tmpl" class="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 flex items-center"><i data-lucide="pencil" class="w-4 h-4 mr-2"></i> Edit Template</button>` : ''}
                </div>
            </div>
            </div >
        `;

        document.getElementById('btn-close-modal').onclick = () => modal.innerHTML = '';
        if (!isDeleted) {
            document.getElementById('btn-edit-tmpl').onclick = () => openEditModal(tmpl);
        }
        renderAuditHistory('job-audit-log', 'job_templates', tmpl.id);
        lucide.createIcons();
    };

    // --- EDIT MODAL ---
    const openEditModal = (tmpl) => {
        const isEdit = !!tmpl;
        const isDeleted = tmpl && !!tmpl.deleted_at;
        let tasks = tmpl ? (tmpl.job_template_tasks || []).sort((a, b) => a.sort_order - b.sort_order) : [];
        // Normalize checklist
        tasks.forEach(t => {
            if (!t.checklist && t.job_template_checklist_items) {
                t.checklist = t.job_template_checklist_items.map(c => ({
                    description: c.description,
                    description_es: c.description_es,
                    item_type: c.item_type,
                    sort_order: c.sort_order
                })).sort((a, b) => a.sort_order - b.sort_order);
            }
            if (!t.checklist) t.checklist = [];
        });

        const modal = document.getElementById('modal-container');

        const renderTasks = () => {
            const list = document.getElementById('task-list');
            if (!list) return;
            if (tasks.length === 0) {
                list.innerHTML = `< div class="text-center text-gray-400 text-xs italic py-4" > No tasks added yet.</div > `;
                return;
            }
            list.innerHTML = tasks.map((t, idx) => `
        < div class="flex gap-3 items-start bg-slate-50 p-3 rounded border border-slate-200 group task-item" data - original - idx="${idx}" >
                    <div class="mt-1 flex flex-col items-center gap-2">
                        <i data-lucide="grip-vertical" class="drag-handle w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing"></i>
                        <div class="text-slate-400 font-mono text-xs">${idx + 1}</div>
                    </div>
                    <div class="flex-1 space-y-3">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-gray-400 mb-1">English</label>
                                <input class="w-full border p-1.5 rounded text-sm font-bold bg-white task-title" data-idx="${idx}" placeholder="Task Title (EN)" value="${t.title}">
                                <textarea class="w-full border p-1.5 rounded text-xs bg-white resize-none h-16 task-desc mt-1" data-idx="${idx}" placeholder="Description (EN)...">${t.description || ''}</textarea>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-blue-400 mb-1">Spanish (Español)</label>
                                <input class="w-full border p-1.5 rounded text-sm font-bold bg-white task-title-es border-blue-100" data-idx="${idx}" placeholder="Título de la Tarea (ES)" value="${t.title_es || ''}">
                                <textarea class="w-full border p-1.5 rounded text-xs bg-white resize-none h-16 task-desc-es mt-1 border-blue-100" data-idx="${idx}" placeholder="Descripción (ES)...">${t.description_es || ''}</textarea>
                            </div>
                        </div>
                        
                        <!-- Checklist Section -->
                        <div class="border-t border-slate-200 pt-3">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-bold uppercase text-slate-400">Checklist Items</span>
                            </div>
                            <div class="space-y-2 mb-2">
                                ${(t.checklist || []).map((c, cIdx) => `
                                    <div class="flex items-start gap-2 bg-white border border-gray-200 p-2 rounded">
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                                            <input class="w-full border p-1 rounded text-xs check-desc" data-t-idx="${idx}" data-c-idx="${cIdx}" placeholder="Item (EN)" value="${c.description}">
                                            <input class="w-full border p-1 rounded text-xs check-desc-es border-blue-50" data-t-idx="${idx}" data-c-idx="${cIdx}" placeholder="Item (ES)" value="${c.description_es || ''}">
                                        </div>
                                        <select class="border p-1 rounded text-xs h-7 check-type" data-t-idx="${idx}" data-c-idx="${cIdx}">
                                            <option value="simple" ${c.item_type === 'simple' ? 'selected' : ''}>Check</option>
                                            <option value="input" ${c.item_type === 'input' ? 'selected' : ''}>Input</option>
                                        </select>
                                        <button class="text-red-300 hover:text-red-500 btn-del-check pt-1" data-t-idx="${idx}" data-c-idx="${cIdx}"><i data-lucide="x" class="w-3 h-3"></i></button>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-300 btn-add-check" data-idx="${idx}">+ Add Item</button>
                        </div>

                        <div class="flex gap-4 pt-1 border-t border-slate-100 mt-2">
                            <label class="flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" class="task-req" data-idx="${idx}" ${t.is_required ? 'checked' : ''}>
                                <span class="text-xs text-slate-600">Required</span>
                            </label>
                            <label class="flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" class="task-photo" data-idx="${idx}" ${t.require_photo ? 'checked' : ''}>
                                <span class="text-xs text-slate-600">Photo Required</span>
                            </label>
                        </div>
                    </div>
                    <button class="text-red-300 hover:text-red-500 btn-del-task" data-idx="${idx}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div >
        `).join('');

            // Bind Events
            // Task Fields
            list.querySelectorAll('.task-title').forEach(el => el.oninput = (e) => tasks[el.dataset.idx].title = e.target.value);
            list.querySelectorAll('.task-desc').forEach(el => el.oninput = (e) => tasks[el.dataset.idx].description = e.target.value);
            list.querySelectorAll('.task-title-es').forEach(el => el.oninput = (e) => tasks[el.dataset.idx].title_es = e.target.value);
            list.querySelectorAll('.task-desc-es').forEach(el => el.oninput = (e) => tasks[el.dataset.idx].description_es = e.target.value);
            list.querySelectorAll('.task-req').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].is_required = e.target.checked);
            list.querySelectorAll('.task-photo').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].require_photo = e.target.checked);
            list.querySelectorAll('.btn-del-task').forEach(el => el.onclick = () => { tasks.splice(el.dataset.idx, 1); renderTasks(); });

            // Checklist Fields
            list.querySelectorAll('.check-desc').forEach(el => el.oninput = (e) => tasks[el.dataset.tIdx].checklist[el.dataset.cIdx].description = e.target.value);
            list.querySelectorAll('.check-desc-es').forEach(el => el.oninput = (e) => tasks[el.dataset.tIdx].checklist[el.dataset.cIdx].description_es = e.target.value);
            list.querySelectorAll('.check-type').forEach(el => el.onchange = (e) => tasks[el.dataset.tIdx].checklist[el.dataset.cIdx].item_type = e.target.value);

            list.querySelectorAll('.btn-del-check').forEach(el => el.onclick = () => {
                tasks[el.dataset.tIdx].checklist.splice(el.dataset.cIdx, 1);
                renderTasks();
            });

            list.querySelectorAll('.btn-add-check').forEach(el => el.onclick = () => {
                tasks[el.dataset.idx].checklist.push({ description: '', description_es: '', item_type: 'simple', sort_order: tasks[el.dataset.idx].checklist.length });
                renderTasks();
            });

            // Init Sortable (Task reorder)
            if (Sortable) {
                Sortable.create(list, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'bg-blue-50',
                    onEnd: async () => {
                        const newOrder = [];
                        list.querySelectorAll('.task-item').forEach(el => {
                            newOrder.push(tasks[parseInt(el.dataset.originalIdx)]);
                        });
                        tasks = newOrder;
                        renderTasks();

                        // Immediate reorder save not implemented for checklists yet (only tasks)
                        // If we are editing an existing template, sync order to DB immediately
                        if (tmpl && tmpl.id) {
                            // Reorder Logic for Tasks (matches previous implementation)
                            const items = tasks.map((t, idx) => ({ id: t.id, order: idx }));
                            const validItems = items.filter(i => i.id);
                            if (validItems.length > 0) {
                                const { error } = await supabase.rpc('reorder_items', {
                                    p_table: 'job_template_tasks',
                                    p_id_col: 'id',
                                    p_order_col: 'sort_order',
                                    p_items: validItems
                                });
                                if (error) console.error("Reorder failed:", error);
                            }
                        }
                    }
                });
            }

            lucide.createIcons();
        };

        modal.innerHTML = `
        < div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" >
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h2 class="text-xl font-bold text-slate-800">${isEdit ? 'Edit Job Template' : 'New Job Template'}</h2>
                    <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <div class="p-6 overflow-y-auto flex-1 space-y-6">
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Template Name (EN)</label>
                                <input id="inp-name" class="w-full border p-2 rounded font-bold text-lg" placeholder="e.g. Standard Cleaning" value="${tmpl ? tmpl.name : ''}">
                            </div>
                            <div>
                                <label class="block text-xs font-bold uppercase text-blue-500 mb-1">Template Name (ES)</label>
                                <input id="inp-name-es" class="w-full border border-blue-100 p-2 rounded font-bold text-lg" placeholder="e.g. Limpieza Estándar" value="${tmpl ? (tmpl.name_es || '') : ''}">
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Description (EN)</label>
                                <textarea id="inp-desc" class="w-full border p-2 rounded text-sm h-20 resize-none" placeholder="What is this job for?">${tmpl ? (tmpl.description || '') : ''}</textarea>
                            </div>
                            <div>
                                <label class="block text-xs font-bold uppercase text-blue-500 mb-1">Description (ES)</label>
                                <textarea id="inp-desc-es" class="w-full border border-blue-100 p-2 rounded text-sm h-20 resize-none" placeholder="¿Para qué es este trabajo?">${tmpl ? (tmpl.description_es || '') : ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <div class="border-t border-gray-100 pt-4">
                        <div class="flex justify-between items-center mb-4">
                            <label class="block text-xs font-bold uppercase text-blue-600">Tasks</label>
                            <button id="btn-add-task" class="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 flex items-center">
                                <i data-lucide="plus" class="w-3 h-3 mr-1"></i> Add Task
                            </button>
                            <button id="btn-library" class="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded hover:bg-slate-200 flex items-center ml-2">
                                <i data-lucide="book" class="w-3 h-3 mr-1"></i> Library
                            </button>
                        </div>
                        <div id="task-list" class="space-y-3"></div>
                    </div>
                </div>

                <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between">
                    ${isEdit ? (isDeleted
                ? `<button id="btn-restore" class="text-green-600 hover:text-green-800 text-sm font-bold px-2 flex items-center"><i data-lucide="rotate-ccw" class="w-4 h-4 mr-2"></i> Restore Template</button>`
                : `<button id="btn-delete" class="text-red-500 hover:text-red-700 text-sm font-bold px-2">Archive Template</button>`)
                : '<div></div>'}
                    <div class="flex gap-2">
                        <button id="btn-cancel" class="px-4 py-2 text-sm hover:bg-gray-200 rounded text-gray-600">Cancel</button>
                        <button id="btn-save" class="bg-black text-white px-6 py-2 rounded text-sm font-bold hover:bg-gray-800">Save Template</button>
                    </div>
                </div>
            </div>
            </div >
        `;

        renderTasks();

        // Handlers
        document.getElementById('btn-close-modal').onclick = () => modal.innerHTML = '';
        document.getElementById('btn-cancel').onclick = () => modal.innerHTML = '';

        document.getElementById('btn-add-task').onclick = () => {
            tasks.push({ title: '', description: '', title_es: '', description_es: '', is_required: true, require_photo: false });
            renderTasks();
        };

        document.getElementById('btn-library').onclick = () => {
            openLibraryModal((taskData) => {
                tasks.push(taskData);
                renderTasks();
            });
        };

        if (isEdit) {
            if (isDeleted) {
                document.getElementById('btn-restore').onclick = async () => {
                    if (!confirm("Restore this template?")) return;
                    const { error } = await supabase.from('job_templates').update({ deleted_at: null }).eq('id', tmpl.id);
                    if (error) alert(error.message);
                    else { modal.innerHTML = ''; fetchTemplates(document.getElementById('chk-show-archived')?.checked); }
                };
            } else {
                document.getElementById('btn-delete').onclick = async () => {
                    if (!confirm("Archive this template?")) return;
                    const { error } = await supabase.from('job_templates').update({ deleted_at: new Date().toISOString() }).eq('id', tmpl.id);
                    if (error) alert(error.message);
                    else { modal.innerHTML = ''; fetchTemplates(document.getElementById('chk-show-archived')?.checked); }
                };
            }
        }

        document.getElementById('btn-save').onclick = async () => {
            const name = document.getElementById('inp-name').value.trim();
            const desc = document.getElementById('inp-desc').value.trim();
            const nameEs = document.getElementById('inp-name-es').value.trim();
            const descEs = document.getElementById('inp-desc-es').value.trim();

            if (!name) return alert("English Name is required");
            if (!nameEs) return alert("Spanish Name is required");
            if (tasks.some(t => !t.title.trim())) return alert("All tasks must have an English title");
            if (tasks.some(t => !t.title_es || !t.title_es.trim())) return alert("All tasks must have a Spanish title");

            let err;
            if (isEdit) {
                const updatePayload = {
                    p_id: tmpl.id,
                    p_name: name,
                    p_description: desc,
                    p_name_es: nameEs,
                    p_description_es: descEs,
                    p_tasks: tasks
                };
                const { error } = await supabase.rpc('update_job_template', updatePayload);
                err = error;
            } else {
                const createPayload = {
                    p_name: name,
                    p_description: desc,
                    p_name_es: nameEs,
                    p_description_es: descEs,
                    p_tasks: tasks
                };
                const { error } = await supabase.rpc('create_job_template', createPayload);
                err = error;
            }

            if (err) alert("Error: " + err.message);
            else {
                modal.innerHTML = '';
                fetchTemplates(document.getElementById('chk-show-archived')?.checked);
            }
        };

        lucide.createIcons();
    };

    fetchTemplates();
}

async function openLibraryModal(onSelect) {
    const container = document.createElement('div');
    container.id = 'library-modal';
    document.body.appendChild(container);

    const tenantId = getTenantId();
    let libraryTasks = [];

    const fetchLibrary = async () => {
        const { data, error } = await supabase.from('task_library').select('*').eq('tenant_id', tenantId).order('title');
        if (error) alert("Error fetching library: " + error.message);
        else {
            libraryTasks = data;
            renderLibrary();
        }
    };

    const renderLibrary = () => {
        const listHtml = libraryTasks.length > 0 ? libraryTasks.map(t => `
        < div class="flex justify-between items-start p-3 border-b border-gray-100 hover:bg-slate-50 group" >
                <div>
                    <div class="font-bold text-sm text-slate-800">${t.title}</div>
                    <div class="text-xs text-gray-500">${t.description || ''}</div>
                    ${t.title_es ? `<div class="text-xs text-blue-500 mt-1">${t.title_es}</div>` : ''}
                </div>
                <button class="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 px-3 py-1 rounded text-xs font-bold btn-use-task" data-id="${t.id}">
                    Use
                </button>
            </div >
        `).join('') : '<div class="text-center text-gray-400 py-8">Library is empty.</div>';

        container.innerHTML = `
        < div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" >
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 class="font-bold text-slate-800">Task Library</h3>
                    <button id="btn-close-lib" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
                <div class="p-4 overflow-y-auto flex-1">
                    <div class="mb-4">
                        <input id="inp-search-lib" class="w-full border p-2 rounded text-sm" placeholder="Search tasks...">
                    </div>
                    <div id="lib-list" class="border rounded border-gray-100">
                        ${listHtml}
                    </div>
                </div>
                <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
                    <span class="text-xs text-gray-400">Pro Tip: Standardize your tasks here.</span>
                    <button id="btn-create-lib-task" class="text-blue-600 text-xs font-bold hover:underline">+ Create New Library Task</button>
                </div>
            </div>
            </div >
        `;
        lucide.createIcons();

        document.getElementById('btn-close-lib').onclick = close;
        document.getElementById('btn-create-lib-task').onclick = () => openCreateLibTaskModal(fetchLibrary);

        container.querySelectorAll('.btn-use-task').forEach(btn => {
            btn.onclick = () => {
                const task = libraryTasks.find(t => t.id === btn.dataset.id);
                if (task) {
                    onSelect({
                        title: task.title,
                        description: task.description,
                        title_es: task.title_es,
                        description_es: task.description_es,
                        is_required: task.is_required,
                        require_photo: task.require_photo
                    });
                    close();
                }
            };
        });

        // Simple Search
        document.getElementById('inp-search-lib').onkeyup = (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = libraryTasks.filter(t =>
                t.title.toLowerCase().includes(term) ||
                (t.title_es && t.title_es.toLowerCase().includes(term))
            );
            // Re-render list only (simplified for now, full re-render is easier)
            // Ideally we separate renderList from renderContainer, but this is fast enough.
        };
    };

    const close = () => {
        container.remove();
    };

    fetchLibrary();
}

async function openCreateLibTaskModal(onSuccess) {
    // A small modal on top of library modal to create a new master task
    const container = document.createElement('div');
    document.body.appendChild(container);

    container.innerHTML = `
        < div class="fixed inset-0 z-[70] flex items-center justify-center p-4" >
            <div class="absolute inset-0 bg-black/20" id="overlay-create-lib"></div>
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative z-10">
                <h3 class="font-bold text-lg mb-4">New Library Task</h3>
                <div class="space-y-3">
                    <input id="lib-title" class="w-full border p-2 rounded text-sm" placeholder="Title (EN)">
                    <input id="lib-title-es" class="w-full border p-2 rounded text-sm" placeholder="Title (ES)">
                    <textarea id="lib-desc" class="w-full border p-2 rounded text-sm h-20 resize-none" placeholder="Description (EN)"></textarea>
                    <textarea id="lib-desc-es" class="w-full border p-2 rounded text-sm h-20 resize-none" placeholder="Description (ES)"></textarea>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="lib-req"> Required</label>
                        <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="lib-photo"> Photo Req.</label>
                    </div>
                </div>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="btn-cancel-lib-create" class="px-4 py-2 text-sm text-gray-600">Cancel</button>
                    <button id="btn-save-lib-create" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">Save to Library</button>
                </div>
            </div>
        </div>
    `;

    const close = () => container.remove();
    document.getElementById('overlay-create-lib').onclick = close;
    document.getElementById('btn-cancel-lib-create').onclick = close;

    document.getElementById('btn-save-lib-create').onclick = async () => {
        const title = document.getElementById('lib-title').value.trim();
        if (!title) return alert("Title required");

        const payload = {
            tenant_id: getTenantId(),
            title: title,
            title_es: document.getElementById('lib-title-es').value.trim(),
            description: document.getElementById('lib-desc').value.trim(),
            description_es: document.getElementById('lib-desc-es').value.trim(),
            is_required: document.getElementById('lib-req').checked,
            require_photo: document.getElementById('lib-photo').checked
        };

        const { error } = await supabase.from('task_library').insert(payload);
        if (error) alert(error.message);
        else {
            onSuccess();
            close();
        }
    };
}
