<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      
      <!-- Modal -->
      <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="p-5 border-b bg-red-50">
          <h2 class="text-xl font-bold text-red-900">Dispose Job</h2>
          <p class="text-sm text-red-700">This action cannot be undone.</p>
        </div>
        
        <!-- Form -->
        <div class="p-6 space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Disposition Type <span class="text-red-500">*</span></label>
            <div class="space-y-2">
              <label 
                v-for="opt in dispositionOptions" 
                :key="opt.value"
                class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                :class="form.type === opt.value ? 'border-red-500 bg-red-50' : ''"
              >
                <input type="radio" v-model="form.type" :value="opt.value" class="mt-0.5">
                <div>
                  <p class="font-medium text-gray-900">{{ opt.label }}</p>
                  <p class="text-sm text-gray-500">{{ opt.description }}</p>
                </div>
              </label>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Reason <span class="text-red-500">*</span>
              <span class="text-gray-400 font-normal">(min 10 characters)</span>
            </label>
            <textarea
              v-model="form.reason"
              rows="3"
              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Explain why this job is being disposed..."
            ></textarea>
            <p class="text-xs text-gray-400 mt-1">{{ form.reason.length }}/10 characters</p>
          </div>
          
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p class="font-medium text-amber-800">⚠️ This creates a permanent record</p>
            <p class="text-amber-700">Your name and timestamp will be recorded with this disposition.</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            @click="$emit('close')" 
            class="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button 
            @click="handleSubmit"
            :disabled="!canSubmit || submitting"
            class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {{ submitting ? 'Processing...' : 'Confirm Disposition' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useJobs } from '../../composables/useJobs'

const props = defineProps({
  show: { type: Boolean, default: false },
  jobId: { type: String, required: true }
})

const emit = defineEmits(['close', 'disposed'])

const { disposeJob } = useJobs()

const submitting = ref(false)
const form = ref({
  type: 'cancelled',
  reason: ''
})

const dispositionOptions = [
  { 
    value: 'cancelled', 
    label: 'Cancelled', 
    description: 'Work is no longer needed and will not be performed' 
  },
  { 
    value: 'not_required', 
    label: 'Not Required', 
    description: 'Determined that work was unnecessary' 
  },
  { 
    value: 'deferred', 
    label: 'Deferred', 
    description: 'Postponed to a future date (requires rescheduling)' 
  }
]

const canSubmit = computed(() => {
  return form.value.type && form.value.reason.length >= 10
})

const handleSubmit = async () => {
  submitting.value = true
  
  const { success, disposition_id, error } = await disposeJob(
    props.jobId, 
    form.value.type, 
    form.value.reason
  )
  
  submitting.value = false
  
  if (!success) {
    alert('Error: ' + error)
    return
  }
  
  emit('disposed', { dispositionId: disposition_id, type: form.value.type })
  emit('close')
}

// ESC Key Handler
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.show) {
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
