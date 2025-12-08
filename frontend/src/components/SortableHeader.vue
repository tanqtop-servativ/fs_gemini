<script setup>
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-vue-next'

const props = defineProps({
    sortKey: String,
    column: String,
    sortDir: String
})

const emit = defineEmits(['sort'])

const isActive = () => props.sortKey === props.column
</script>

<template>
    <button 
        @click="emit('sort', column)"
        class="inline-flex items-center gap-1 text-xs uppercase text-gray-500 font-semibold tracking-wider hover:text-gray-900 transition-colors"
    >
        <slot />
        <span class="w-3 h-3 flex items-center justify-center">
            <ArrowUp v-if="isActive() && sortDir === 'asc'" class="w-3 h-3 text-blue-600" />
            <ArrowDown v-else-if="isActive() && sortDir === 'desc'" class="w-3 h-3 text-blue-600" />
            <ArrowUpDown v-else class="w-3 h-3 opacity-30" />
        </span>
    </button>
</template>
