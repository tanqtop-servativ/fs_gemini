<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useJobs } from '../composables/useJobs'
import { 
    ArrowLeft, Calendar, Car, Play, Square, ChevronDown, ChevronUp,
    MapPin, Pencil, ExternalLink, CheckCircle2, Circle
} from 'lucide-vue-next'
import JobPhotos from '../components/jobs/JobPhotos.vue'
import JobComments from '../components/jobs/JobComments.vue'

const route = useRoute()
const router = useRouter()
const { getJobDetail, updateJobStatus, toggleTask, getStatusColor } = useJobs()

const jobId = computed(() => route.params.id)

const job = ref(null)
const property = ref(null)
const tasks = ref([])
const workers = ref([])
const loading = ref(true)

// Expandable sections
const expandedSections = ref({
    summary: true,
    fieldTech: true,
    checklist: true,
    photos: false,
    comments: false
})

const toggleSection = (key) => {
    expandedSections.value[key] = !expandedSections.value[key]
}

const fetchJob = async () => {
    if (!jobId.value) return
    loading.value = true
    
    const result = await getJobDetail(jobId.value)
    
    if (!result.success) {
        console.error(result.error)
        alert("Job not found")
        router.push('/')
        return
    }
    
    const data = result.job
    job.value = data
    property.value = data.property
    tasks.value = data.tasks || []
    
    // Map assignments to worker format
    workers.value = (data.assignments || []).map(a => ({
        ...a,
        initials: a.name ? a.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U',
        status: 'Assigned',
        travelTime: null,
        timeOnJob: null
    }))
    
    loading.value = false
}

const handleToggleTask = async (task) => {
    const originalState = task.is_completed
    task.is_completed = !task.is_completed // Optimistic
    
    const result = await toggleTask(task.id)
    
    if (!result.success) {
        task.is_completed = originalState // Revert
        console.error(result.error)
    }
}

const handleStatusUpdate = async (newStatus) => {
    const result = await updateJobStatus(jobId.value, newStatus)
    
    if (result.success) {
        job.value.status = newStatus
    } else {
        alert(result.error)
    }
}

const completedCount = computed(() => tasks.value.filter(t => t.is_completed).length)

// Action button states
const actionStates = computed(() => {
    const status = job.value?.status
    return {
        scheduled: status !== 'Pending',
        omw: false,
        started: status === 'In Progress' || status === 'Complete',
        finished: status === 'Complete'
    }
})

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

onMounted(fetchJob)
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100 overflow-hidden">
      
      <!-- Breadcrumb & Header -->
      <div class="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <!-- Breadcrumb -->
          <div class="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <router-link to="/properties" class="hover:text-blue-600">Properties</router-link>
              <span>›</span>
              <router-link v-if="property" :to="`/properties?id=${property.id}`" class="hover:text-blue-600">{{ property.name }}</router-link>
              <span>›</span>
              <router-link to="/jobs" class="hover:text-blue-600">Jobs</router-link>
              <span>›</span>
              <span class="text-gray-700">Job #{{ job?.readable_id || jobId?.slice(0,8) }}</span>
          </div>
          
          <!-- Title -->
          <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-900">
                  {{ job?.title || 'Loading...' }}
                  <button class="text-gray-400 hover:text-gray-600 ml-2"><Pencil size="16" /></button>
              </h1>
          </div>
          <div class="text-sm text-gray-500 mt-1">
              Job #{{ job?.readable_id || jobId?.slice(0,8) }}
              <span 
                class="ml-2 text-xs px-2 py-0.5 rounded font-bold uppercase"
                :class="getStatusBadgeClass(job?.status)"
              >
                  {{ job?.status }}
              </span>
          </div>
      </div>

      <!-- Body -->
      <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
          Loading Job...
      </div>
      
      <div v-else class="flex-1 flex overflow-hidden">
          
          <!-- LEFT SIDEBAR: Customer/Property Card -->
          <div class="w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
              
              <!-- Property Image -->
              <div class="relative">
                  <div v-if="property?.front_photo_url" class="aspect-video bg-gray-800">
                      <img :src="property.front_photo_url" class="w-full h-full object-cover" />
                  </div>
                  <div v-else class="aspect-video bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <MapPin class="text-gray-500" size="48" />
                  </div>
                  
                  <!-- Stats overlay -->
                  <div class="absolute top-2 left-2 flex gap-2">
                      <div v-if="property" class="bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-bold">
                          {{ property.name?.length > 15 ? property.name.slice(0,15) + '...' : property.name }}
                      </div>
                  </div>
              </div>

              <!-- Property Details -->
              <div class="p-4 space-y-4">
                  <div class="flex items-start justify-between">
                      <div>
                          <h3 class="font-bold text-gray-900">{{ property?.name }}</h3>
                      </div>
                      <router-link 
                        v-if="property"
                        :to="`/properties?id=${property.id}`"
                        class="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                      >
                          View details
                      </router-link>
                  </div>
                  
                  <!-- Address -->
                  <div class="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin size="14" class="mt-0.5 text-gray-400 shrink-0" />
                      <a :href="mapUrl" target="_blank" class="hover:text-blue-600 hover:underline">
                          {{ (property?.address || 'No address').replace(/[,\s]+$/, '') }}
                      </a>
                  </div>
              </div>

              <!-- Map Preview -->
              <div class="border-t border-gray-100">
                  <div class="text-xs text-gray-500 px-4 py-2 bg-gray-50 flex items-center gap-2 border-b border-gray-100">
                      <span class="font-medium text-gray-700">Map</span>
                  </div>
                  <div class="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                      <a :href="mapUrl" target="_blank" class="text-blue-500 hover:underline text-sm flex items-center gap-1">
                          <ExternalLink size="14" /> Open in Google Maps
                      </a>
                  </div>
              </div>
          </div>
          
          <!-- MAIN CONTENT -->
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
              
              <!-- Action Buttons Row -->
              <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-center gap-6">
                      <!-- Schedule -->
                      <div class="text-center">
                          <div class="text-[10px] text-gray-400 uppercase mb-1">
                              {{ actionStates.scheduled ? '' : 'UNDO' }}
                          </div>
                          <button 
                            class="w-12 h-12 rounded-full flex items-center justify-center transition"
                            :class="actionStates.scheduled ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'"
                          >
                              <Calendar size="20" />
                          </button>
                          <div class="text-xs font-medium text-blue-600 mt-1">SCHEDULE</div>
                          <div class="text-[10px] text-gray-400">—</div>
                      </div>
                      
                      <!-- OMW -->
                      <div class="text-center">
                          <div class="text-[10px] text-gray-400 uppercase mb-1">UNDO</div>
                          <button class="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                              <Car size="20" />
                          </button>
                          <div class="text-xs font-medium text-gray-500 mt-1">OMW</div>
                          <div class="text-[10px] text-gray-400">—</div>
                      </div>
                      
                      <!-- Start -->
                      <div class="text-center">
                          <div class="text-[10px] text-gray-400 uppercase mb-1">UNDO</div>
                          <button 
                            @click="handleStatusUpdate('In Progress')"
                            class="w-12 h-12 rounded-full flex items-center justify-center transition"
                            :class="actionStates.started ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-blue-100'"
                          >
                              <Play size="20" />
                          </button>
                          <div class="text-xs font-medium mt-1" :class="actionStates.started ? 'text-blue-600' : 'text-gray-500'">START</div>
                          <div class="text-[10px] text-gray-400">—</div>
                      </div>
                      
                      <!-- Finish -->
                      <div class="text-center">
                          <div class="text-[10px] text-gray-400 uppercase mb-1">UNDO</div>
                          <button 
                            @click="handleStatusUpdate('Complete')"
                            class="w-12 h-12 rounded-full flex items-center justify-center transition"
                            :class="actionStates.finished ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-100'"
                          >
                              <Square size="20" />
                          </button>
                          <div class="text-xs font-medium mt-1" :class="actionStates.finished ? 'text-blue-600' : 'text-gray-500'">FINISH</div>
                          <div class="text-[10px] text-gray-400">—</div>
                      </div>
                  </div>
              </div>

              <!-- Summary of work -->
              <div class="bg-white rounded-lg border border-gray-200">
                  <button 
                    @click="toggleSection('summary')"
                    class="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50"
                  >
                      <h3 class="font-semibold text-gray-900">Summary of work</h3>
                      <ChevronDown v-if="!expandedSections.summary" size="18" class="text-gray-400" />
                      <ChevronUp v-else size="18" class="text-gray-400" />
                  </button>
                  <div v-if="expandedSections.summary" class="px-4 pb-4 border-t border-gray-100">
                      <p v-if="job?.description" class="text-sm text-gray-700 pt-3 whitespace-pre-wrap">{{ job.description }}</p>
                      <p v-else class="text-sm text-gray-400 italic pt-3">No summary provided</p>
                  </div>
              </div>

              <!-- Field tech status -->
              <div class="bg-white rounded-lg border border-gray-200">
                  <button 
                    @click="toggleSection('fieldTech')"
                    class="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50"
                  >
                      <h3 class="font-semibold text-gray-900">Field tech status</h3>
                      <ChevronDown v-if="!expandedSections.fieldTech" size="18" class="text-gray-400" />
                      <ChevronUp v-else size="18" class="text-gray-400" />
                  </button>
                  <div v-if="expandedSections.fieldTech" class="border-t border-gray-100">
                      <div v-if="workers.length === 0" class="px-4 py-6 text-center text-gray-400 text-sm">
                          No workers assigned
                      </div>
                      <div v-else>
                          <!-- Table Header -->
                          <div class="grid grid-cols-4 gap-4 px-4 py-2 text-xs text-gray-500 font-medium bg-gray-50 border-b border-gray-100">
                              <div>Employee name</div>
                              <div>Status</div>
                              <div>Total travel time</div>
                              <div>Total time on job</div>
                          </div>
                          <!-- Rows -->
                          <div v-for="w in workers" :key="w.id" class="grid grid-cols-4 gap-4 px-4 py-3 items-center border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <div class="flex items-center gap-2">
                                  <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                      {{ w.initials }}
                                  </div>
                                  <span class="text-sm text-gray-900">{{ w.name }}</span>
                              </div>
                              <div class="text-sm text-gray-600">{{ w.status }}</div>
                              <div class="text-sm text-gray-600">{{ w.travelTime || '—' }}</div>
                              <div class="text-sm text-gray-600">{{ w.timeOnJob || '—' }}</div>
                          </div>
                      </div>
                  </div>
              </div>

              <!-- Checklist -->
              <div class="bg-white rounded-lg border border-gray-200">
                  <button 
                    @click="toggleSection('checklist')"
                    class="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50"
                  >
                      <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                          Checklist
                          <span class="text-xs font-normal text-gray-500">({{ completedCount }}/{{ tasks.length }})</span>
                      </h3>
                      <ChevronDown v-if="!expandedSections.checklist" size="18" class="text-gray-400" />
                      <ChevronUp v-else size="18" class="text-gray-400" />
                  </button>
                  <div v-if="expandedSections.checklist" class="border-t border-gray-100">
                      <div v-if="tasks.length === 0" class="px-4 py-6 text-center text-gray-400 text-sm">
                          No tasks defined
                      </div>
                      <div v-else class="divide-y divide-gray-100">
                          <div 
                            v-for="task in tasks" 
                            :key="task.id" 
                            class="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer"
                            @click="handleToggleTask(task)"
                          >
                              <CheckCircle2 v-if="task.is_completed" size="20" class="text-green-500 fill-green-50" />
                              <Circle v-else size="20" class="text-gray-300" />
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

              <!-- Photos -->
              <div class="bg-white rounded-lg border border-gray-200">
                  <button 
                    @click="toggleSection('photos')"
                    class="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50"
                  >
                      <h3 class="font-semibold text-gray-900">Photos</h3>
                      <ChevronDown v-if="!expandedSections.photos" size="18" class="text-gray-400" />
                      <ChevronUp v-else size="18" class="text-gray-400" />
                  </button>
                  <div v-if="expandedSections.photos" class="border-t border-gray-100 p-4">
                      <JobPhotos :jobId="jobId" />
                  </div>
              </div>

              <!-- Comments -->
              <div class="bg-white rounded-lg border border-gray-200">
                  <button 
                    @click="toggleSection('comments')"
                    class="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50"
                  >
                      <h3 class="font-semibold text-gray-900">Comments</h3>
                      <ChevronDown v-if="!expandedSections.comments" size="18" class="text-gray-400" />
                      <ChevronUp v-else size="18" class="text-gray-400" />
                  </button>
                  <div v-if="expandedSections.comments" class="border-t border-gray-100">
                      <JobComments :jobId="jobId" />
                  </div>
              </div>

          </div>
      </div>
  </div>
</template>
