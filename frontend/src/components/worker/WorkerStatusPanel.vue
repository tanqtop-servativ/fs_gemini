<template>
  <div class="worker-status-panel">
    <!-- Current Status Display -->
    <div class="mb-4 p-3 rounded-lg" :class="currentStatusClass">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium opacity-75">Current Status</p>
          <p class="text-lg font-bold">{{ currentStatus || 'Not Started' }}</p>
        </div>
        <component :is="currentStatusIcon" class="w-8 h-8 opacity-75" />
      </div>
    </div>

    <!-- Status Buttons -->
    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="btn in availableButtons"
        :key="btn.status"
        @click="handleStatusChange(btn.status)"
        :disabled="loading || btn.disabled"
        class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all"
        :class="getButtonClass(btn)"
      >
        <component :is="getIcon(btn.icon)" class="w-6 h-6 mb-2" />
        <span class="font-semibold">{{ btn.label }}</span>
        <span class="text-xs opacity-75">{{ btn.labelEs }}</span>
      </button>
    </div>

    <!-- Finish Action -->
    <div v-if="currentStatus === 'Started' || currentStatus === 'Paused'" class="mt-4">
      <button
        @click="handleFinish"
        :disabled="loading"
        class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
      >
        <CheckCircle class="w-6 h-6" />
        <span>Finish Work</span>
        <span class="text-sm opacity-75 ml-1">(Terminar)</span>
      </button>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="mt-4 text-center text-gray-500">
      <div class="animate-spin inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
      <span class="ml-2">Updating...</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Navigation, Play, Pause, CheckCircle, Clock } from 'lucide-vue-next'
import { useWorkerStatus } from '../../composables/useWorkerStatus'

const props = defineProps({
  visitId: { type: String, required: true },
  initialStatus: { type: String, default: null }
})

const emit = defineEmits(['statusChanged', 'finishRequested'])

const { logStatus, getCurrentLocation, statusButtons } = useWorkerStatus()

const loading = ref(false)
const currentStatus = ref(props.initialStatus)

const currentStatusClass = computed(() => {
  const status = currentStatus.value
  if (status === 'On My Way') return 'bg-blue-100 text-blue-800'
  if (status === 'Started') return 'bg-green-100 text-green-800'
  if (status === 'Paused') return 'bg-amber-100 text-amber-800'
  if (status === 'Finished') return 'bg-emerald-100 text-emerald-800'
  return 'bg-gray-100 text-gray-600'
})

const currentStatusIcon = computed(() => {
  const status = currentStatus.value
  if (status === 'On My Way') return Navigation
  if (status === 'Started') return Play
  if (status === 'Paused') return Pause
  if (status === 'Finished') return CheckCircle
  return Clock
})

const availableButtons = computed(() => {
  const status = currentStatus.value
  
  return statusButtons.map(btn => {
    let disabled = false
    
    if (btn.status === 'On My Way') {
      disabled = status !== null // Can only use if not started
    } else if (btn.status === 'Started') {
      disabled = status === 'Started' || status === 'Finished'
    } else if (btn.status === 'Paused') {
      disabled = status !== 'Started'
    } else if (btn.status === 'Finished') {
      disabled = status === 'Finished' || !status
    }
    
    return { ...btn, disabled }
  }).filter(btn => btn.status !== 'Finished') // Finish is separate button
})

const getButtonClass = (btn) => {
  if (btn.disabled) {
    return 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
  }
  
  const colorMap = {
    blue: 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100',
    green: 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100',
    amber: 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100',
    emerald: 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
  }
  
  return colorMap[btn.color] || 'bg-gray-50 border-gray-300'
}

const getIcon = (iconName) => {
  const icons = { navigation: Navigation, play: Play, pause: Pause, check: CheckCircle }
  return icons[iconName] || Clock
}

const handleStatusChange = async (status) => {
  loading.value = true
  
  try {
    const location = await getCurrentLocation()
    const result = await logStatus(props.visitId, status, location)
    
    if (result.success) {
      currentStatus.value = status
      emit('statusChanged', { status, logId: result.logId })
    } else {
      console.error('Failed to log status:', result.error)
    }
  } finally {
    loading.value = false
  }
}

const handleFinish = async () => {
  emit('finishRequested')
}
</script>

<style scoped>
.worker-status-panel {
  @apply p-4 bg-white rounded-2xl shadow-lg;
}
</style>
