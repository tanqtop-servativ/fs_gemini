<script setup>
import { Search, RotateCcw } from 'lucide-vue-next'

const props = defineProps({
    modelValue: String,
    hasActiveControls: Boolean,
    placeholder: { type: String, default: 'Search...' }
})

const emit = defineEmits(['update:modelValue', 'reset'])
</script>

<template>
    <div class="flex items-center gap-2">
        <div class="relative">
            <Search class="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
            <input 
                type="text"
                :value="modelValue"
                @input="emit('update:modelValue', $event.target.value)"
                :placeholder="placeholder"
                class="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
        <button 
            v-if="hasActiveControls"
            @click="emit('reset')"
            class="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Reset filters and sorting"
        >
            <RotateCcw class="w-3.5 h-3.5" />
            Reset
        </button>
    </div>
</template>
