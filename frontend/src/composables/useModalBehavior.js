/**
 * useModalBehavior composable
 * Provides common modal behaviors:
 * - ESC key to close
 * - Unsaved changes warning
 */
import { onMounted, onUnmounted, ref } from 'vue'

export function useModalBehavior({
    isOpen,
    onClose,
    getSnapshot = null,
    initialSnapshot = null
}) {
    // Handle ESC key
    const handleKeydown = (e) => {
        if (e.key === 'Escape' && isOpen.value) {
            attemptClose()
        }
    }

    // Attempt to close with unsaved changes check
    const attemptClose = () => {
        if (getSnapshot && initialSnapshot) {
            const current = getSnapshot()
            const initial = initialSnapshot.value
            if (initial && current !== initial) {
                if (!confirm("You have unsaved changes. Are you sure you want to close?")) {
                    return false
                }
            }
        }
        onClose()
        return true
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown)
    })

    return {
        attemptClose
    }
}
