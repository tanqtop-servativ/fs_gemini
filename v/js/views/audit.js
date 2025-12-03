import { supabase } from '../supabase.js';

export async function renderAuditHistory(containerId, tableName, recordId) {
    const rId = parseInt(recordId);
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="text-gray-400 text-xs py-2">Loading history...</div>';

    console.log(`Fetching audit for ${tableName} #${rId}`);

    // We need to fetch logs for the property AND its related items (like access codes)
    // For now, we will just fetch the property logs. 
    // TODO: To support related logs (like access codes), we would need a more complex query or RPC.
    // However, since the user specifically asked for "Casita Code" which is likely linked by property_id,
    // we can try to fetch logs where (table='properties' AND record_id=id) OR (table='property_access_codes' AND new_values->>'property_id' = id)
    // But Supabase simple query doesn't support OR across JSON fields easily.

    // Let's stick to the requested scope: "Casita Code" change.
    // If Casita Code is in property_access_codes, we need to fetch logs for that table too.

    let logs, error;

    if (tableName === 'properties') {
        // Use the new RPC to fetch property + related history
        const res = await supabase.rpc('get_property_audit_history', { p_property_id: rId });
        logs = res.data;
        error = res.error;
    } else {
        // Standard single-table fetch
        const res = await supabase
            .from('audit_history_view')
            .select('*')
            .eq('table_name', tableName)
            .eq('record_id', rId)
            .order('changed_at', { ascending: false });
        logs = res.data;
        error = res.error;
    }
    console.log("Audit Logs:", logs, error);

    if (error) {
        container.innerHTML = `<div class="text-red-500 text-xs">Error: ${error.message}</div>`;
        return;
    }

    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-xs py-2">No history found.</div>';
        return;
    }

    const html = logs.map(log => {
        const date = new Date(log.changed_at).toLocaleString();

        let badgeColor = 'bg-gray-100 text-gray-600';
        if (log.operation === 'INSERT') badgeColor = 'bg-green-100 text-green-700';
        if (log.operation === 'UPDATE') badgeColor = 'bg-blue-100 text-blue-700';
        if (log.operation === 'DELETE') badgeColor = 'bg-red-100 text-red-700';

        // User Display
        let userText = 'System/Anon';
        if (log.changed_by_email) {
            userText = log.changed_by_email;
        } else if (log.changed_by) {
            userText = `User: ...${log.changed_by.slice(-4)}`;
        }
        const userDisplay = `<span class="text-[10px] text-gray-400 font-mono" title="${userText}">${userText}</span>`;

        // Diff Logic
        let diffHtml = '';

        // 1. UPDATE: Show Diff
        if (log.operation === 'UPDATE' && log.old_values && log.new_values) {
            const changes = [];
            for (const key in log.new_values) {
                if (JSON.stringify(log.new_values[key]) !== JSON.stringify(log.old_values[key])) {
                    changes.push({ key, old: log.old_values[key], new: log.new_values[key] });
                }
            }
            if (changes.length > 0) {
                diffHtml = `<div class="mt-2 bg-slate-50 rounded p-2 text-xs font-mono space-y-1 border border-slate-100">
                    ${changes.map(c => `
                        <div class="flex gap-2">
                            <span class="font-bold text-slate-600">${c.key}:</span>
                            <span class="text-red-500 line-through opacity-75">${JSON.stringify(c.old)}</span>
                            <span class="text-gray-400">→</span>
                            <span class="text-green-600 font-bold">${JSON.stringify(c.new)}</span>
                        </div>
                    `).join('')}
                </div>`;
            }
        }

        // 2. INSERT: Show New Values
        if (log.operation === 'INSERT' && log.new_values) {
            diffHtml = `<div class="mt-2 bg-green-50 rounded p-2 text-xs font-mono space-y-1 border border-green-100">
                <div class="text-green-800 font-bold mb-1">New Record Data:</div>
                ${Object.entries(log.new_values).map(([k, v]) => `
                    <div class="flex gap-2">
                        <span class="font-bold text-slate-600">${k}:</span>
                        <span class="text-green-700">${JSON.stringify(v)}</span>
                    </div>
                `).join('')}
            </div>`;
        }

        // 3. DELETE: Show Old Values
        if (log.operation === 'DELETE' && log.old_values) {
            diffHtml = `<div class="mt-2 bg-red-50 rounded p-2 text-xs font-mono space-y-1 border border-red-100">
                <div class="text-red-800 font-bold mb-1">Deleted Record Data:</div>
                ${Object.entries(log.old_values).map(([k, v]) => `
                    <div class="flex gap-2">
                        <span class="font-bold text-slate-600">${k}:</span>
                        <span class="text-red-700">${JSON.stringify(v)}</span>
                    </div>
                `).join('')}
            </div>`;
        }

        return `
        <div class="flex gap-3 mb-3 pb-3 border-b border-gray-50 last:border-0 last:mb-0 last:pb-0">
            <div class="flex-shrink-0 mt-0.5">
                <div class="w-2 h-2 rounded-full bg-gray-300 mt-1.5"></div>
            </div>
            <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-500">${date}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${badgeColor}">${log.operation}</span>
                    </div>
                    ${userDisplay}
                </div>
                <div class="text-sm text-slate-700">${log.description}</div>
                ${diffHtml}
            </div>
        </div>`;
    }).join('');

    // Collapsible Container
    container.innerHTML = `
        <details class="group">
            <summary class="list-none cursor-pointer flex items-center gap-2 text-xs font-bold uppercase text-gray-500 hover:text-gray-700 mb-2 select-none">
                <i data-lucide="chevron-right" class="w-4 h-4 transition-transform group-open:rotate-90"></i>
                <span>Audit History (${logs.length})</span>
            </summary>
            <div class="mt-2 pl-1 border-l-2 border-gray-100 ml-2">
                ${html}
            </div>
        </details>
    `;
    if (window.lucide) window.lucide.createIcons();
}
