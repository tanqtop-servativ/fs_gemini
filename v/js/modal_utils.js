/**
 * Attaches "Click Outside" and "Dirty Check" logic to a modal.
 * 
 * @param {string} containerId - The ID of the modal wrapper (usually 'modal-container')
 * @param {Function} closeCallback - The function to run to actually close the modal (e.g., clearing innerHTML)
 */
export function setupModalGuard(containerId, closeCallback) {
    const container = document.getElementById(containerId);
    const backdrop = container.firstElementChild; // The fixed div with bg-black/50

    if (!backdrop) return;

    let isDirty = false;

    // 1. Watch for Changes
    // We listen to 'input' (typing) and 'change' (selects/checkboxes) on the whole modal
    const markDirty = () => { isDirty = true; };

    // Attach to all current inputs
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(el => {
        el.addEventListener('input', markDirty);
        el.addEventListener('change', markDirty);
    });

    // 2. Attempt Close Function
    const attemptClose = (ignoreDirty = false) => {
        if (isDirty && !ignoreDirty) {
            // Native browser confirm is simple and effective for this
            if (confirm("You have unsaved changes. Are you sure you want to discard them?")) {
                closeCallback();
            }
        } else {
            closeCallback();
        }
    };

    // 3. Listen for Click Outside
    backdrop.addEventListener('mousedown', (e) => {
        // e.target is what was clicked. e.currentTarget is the backdrop.
        // If they are the same, the user clicked the empty gray space.
        if (e.target === e.currentTarget) {
            attemptClose();
        }
    });

    // 4. Listen for Escape Key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            attemptClose();
            document.removeEventListener('keydown', escHandler); // Cleanup
        }
    };
    document.addEventListener('keydown', escHandler);

    // Return the attemptClose function so the "Cancel" button can use the same logic
    return attemptClose;
}
