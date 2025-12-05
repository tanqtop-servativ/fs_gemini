import { supabase } from '../supabase.js';
import { setupModalGuard } from '../modal_utils.js';
import { copyToClipboard } from '../utils.js';

export async function renderActivityFeed(container) {
    // 1. Render Skeleton
    container.innerHTML = `
      <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 class="text-2xl font-bold text-slate-900">Activity Feed</h1>
            <p class="text-gray-500">Real-time log of system events and communications.</p>
        </div>
        
        <div class="flex flex-wrap gap-2 items-center bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <!-- Filter: Time -->
            <select id="filter-time" class="text-sm border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer">
                <option value="live">⚡ Live Stream</option>
                <option value="hour">Last Hour</option>
                <option value="today">Today</option>
                <option value="all">All Time</option>
            </select>
            <div class="w-px h-4 bg-gray-300 mx-1"></div>
            
            <!-- Filter: Severity -->
            <select id="filter-severity" class="text-sm border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer">
                <option value="all">All Events</option>
                <option value="important">Important Only</option>
                <option value="error">Errors Only</option>
            </select>
            <div class="w-px h-4 bg-gray-300 mx-1"></div>

            <!-- Search -->
            <div class="relative">
                <i data-lucide="search" class="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input type="text" id="filter-search" placeholder="Search..." class="pl-8 pr-2 py-1 text-sm border-none bg-gray-50 rounded-md focus:ring-2 focus:ring-indigo-500 w-32 focus:w-48 transition-all">
            </div>
        </div>
      </div>

      <!-- New Items Badge (Hidden) -->
      <div id="new-items-badge" class="hidden mb-4 text-center">
        <button class="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105 flex items-center gap-2 mx-auto">
            <i data-lucide="arrow-up" class="w-4 h-4"></i>
            <span>New events available</span>
        </button>
      </div>

      <!-- Feed Container -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        <div id="feed-list" class="divide-y divide-gray-100">
            <div class="p-10 text-center text-gray-400 flex flex-col items-center">
                <i data-lucide="loader-2" class="w-8 h-8 animate-spin mb-2"></i>
                Loading feed...
            </div>
        </div>
      </div>
      
      <!-- Load More -->
      <div class="mt-4 text-center">
        <button id="btn-load-more" class="hidden text-sm text-gray-500 hover:text-gray-800 font-medium px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">Load More</button>
      </div>
    `;

    lucide.createIcons();

    // 2. State
    let state = {
        time: 'live',
        severity: 'all',
        search: '',
        page: 0,
        pageSize: 50,
        isPaused: false,
        pendingEvents: []
    };

    // 3. Initial Load
    await loadFeed(state);

    // 4. Bind Events
    document.getElementById('filter-time').onchange = (e) => { state.time = e.target.value; state.page = 0; loadFeed(state); };
    document.getElementById('filter-severity').onchange = (e) => { state.severity = e.target.value; state.page = 0; loadFeed(state); };

    let debounce;
    document.getElementById('filter-search').oninput = (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            state.search = e.target.value;
            state.page = 0;
            loadFeed(state);
        }, 300);
    };

    document.getElementById('btn-load-more').onclick = () => {
        state.page++;
        loadFeed(state, true);
    };

    const badge = document.getElementById('new-items-badge');
    badge.querySelector('button').onclick = () => {
        renderNewItems(state.pendingEvents);
        state.pendingEvents = [];
        badge.classList.add('hidden');
    };

    // 5. Realtime Subscription
    const channel = supabase
        .channel('activity-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communications' }, handleRealtime)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, handleRealtime)
        .subscribe();

    // Cleanup function for main.js
    return () => {
        console.log("Unsubscribing from activity feed...");
        supabase.removeChannel(channel);
    };

    function handleRealtime(payload) {
        // Only care if we are in "Live" mode
        if (state.time !== 'live') return;

        console.log("Realtime Event:", payload);

        // We need to fetch the full view row because the payload is just the raw table row
        // For simplicity in this demo, we'll just trigger a reload or add to pending.
        // In a real app, we'd optimistically construct the view model.

        // Let's just show the badge
        state.pendingEvents.push(payload);
        badge.classList.remove('hidden');

        // If user hasn't scrolled/paused, maybe auto-insert? 
        // For now, let's stick to the "Twitter style" badge as requested.
    }
}

async function loadFeed(state, append = false) {
    const list = document.getElementById('feed-list');
    const loadBtn = document.getElementById('btn-load-more');

    if (!append) list.innerHTML = '<div class="p-10 text-center text-gray-400"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i>Loading...</div>';

    let query = supabase
        .from('tenant_activity_feed')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(state.page * state.pageSize, (state.page + 1) * state.pageSize - 1);

    // Apply Filters
    if (state.severity === 'important') query = query.in('severity', ['WARNING', 'ERROR']);
    if (state.severity === 'error') query = query.eq('severity', 'ERROR');

    if (state.time === 'hour') {
        const d = new Date(); d.setHours(d.getHours() - 1);
        query = query.gte('timestamp', d.toISOString());
    }
    if (state.time === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        query = query.gte('timestamp', d.toISOString());
    }

    if (state.search) {
        query = query.ilike('summary', `%${state.search}%`);
    }

    // Tenant Filter (Handled by RLS, but good to be explicit if we had a selector)
    if (window.currentUser && window.currentUser.tenant_id) {
        query = query.eq('tenant_id', window.currentUser.tenant_id);
    }

    const { data, error } = await query;

    if (error) {
        list.innerHTML = `<div class="p-6 text-center text-red-500">Error: ${error.message}</div>`;
        return;
    }

    if (!append) list.innerHTML = '';

    if (data.length === 0 && !append) {
        list.innerHTML = `<div class="p-10 text-center text-gray-400">No activity found.</div>`;
        loadBtn.classList.add('hidden');
        return;
    }

    if (data.length < state.pageSize) loadBtn.classList.add('hidden');
    else loadBtn.classList.remove('hidden');

    renderItems(data, list);
    lucide.createIcons();
}

function renderItems(items, container) {
    const html = items.map(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString();

        // Styling
        let rowClass = 'bg-white border-l-4 border-gray-200';
        let icon = 'activity';
        let iconColor = 'text-gray-400';

        if (item.category === 'COMMUNICATION') {
            icon = 'mail';
            rowClass = 'bg-blue-50/30 border-l-4 border-blue-400';
            iconColor = 'text-blue-500';
        }
        if (item.category === 'DATA_CHANGE') {
            icon = 'database';
            rowClass = 'bg-white border-l-4 border-gray-200';
        }

        // Severity Overrides
        if (item.severity === 'WARNING') {
            rowClass = 'bg-amber-50/50 border-l-4 border-amber-400';
            icon = 'alert-triangle';
            iconColor = 'text-amber-500';
        }
        if (item.severity === 'ERROR') {
            rowClass = 'bg-red-50/50 border-l-4 border-red-400';
            icon = 'alert-octagon';
            iconColor = 'text-red-500';
        }

        return `
        <div onclick="window.viewActivityDetail('${item.event_id}')" class="group flex items-start gap-4 p-4 ${rowClass} hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer relative">
            <div class="flex-shrink-0 mt-1 ${iconColor}">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <p class="text-sm font-medium text-slate-900 truncate pr-2">${item.summary}</p>
                    <span class="text-xs text-gray-400 whitespace-nowrap flex-shrink-0" title="${dateStr}">${timeStr}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">${item.category}</span>
                    <span class="text-xs text-gray-400">by ${item.actor_email || 'System'}</span>
                </div>
            </div>

            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="event.stopPropagation(); window.copyActivityItem('${item.event_id}')" class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full" title="Copy Details">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                </button>
                <button onclick="event.stopPropagation(); window.viewActivityDetail('${item.event_id}')" class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full" title="View Details">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML += html;

    // Attach global handler for modal
    window.viewActivityDetail = (id) => {
        const item = items.find(i => i.event_id === id);
        if (item) openDetailModal(item);
    };

    window.copyActivityItem = (id) => {
        const item = items.find(i => i.event_id === id);
        if (item) {
            let text = `Summary: ${item.summary}\nTime: ${new Date(item.timestamp).toLocaleString()}\nCategory: ${item.category}\nActor: ${item.actor_email || 'System'}\n`;
            if (item.details) {
                text += `Details:\n${JSON.stringify(item.details, null, 2)}`;
            }
            copyToClipboard(text);
        }
    };
}

function renderNewItems(rawEvents) {
    // In a real app, we'd fetch the full view data for these IDs.
    // For now, let's just reload the feed to keep it simple and consistent.
    // Or we could prepend a "New Data" marker.
    const list = document.getElementById('feed-list');
    list.innerHTML = ''; // Clear
    loadFeed({ ...state, page: 0 }); // Reload fresh
}

function openDetailModal(item) {
    const container = document.getElementById('modal-container');

    let contentHtml = '';

    if (item.category === 'COMMUNICATION') {
        contentHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="font-bold text-gray-500">Type:</span> ${item.details.type}</div>
                    <div><span class="font-bold text-gray-500">Direction:</span> ${item.details.direction}</div>
                    <div class="col-span-2"><span class="font-bold text-gray-500">Recipient:</span> ${item.details.recipient}</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                    ${item.details.content || '(No Content)'}
                </div>
            </div>`;
    } else if (item.category === 'DATA_CHANGE') {
        contentHtml = `
            <div class="space-y-4">
                 <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="font-bold text-gray-500">Table:</span> ${item.details.table}</div>
                    <div><span class="font-bold text-gray-500">Operation:</span> ${item.details.operation}</div>
                    ${item.details.record_summary ? `<div class="col-span-2"><span class="font-bold text-gray-500">Record:</span> <span class="font-bold text-slate-900">${item.details.record_summary}</span></div>` : ''}
                </div>
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 class="text-xs font-bold text-slate-500 uppercase mb-2">Changes</h4>
                    <div class="space-y-1 text-xs font-mono">
                        ${renderDiff(item.details.old, item.details.new)}
                    </div>
                </div>
            </div>`;
    }

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h3 class="font-bold text-lg text-slate-800">Event Details</h3>
                    <div class="text-xs text-slate-500">${new Date(item.timestamp).toLocaleString()}</div>
                </div>
                <div class="flex items-center gap-2">
                     <button onclick="window.copyActivityItem('${item.event_id}')" class="text-gray-400 hover:text-indigo-600 transition-colors p-1" title="Copy Details">
                        <i data-lucide="copy" class="w-5 h-5"></i>
                    </button>
                    <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600 transition-colors p-1">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
            <div class="p-6">
                ${contentHtml}
            </div>
        </div>
    </div>`;

    const safeClose = setupModalGuard('modal-container', () => container.innerHTML = '');
    document.getElementById('btn-close-modal').onclick = safeClose;
    lucide.createIcons();
}

function renderDiff(oldVal, newVal) {
    if (!oldVal && !newVal) return '<div class="text-gray-400 italic">No data</div>';

    // Simple diff logic
    const keys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]);
    let html = '';

    keys.forEach(k => {
        const o = oldVal ? oldVal[k] : undefined;
        const n = newVal ? newVal[k] : undefined;

        if (JSON.stringify(o) !== JSON.stringify(n)) {
            html += `
            <div class="flex gap-2">
                <span class="font-bold text-slate-600">${k}:</span>
                <span class="text-red-500 line-through opacity-75">${JSON.stringify(o)}</span>
                <span class="text-gray-400">→</span>
                <span class="text-green-600 font-bold">${JSON.stringify(n)}</span>
            </div>`;
        }
    });

    return html || '<div class="text-gray-400 italic">No changes detected</div>';
}
