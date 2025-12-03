import { supabase } from '../supabase.js';
import { getTenantId } from '../utils.js';

export async function renderJobTemplates(container) {
    const tenantId = getTenantId();
    let templates = [];

    // --- FETCH ---
    const fetchTemplates = async () => {
        const { data, error } = await supabase
            .from('job_templates')
            .select('*, job_template_tasks(*)')
            .eq('tenant_id', tenantId)
            .order('name');

        if (error) return alert("Error fetching templates: " + error.message);
        templates = data;
        renderList();
    };

    // --- RENDER LIST ---
    const renderList = () => {
        container.innerHTML = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold text-slate-800">Job Templates</h1>
                    <button id="btn-new-tmpl" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 flex items-center shadow-lg hover:shadow-xl transition-all">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Template
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="tmpl-grid"></div>
            </div>
            <div id="modal-container"></div>
        `;

        const grid = document.getElementById('tmpl-grid');
        if (templates.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">No templates found. Create one to get started.</div>`;
        } else {
            templates.forEach(t => {
                const card = document.createElement('div');
                card.className = "bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow cursor-pointer group relative";
                card.onclick = () => openModal(t);

                const taskCount = t.job_template_tasks ? t.job_template_tasks.length : 0;

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-lg text-slate-800">${t.name}</h3>
                        <span class="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-bold">${taskCount} Tasks</span>
                    </div>
                    <p class="text-sm text-gray-500 line-clamp-2 mb-4 h-10">${t.description || 'No description'}</p>
                    <div class="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase">Edit Template</button>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        document.getElementById('btn-new-tmpl').onclick = () => openModal(null);
        lucide.createIcons();
    };

    // --- MODAL ---
    const openModal = (tmpl) => {
        const isEdit = !!tmpl;
        let tasks = tmpl ? (tmpl.job_template_tasks || []).sort((a, b) => a.sort_order - b.sort_order) : [];

        const modal = document.getElementById('modal-container');

        const renderTasks = () => {
            const list = document.getElementById('task-list');
            if (!list) return;
            if (tasks.length === 0) {
                list.innerHTML = `<div class="text-center text-gray-400 text-xs italic py-4">No tasks added yet.</div>`;
                return;
            }
            list.innerHTML = tasks.map((t, idx) => `
                <div class="flex gap-3 items-start bg-slate-50 p-3 rounded border border-slate-200 group">
                    <div class="mt-1 text-slate-400 font-mono text-xs">${idx + 1}</div>
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
                        <div class="flex gap-4 pt-1">
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
                </div>
            `).join('');

            // Bind Events
            list.querySelectorAll('.task-title').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].title = e.target.value);
            list.querySelectorAll('.task-desc').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].description = e.target.value);
            list.querySelectorAll('.task-title-es').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].title_es = e.target.value);
            list.querySelectorAll('.task-desc-es').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].description_es = e.target.value);
            list.querySelectorAll('.task-req').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].is_required = e.target.checked);
            list.querySelectorAll('.task-photo').forEach(el => el.onchange = (e) => tasks[el.dataset.idx].require_photo = e.target.checked);
            list.querySelectorAll('.btn-del-task').forEach(el => el.onclick = () => { tasks.splice(el.dataset.idx, 1); renderTasks(); });
            lucide.createIcons();
        };

        modal.innerHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <h2 class="text-xl font-bold text-slate-800">${isEdit ? 'Edit Template' : 'New Template'}</h2>
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
                            </div>
                            <div id="task-list" class="space-y-3"></div>
                        </div>
                    </div>

                    <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between">
                        ${isEdit ? `<button id="btn-delete" class="text-red-500 hover:text-red-700 text-sm font-bold px-2">Delete Template</button>` : '<div></div>'}
                        <div class="flex gap-2">
                            <button id="btn-cancel" class="px-4 py-2 text-sm hover:bg-gray-200 rounded text-gray-600">Cancel</button>
                            <button id="btn-save" class="bg-black text-white px-6 py-2 rounded text-sm font-bold hover:bg-gray-800">Save Template</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderTasks();

        // Handlers
        document.getElementById('btn-close-modal').onclick = () => modal.innerHTML = '';
        document.getElementById('btn-cancel').onclick = () => modal.innerHTML = '';

        document.getElementById('btn-add-task').onclick = () => {
            tasks.push({ title: '', description: '', title_es: '', description_es: '', is_required: true, require_photo: false });
            renderTasks();
        };

        if (isEdit) {
            document.getElementById('btn-delete').onclick = async () => {
                if (!confirm("Are you sure? This cannot be undone.")) return;
                const { error } = await supabase.from('job_templates').delete().eq('id', tmpl.id);
                if (error) alert(error.message);
                else { modal.innerHTML = ''; fetchTemplates(); }
            };
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

            const payload = {
                p_name: name,
                p_description: desc,
                p_name_es: nameEs,
                p_description_es: descEs,
                p_tasks: tasks,
                p_tenant_id: tenantId
            };

            let err;
            if (isEdit) {
                const { error } = await supabase.rpc('update_job_template', { ...payload, p_id: tmpl.id });
                err = error;
            } else {
                const { error } = await supabase.rpc('create_job_template', payload);
                err = error;
            }

            if (err) alert("Error: " + err.message);
            else {
                modal.innerHTML = '';
                fetchTemplates();
            }
        };

        lucide.createIcons();
    };

    fetchTemplates();
}
