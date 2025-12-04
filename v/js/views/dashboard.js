import { supabase } from '../supabase.js';

export async function renderDashboard(container) {
    container.innerHTML = `
      <div class="mb-6 flex justify-between items-center">
        <div>
            <h1 class="text-2xl font-bold text-slate-900">Horizon Board</h1>
            <p class="text-gray-500">Overview of upcoming work.</p>
        </div>
      </div>
      
      <div class="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-150px)]">
        ${renderColumn('overdue', 'Overdue', 'bg-red-50 border-red-100 text-red-700')}
        ${renderColumn('today', 'Today', 'bg-blue-50 border-blue-100 text-blue-700')}
        ${renderColumn('tomorrow', 'Tomorrow', 'bg-green-50 border-green-100 text-green-700')}
        ${renderColumn('this_week', 'This Week', 'bg-gray-50 border-gray-100 text-gray-700')}
        ${renderColumn('next_week', 'Next Week', 'bg-gray-50 border-gray-100 text-gray-700')}
        ${renderColumn('future', 'Future', 'bg-gray-50 border-gray-100 text-gray-700')}
      </div>`;

    await loadDashboard();
}

function renderColumn(id, title, headerClass) {
    return `
    <div class="flex-shrink-0 w-80 bg-slate-50 rounded-xl border border-gray-200 flex flex-col max-h-full">
        <div class="p-3 border-b border-gray-200 ${headerClass} rounded-t-xl font-bold text-sm uppercase flex justify-between">
            ${title}
            <span id="count-${id}" class="bg-white/50 px-2 rounded text-xs flex items-center">0</span>
        </div>
        <div id="col-${id}" class="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
            <!-- Cards go here -->
            <div class="text-center text-gray-400 text-xs py-4">Loading...</div>
        </div>
    </div>`;
}

async function loadDashboard() {
    const { data: jobs, error } = await supabase.rpc('get_dashboard_horizon', {
        p_tenant_id: 1 // TODO: Get from user context
    });

    if (error) return alert("Error loading dashboard: " + error.message);

    // Clear columns
    ['overdue', 'today', 'tomorrow', 'this_week', 'next_week', 'future'].forEach(id => {
        document.getElementById(`col-${id}`).innerHTML = '';
        document.getElementById(`count-${id}`).innerText = '0';
    });

    if (!jobs || jobs.length === 0) return;

    // Bucketize
    const buckets = {
        overdue: [], today: [], tomorrow: [], this_week: [], next_week: [], future: []
    };

    jobs.forEach(job => {
        if (buckets[job.bucket]) buckets[job.bucket].push(job);
    });

    // Render
    Object.keys(buckets).forEach(key => {
        const container = document.getElementById(`col-${key}`);
        document.getElementById(`count-${key}`).innerText = buckets[key].length;

        if (buckets[key].length === 0) {
            container.innerHTML = `<div class="text-center text-gray-300 text-xs py-8">No jobs</div>`;
            return;
        }

        container.innerHTML = buckets[key].map(job => renderCard(job)).join('');
    });

    lucide.createIcons();
}

function renderCard(job) {
    let typeColor = 'bg-gray-100 text-gray-600';
    if (job.type === 'Cleaning') typeColor = 'bg-blue-100 text-blue-700';
    if (job.type === 'Inspection') typeColor = 'bg-purple-100 text-purple-700';
    if (job.type === 'Kitting') typeColor = 'bg-yellow-100 text-yellow-700';

    const dateDisplay = job.scheduled_at
        ? `<span class="text-xs text-gray-500 flex items-center"><i data-lucide="clock" class="w-3 h-3 mr-1"></i> ${new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`
        : `<span class="text-xs text-orange-400 flex items-center" title="Using Due Date"><i data-lucide="calendar" class="w-3 h-3 mr-1"></i> Due</span>`;

    return `
    <div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer group">
        <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-bold uppercase tracking-wider ${typeColor} px-1.5 py-0.5 rounded">${job.type}</span>
            ${dateDisplay}
        </div>
        <h4 class="font-bold text-slate-800 text-sm mb-1 leading-tight">${job.property_name}</h4>
        <p class="text-xs text-gray-500 mb-3">${job.service_name || 'Ad-hoc Job'}</p>
        
        <div class="flex justify-between items-center pt-2 border-t border-gray-50">
            <div class="flex -space-x-2">
                <!-- Avatar placeholder -->
                <div class="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-500">?</div>
            </div>
            <span class="text-xs font-medium text-slate-400 group-hover:text-blue-600 transition">${job.status}</span>
        </div>
    </div>`;
}
