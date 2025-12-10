<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { X, Copy, Calendar, Home, MapPin, Tag, FileText, Key } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  event: Object // FullCalendar event object with extendedProps
})

const emit = defineEmits(['close'])

// Format date for display
const formatDate = (d) => {
  if (!d) return ''
  return d.toLocaleString(undefined, { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric', 
    minute: '2-digit' 
  })
}

const dateRange = computed(() => {
  if (!props.event) return ''
  return `${formatDate(props.event.start)} - ${formatDate(props.event.end)}`
})

// Build text for clipboard
const clipboardText = computed(() => {
  if (!props.event) return ''
  const e = props.event
  const p = e.extendedProps || {}
  
  const lines = [
    `Event: ${e.title}`,
    `Dates: ${dateRange.value}`,
  ]
  
  if (p.property_name) lines.push(`Property: ${p.property_name}`)
  if (p.property_address) lines.push(`Address: ${p.property_address}`)
  if (p.event_type) lines.push(`Type: ${p.event_type}`)
  if (p.description) lines.push(`Description: ${p.description}`)
  if (p.code) lines.push(`Code: ${p.code}`)
  
  return lines.join('\n')
})

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(clipboardText.value)
    // Silent copy - no alert needed
  } catch (err) {
    console.error('Failed to copy:', err.message)
  }
}

// ESC Key Handler
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="isOpen && event" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
      
      <!-- Header -->
      <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 class="text-lg font-bold text-slate-900 truncate pr-4">{{ event.title }}</h2>
        <div class="flex items-center gap-2">
          <button @click="copyToClipboard" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Copy to clipboard">
            <Copy :size="18" />
          </button>
          <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition">
            <X :size="18" />
          </button>
        </div>
      </div>
      
      <!-- Body -->
      <div class="p-5 space-y-4">
        <!-- Dates -->
        <div class="flex items-start gap-3">
          <Calendar :size="18" class="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-xs text-gray-500 uppercase font-bold">Dates</div>
            <div class="text-sm">{{ dateRange }}</div>
          </div>
        </div>
        
        <!-- Property -->
        <div v-if="event.extendedProps?.property_name" class="flex items-start gap-3">
          <Home :size="18" class="text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-xs text-gray-500 uppercase font-bold">Property</div>
            <div class="text-sm font-medium">{{ event.extendedProps.property_name }}</div>
          </div>
        </div>
        
        <!-- Address -->
        <div v-if="event.extendedProps?.property_address" class="flex items-start gap-3">
          <MapPin :size="18" class="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-xs text-gray-500 uppercase font-bold">Address</div>
            <div class="text-sm">{{ event.extendedProps.property_address }}</div>
          </div>
        </div>
        
        <!-- Event Type -->
        <div v-if="event.extendedProps?.event_type" class="flex items-start gap-3">
          <Tag :size="18" class="text-purple-500 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-xs text-gray-500 uppercase font-bold">Type</div>
            <div class="text-sm">{{ event.extendedProps.event_type }}</div>
          </div>
        </div>
        
        <!-- Description -->
        <div v-if="event.extendedProps?.description" class="flex items-start gap-3">
          <FileText :size="18" class="text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-xs text-gray-500 uppercase font-bold">Description</div>
            <div class="text-sm whitespace-pre-wrap">{{ event.extendedProps.description }}</div>
          </div>
        </div>
        
        <!-- Code -->
        <div v-if="event.extendedProps?.code" class="flex items-start gap-3">
          <Key :size="18" class="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-xs text-gray-500 uppercase font-bold">Code</div>
            <div class="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{{ event.extendedProps.code }}</div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>
