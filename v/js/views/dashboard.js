import { supabase } from '../supabase.js';
import { renderAddressWithLink } from '../utils.js';

export async function renderDashboard(container) {
    // 1. Render Skeleton IMMEDIATELY
    container.innerHTML = `
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-900">Live Status</h1><p class="text-gray-500">Real-time property overview</p></div>
      <div id="live-grid-content" class="min-h-[200px]">
        <div class="text-gray-400 flex items-center gap-2"><i data-lucide="loader-2" class="animate-spin"></i> Loading status...</div>
      </div>`;
    lucide.createIcons();

    // 2. Fetch Data
    const { data: props, error } = await supabase
        .from('properties_enriched')
        .select('*, bookings(start_date, end_date)')
        .eq('status', 'active')
        .order('name');

    const contentDiv = document.getElementById('live-grid-content');
    if (!contentDiv) return; // User navigated away

    if (error) {
        contentDiv.innerHTML = `<div class="text-red-500 p-4 border border-red-200 rounded bg-red-50">Error: ${error.message}</div>`;
        return;
    }

    if (!props || props.length === 0) {
        contentDiv.innerHTML = '<div class="text-center text-gray-400 py-10">No active properties found.</div>';
        return;
    }

    // 3. Build Grid
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
    const today = new Date();

    props.forEach(p => {
        let status = { label: 'Ready', color: 'green', icon: 'check-circle', desc: 'Unit is standing by' };
        let nextGuest = null;

        if (p.bookings && p.bookings.length > 0) {
            p.bookings.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
            for (const b of p.bookings) {
                const start = new Date(b.start_date);
                const end = new Date(b.end_date);
                if (today >= start && today <= end) {
                    status = { label: 'Occupied', color: 'blue', icon: 'user', desc: 'Guest currently in unit' };
                    break;
                }
                if (end.toDateString() === today.toDateString()) {
                    status = { label: 'Dirty', color: 'red', icon: 'trash-2', desc: 'Guest checkout today' };
                    break;
                }
                if (start > today) {
                    nextGuest = start;
                    break;
                }
            }
        }

        const badgeClass = `bg-${status.color}-100 text-${status.color}-800`;
        const actionButton = status.label === 'Dirty'
            ? `<button class="mt-4 w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-700 transition">Create Job</button>`
            : '';

        const thumb = p.front_photo_url
            ? `<img src="${p.front_photo_url}" class="w-full h-32 object-cover rounded-t-xl mb-4">`
            : `<div class="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400 rounded-t-xl mb-4"><i data-lucide="image" class="w-8 h-8"></i></div>`;

        html += `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            ${thumb}
            <div class="p-6 flex-1 flex flex-col">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg text-slate-900 truncate pr-2">${p.name}</h3>
                    <span class="${badgeClass} px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0">
                        <i data-lucide="${status.icon}" class="w-3 h-3"></i> ${status.label}
                    </span>
                </div>
                <div class="text-gray-500 text-sm mb-4">${renderAddressWithLink(p.display_address, "w-4 h-4")}</div>
                
                <div class="text-sm mt-auto text-gray-600">${status.desc}</div>
                ${actionButton}
                
                <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                    <span class="text-gray-500">Next Guest</span>
                    <span class="font-medium text-slate-900">${nextGuest ? nextGuest.toLocaleDateString() : 'None'}</span>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';

    contentDiv.innerHTML = html;
    lucide.createIcons();
}
