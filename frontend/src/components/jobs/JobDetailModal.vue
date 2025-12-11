<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useJobs } from '../../composables/useJobs'
import { 
    X, MapPin, ExternalLink, CheckCircle2, Circle, Calendar, 
    Briefcase, Users, Clock, Play, Square
} from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  jobId: String
})

const emit = defineEmits(['close'])
const router = useRouter()

const { getJobDetail, updateJobStatus, toggleTask, getStatusColor } = useJobs()

// Component State
const loading = ref(false)
const job = ref(null)
const property = ref(null)
const tasks = ref([])
const workers = ref([])

// Fetch job details when modal opens
watch([() => props.isOpen, () => props.jobId], async ([open, id]) => {
  if (!open || !id) return
  
  loading.value = true
  const result = await getJobDetail(id)
  
  if (result.success) {
    job.value = result.job
    property.value = result.job.property
    tasks.value = result.job.tasks || []
    workers.value = (result.job.assignments || []).map(a => ({
      ...a,
      initials: a.name ? a.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
    }))
  }
  loading.value = false
}, { immediate: true })

const handleToggleTask = async (task) => {
    const originalState = task.is_completed
    task.is_completed = !task.is_completed
    
    const result = await toggleTask(task.id)
    if (!result.success) {
        task.is_completed = originalState
    }
}

const handleStatusUpdate = async (newStatus) => {
    const result = await updateJobStatus(props.jobId, newStatus)
    if (result.success) {
        job.value.status = newStatus
    }
}

const completedCount = computed(() => tasks.value.filter(t => t.is_completed).length)

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Pending': return 'bg-amber-100 text-amber-700'
        case 'In Progress': return 'bg-blue-100 text-blue-700'
        case 'Complete': return 'bg-green-100 text-green-700'
        case 'Cancelled': return 'bg-red-100 text-red-700'
        default: return 'bg-gray-100 text-gray-600'
    }
}

const mapUrl = computed(() => {
    if (!property.value?.address) return null
    return `https://maps.google.com/?q=${encodeURIComponent(property.value.address)}`
})

const goToFullPage = () => {
    emit('close')
    router.push(`/jobs/${props.jobId}`)
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
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-start bg-slate-50">
            <div v-if="!loading && job">
                <div class="flex items-center gap-2">
                    <Briefcase size="18" class="text-slate-500" />
                    <h2 class="text-xl font-bold text-slate-900">{{ job.title }}</h2>
                    <span 
                        class="text-xs px-2 py-0.5 rounded font-bold uppercase"
                        :class="getStatusBadgeClass(job.status)"
                    >
                        {{ job.status }}
                    </span>
                </div>
                <p class="text-sm text-gray-500 mt-1">Job #{{ job.readable_id || jobId?.slice(0,8) }}</p>
            </div>
            <div v-else class="animate-pulse">
                <div class="h-6 bg-gray-200 rounded w-48"></div>
                <div class="h-4 bg-gray-200 rounded w-24 mt-2"></div>
            </div>
            <div class="flex items-center gap-1">
                <button @click="goToFullPage" class="text-gray-400 hover:text-blue-600 transition-colors p-2 rounded hover:bg-blue-50" title="Open Full Page">
                    <ExternalLink size="16" />
                </button>
                <button @click="$emit('close')" class="text-gray-400 hover:text-black transition-colors p-2 rounded hover:bg-slate-100"><X size="20" /></button>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="p-8 text-center text-gray-400">
            Loading job details...
        </div>

        <!-- Content -->
        <div v-else-if="job" class="flex-1 overflow-y-auto">
            <!-- Property Info -->
            <div class="p-4 border-b border-gray-100 bg-gray-50">
                <div class="flex items-start gap-3">
                    <div v-if="property?.front_photo_url" class="w-20 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                        <img :src="property.front_photo_url" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-20 h-14 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                        <MapPin class="text-gray-400" size="24" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-gray-900">{{ property?.name || 'Unknown Property' }}</h3>
                        <a :href="mapUrl" target="_blank" class="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 truncate">
                            <MapPin size="12" />
                            {{ property?.address || 'No address' }}
                        </a>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="p-4 border-b border-gray-100 flex items-center justify-center gap-6">
                <button 
                    @click="handleStatusUpdate('Pending')"
                    class="flex flex-col items-center gap-1"
                    :class="job.status === 'Pending' ? 'text-amber-600' : 'text-gray-400 hover:text-amber-500'"
                >
                    <Calendar size="24" />
                    <span class="text-xs font-medium">Pending</span>
                </button>
                <button 
                    @click="handleStatusUpdate('In Progress')"
                    class="flex flex-col items-center gap-1"
                    :class="job.status === 'In Progress' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'"
                >
                    <Play size="24" />
                    <span class="text-xs font-medium">Start</span>
                </button>
                <button 
                    @click="handleStatusUpdate('Complete')"
                    class="flex flex-col items-center gap-1"
                    :class="job.status === 'Complete' ? 'text-green-600' : 'text-gray-400 hover:text-green-500'"
                >
                    <Square size="24" />
                    <span class="text-xs font-medium">Complete</span>
                </button>
            </div>

            <!-- Description -->
            <div v-if="job.description" class="p-4 border-b border-gray-100">
                <h4 class="text-xs font-bold uppercase text-gray-400 mb-2">Summary</h4>
                <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ job.description }}</p>
            </div>

            <!-- Assigned Workers -->
            <div v-if="workers.length > 0" class="p-4 border-b border-gray-100">
                <h4 class="text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-1">
                    <Users size="12" />
                    Assigned ({{ workers.length }})
                </h4>
                <div class="flex flex-wrap gap-2">
                    <div v-for="w in workers" :key="w.id" class="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full">
                        <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {{ w.initials }}
                        </div>
                        <span class="text-sm text-blue-700 font-medium">{{ w.name }}</span>
                    </div>
                </div>
            </div>

            <!-- Checklist -->
            <div v-if="tasks.length > 0" class="p-4">
                <h4 class="text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-1">
                    <CheckCircle2 size="12" />
                    Checklist ({{ completedCount }}/{{ tasks.length }})
                </h4>
                <div class="space-y-1">
                    <div 
                        v-for="task in tasks" 
                        :key="task.id" 
                        class="flex items-center gap-2 py-2 px-3 rounded hover:bg-gray-50 cursor-pointer transition"
                        @click="handleToggleTask(task)"
                    >
                        <CheckCircle2 v-if="task.is_completed" size="18" class="text-green-500 flex-shrink-0" />
                        <Circle v-else size="18" class="text-gray-300 flex-shrink-0" />
                        <span 
                            class="text-sm"
                            :class="task.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'"
                        >
                            {{ task.title }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <button @click="goToFullPage" class="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1">
                <ExternalLink size="14" />
                Open Full Page
            </button>
            <button @click="$emit('close')" class="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition">
                Close
            </button>
        </div>

    </div>
  </div>
</template>
