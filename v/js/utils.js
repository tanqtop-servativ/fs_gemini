export function getTenantId() {
    if (window.currentUser && window.currentUser.tenant_id) return window.currentUser.tenant_id;
    try { return JSON.parse(localStorage.getItem('mock_user')).tenant_id || 1; } catch (e) { return 1; }
}

export const renderAddressWithLink = (addr, iconClass = "w-3 h-3") => {
    if (!addr) return '-';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
    return `
        <div class="flex items-center gap-2">
            <span class="truncate">${addr}</span>
            <a href="${url}" target="_blank" class="text-blue-400 hover:text-blue-600 flex-shrink-0" title="View on Maps" onclick="event.stopPropagation()">
                <i data-lucide="map-pin" class="${iconClass}"></i>
            </a>
        </div>
    `;
};
