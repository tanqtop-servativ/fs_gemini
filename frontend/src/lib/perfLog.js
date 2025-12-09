/**
 * Debug Logger for Performance Monitoring
 * Enable in browser console: localStorage.setItem('DEBUG_PERF', 'true')
 * Disable: localStorage.removeItem('DEBUG_PERF')
 */

const isEnabled = () => localStorage.getItem('DEBUG_PERF') === 'true'

const styles = {
    mount: 'color: #10b981; font-weight: bold',
    unmount: 'color: #ef4444; font-weight: bold',
    listener: 'color: #3b82f6',
    interval: 'color: #f59e0b',
    fetch: 'color: #8b5cf6',
    warn: 'color: #f97316; font-weight: bold',
    memory: 'color: #ec4899; font-weight: bold'
}

let componentCounts = {}
let listenerCounts = { add: 0, remove: 0 }
let intervalCounts = { active: new Set() }

export const perfLog = {
    mount(componentName) {
        if (!isEnabled()) return
        componentCounts[componentName] = (componentCounts[componentName] || 0) + 1
        console.log(`%c[MOUNT] ${componentName} (total: ${componentCounts[componentName]})`, styles.mount)
    },

    unmount(componentName) {
        if (!isEnabled()) return
        componentCounts[componentName] = Math.max(0, (componentCounts[componentName] || 1) - 1)
        console.log(`%c[UNMOUNT] ${componentName} (remaining: ${componentCounts[componentName]})`, styles.unmount)
    },

    addListener(context, eventType) {
        if (!isEnabled()) return
        listenerCounts.add++
        console.log(`%c[+LISTENER] ${context} → ${eventType} (total adds: ${listenerCounts.add}, removes: ${listenerCounts.remove})`, styles.listener)
        if (listenerCounts.add - listenerCounts.remove > 20) {
            console.warn(`%c⚠️ LISTENER LEAK: ${listenerCounts.add - listenerCounts.remove} unremoved listeners!`, styles.warn)
        }
    },

    removeListener(context, eventType) {
        if (!isEnabled()) return
        listenerCounts.remove++
        console.log(`%c[-LISTENER] ${context} → ${eventType} (total adds: ${listenerCounts.add}, removes: ${listenerCounts.remove})`, styles.listener)
    },

    startInterval(id, context, intervalMs) {
        if (!isEnabled()) return
        intervalCounts.active.add(id)
        console.log(`%c[+INTERVAL] ${context} (${intervalMs}ms) ID:${id} (active: ${intervalCounts.active.size})`, styles.interval)
    },

    stopInterval(id, context) {
        if (!isEnabled()) return
        intervalCounts.active.delete(id)
        console.log(`%c[-INTERVAL] ${context} ID:${id} (active: ${intervalCounts.active.size})`, styles.interval)
    },

    fetch(context, details = '') {
        if (!isEnabled()) return
        console.log(`%c[FETCH] ${context} ${details}`, styles.fetch)
    },

    warn(message) {
        if (!isEnabled()) return
        console.warn(`%c⚠️ ${message}`, styles.warn)
    },

    memory() {
        if (!isEnabled()) return
        if (performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1048576)
            const total = Math.round(performance.memory.totalJSHeapSize / 1048576)
            console.log(`%c[MEMORY] ${used}MB / ${total}MB`, styles.memory)
        }
    },

    summary() {
        console.group('📊 Performance Debug Summary')
        console.table(componentCounts)
        console.log('Listeners: added=' + listenerCounts.add + ', removed=' + listenerCounts.remove + ', leak=' + (listenerCounts.add - listenerCounts.remove))
        console.log('Active Intervals:', intervalCounts.active.size)
        this.memory()
        console.groupEnd()
    },

    reset() {
        componentCounts = {}
        listenerCounts = { add: 0, remove: 0 }
        intervalCounts.active.clear()
        console.log('Debug counters reset')
    }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
    window.perfLog = perfLog
}

export default perfLog
