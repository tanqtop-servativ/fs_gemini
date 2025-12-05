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

export const copyToClipboard = (text) => {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        console.log('Async: Copying to clipboard was successful!');
        showToast('Copied to clipboard!', 'success');
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
        showToast('Failed to copy', 'error');
    });
}

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
        if (successful) showToast('Copied to clipboard!', 'success');
        else showToast('Failed to copy', 'error');
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showToast('Failed to copy', 'error');
    }

    document.body.removeChild(textArea);
}

// Simple Toast implementation since we don't have a global one yet or I missed it. 
// If there is one, I should reuse it, but looking at the file list, I didn't see a toast component.
// I'll add a simple one here for feedback.
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-all transform translate-y-10 opacity-0 z-50 ${type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' : 'bg-gray-800'
        }`;
    toast.innerText = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animate out
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
