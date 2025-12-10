/**
 * Debug Lifecycle Composable
 * Tracks component mount/unmount cycles to diagnose memory leaks
 * 
 * Usage: Call useDebugLifecycle('ComponentName') at the top of setup()
 */
import { onMounted, onUnmounted, onActivated, onDeactivated, ref } from 'vue'

// Global tracking
const mountedComponents = ref(new Map()) // componentName -> count
const eventListenerCount = ref(0)
const totalMounts = ref(0)
const totalUnmounts = ref(0)

// Track original addEventListener to count listeners
let isPatched = false

const patchEventListeners = () => {
    if (isPatched || typeof window === 'undefined') return
    isPatched = true

    const originalAdd = document.addEventListener.bind(document)
    const originalRemove = document.removeEventListener.bind(document)

    document.addEventListener = (...args) => {
        eventListenerCount.value++
        return originalAdd(...args)
    }

    document.removeEventListener = (...args) => {
        eventListenerCount.value--
        return originalRemove(...args)
    }

    console.log('[DEBUG] Event listener tracking enabled')
}

export function useDebugLifecycle(componentName) {
    patchEventListeners()

    onMounted(() => {
        totalMounts.value++
        const current = mountedComponents.value.get(componentName) || 0
        mountedComponents.value.set(componentName, current + 1)

        console.log(`[MOUNT] ${componentName} (instance #${current + 1}) | Total mounted: ${totalMounts.value} | Listeners: ${eventListenerCount.value}`)

        // Warn if same component mounted many times without unmounting
        if (current + 1 > 3) {
            console.warn(`[WARN] ${componentName} has ${current + 1} active instances - possible memory leak!`)
        }
    })

    onUnmounted(() => {
        totalUnmounts.value++
        const current = mountedComponents.value.get(componentName) || 1
        mountedComponents.value.set(componentName, current - 1)

        console.log(`[UNMOUNT] ${componentName} | Remaining: ${current - 1} | Total mounts: ${totalMounts.value}, unmounts: ${totalUnmounts.value} | Listeners: ${eventListenerCount.value}`)

        // Warn if mounts far exceed unmounts (memory leak symptom)
        if (totalMounts.value - totalUnmounts.value > 50) {
            console.warn(`[WARN] Mount/unmount imbalance: ${totalMounts.value} mounts vs ${totalUnmounts.value} unmounts`)
        }
    })

    // Also track keep-alive activations
    onActivated?.(() => {
        console.log(`[ACTIVATED] ${componentName}`)
    })

    onDeactivated?.(() => {
        console.log(`[DEACTIVATED] ${componentName}`)
    })
}

// Export stats for console inspection
export function getDebugStats() {
    return {
        mountedComponents: Object.fromEntries(mountedComponents.value),
        totalMounts: totalMounts.value,
        totalUnmounts: totalUnmounts.value,
        eventListenerCount: eventListenerCount.value,
        netMounted: totalMounts.value - totalUnmounts.value
    }
}

// Make available globally for console debugging
if (typeof window !== 'undefined') {
    window.__debugStats = getDebugStats
}
