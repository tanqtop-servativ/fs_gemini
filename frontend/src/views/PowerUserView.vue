<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Terminal, ChevronRight, Zap } from 'lucide-vue-next'
import { useCommandLine } from '../composables/useCommandLine'

const router = useRouter()
const { 
    outputLines, 
    isProcessing, 
    executeCommand, 
    addOutput, 
    getHistoryCommand,
    getCompletions
} = useCommandLine()

const inputValue = ref('')
const inputRef = ref(null)
const outputRef = ref(null)
const historyIndex = ref(0)
const tabCompletions = ref([])
const tabIndex = ref(0)

// Focus input on mount
onMounted(() => {
    inputRef.value?.focus()
    addOutput('╔══════════════════════════════════════════════════════════════╗', 'welcome')
    addOutput('║          SERVATIVPRO POWER USER CLI v1.0                     ║', 'welcome')
    addOutput('║          Type "help" or "?" for available commands           ║', 'welcome')
    addOutput('╚══════════════════════════════════════════════════════════════╝', 'welcome')
    addOutput('', 'normal')
})

// Auto-scroll to bottom when output changes
watch(outputLines, async () => {
    await nextTick()
    if (outputRef.value) {
        outputRef.value.scrollTop = outputRef.value.scrollHeight
    }
}, { deep: true })

const handleSubmit = async () => {
    const cmd = inputValue.value
    inputValue.value = ''
    historyIndex.value = 0
    tabCompletions.value = []
    tabIndex.value = 0
    await executeCommand(cmd)
    
    // Refocus input after command execution (once disabled state is cleared)
    nextTick(() => {
        inputRef.value?.focus()
    })
}

const handleKeydown = (e) => {
    // Tab - autocomplete
    if (e.key === 'Tab') {
        e.preventDefault()
        
        // Get fresh completions if we haven't started tabbing yet
        if (tabCompletions.value.length === 0) {
            tabCompletions.value = getCompletions(inputValue.value)
            tabIndex.value = 0
        } else {
            // Cycle through completions
            tabIndex.value = (tabIndex.value + 1) % tabCompletions.value.length
        }
        
        if (tabCompletions.value.length > 0) {
            const completion = tabCompletions.value[tabIndex.value]
            const parts = inputValue.value.trim().split(/\s+/)
            
            if (parts.length <= 1 && !inputValue.value.endsWith(' ')) {
                // Complete the command itself
                inputValue.value = completion
            } else {
                // Complete the argument
                parts[parts.length - 1] = completion
                inputValue.value = parts.join(' ')
            }
        }
        return
    }
    
    // Reset tab completions on any other key
    if (e.key !== 'Shift') {
        tabCompletions.value = []
        tabIndex.value = 0
    }
    
    // Up arrow - previous command
    if (e.key === 'ArrowUp') {
        e.preventDefault()
        historyIndex.value++
        const cmd = getHistoryCommand(historyIndex.value)
        if (cmd) {
            inputValue.value = cmd
        } else {
            historyIndex.value = Math.max(0, historyIndex.value - 1)
        }
    }
    // Down arrow - next command
    else if (e.key === 'ArrowDown') {
        e.preventDefault()
        historyIndex.value = Math.max(0, historyIndex.value - 1)
        if (historyIndex.value === 0) {
            inputValue.value = ''
        } else {
            const cmd = getHistoryCommand(historyIndex.value)
            if (cmd) inputValue.value = cmd
        }
    }
    // Ctrl+L - clear
    else if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        executeCommand('clear')
    }
}

// Click anywhere to focus input
const focusInput = () => {
    inputRef.value?.focus()
}

// Get CSS class for output line type
const getLineClass = (type) => {
    const classes = {
        command: 'text-cyan-400 font-bold',
        error: 'text-red-400',
        success: 'text-green-400',
        info: 'text-blue-400',
        help: 'text-amber-300 font-mono',
        welcome: 'text-purple-400 font-bold',
        system: 'text-slate-500 italic',
        normal: 'text-slate-300'
    }
    return classes[type] || classes.normal
}
</script>

<template>
    <div class="h-full flex flex-col bg-slate-900 text-slate-100" @click="focusInput">
        <!-- Header -->
        <div class="bg-slate-800 border-b border-slate-700 px-6 py-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                    <Terminal class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-white flex items-center gap-2">
                        Power User CLI
                        <Zap class="w-4 h-4 text-amber-400" />
                    </h1>
                    <p class="text-sm text-slate-400">Command-line interface for power users</p>
                </div>
            </div>
        </div>

        <!-- Terminal Output -->
        <div 
            ref="outputRef"
            class="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
            style="background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);"
        >
            <div 
                v-for="(line, idx) in outputLines" 
                :key="idx" 
                class="whitespace-pre-wrap leading-relaxed"
            >
                <template v-if="line.content">
                    <span 
                        v-for="(seg, sIdx) in line.content" 
                        :key="sIdx"
                        :class="[getLineClass(seg.type), seg.link ? 'cursor-pointer hover:underline' : '']"
                        @click="seg.link ? router.push(seg.link) : null"
                    >
                        {{ seg.text }}
                    </span>
                </template>
                <template v-else>
                    <span :class="getLineClass(line.type)">{{ line.text }}</span>
                </template>
            </div>
        </div>

        <!-- Input Area -->
        <div class="bg-slate-800 border-t border-slate-700 p-4">
            <form @submit.prevent="handleSubmit" class="flex items-center gap-3">
                <ChevronRight class="w-5 h-5 text-green-400 flex-shrink-0" />
                <input
                    ref="inputRef"
                    v-model="inputValue"
                    @keydown="handleKeydown"
                    :disabled="isProcessing"
                    type="text"
                    class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder-slate-500"
                    placeholder="Type a command..."
                    autocomplete="off"
                    spellcheck="false"
                />
                <button
                    type="submit"
                    :disabled="isProcessing"
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                    {{ isProcessing ? '...' : 'Run' }}
                </button>
            </form>
            <div class="mt-2 text-xs text-slate-500 flex gap-4">
                <span>Tab Autocomplete</span>
                <span>↑↓ History</span>
                <span>Ctrl+L Clear</span>
                <span>Enter Execute</span>
            </div>
        </div>
    </div>
</template>
