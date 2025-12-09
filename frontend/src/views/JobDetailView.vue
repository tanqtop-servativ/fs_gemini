<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { ArrowLeft, CheckCircle2, Circle, Play, Square, Undo2, Clock, MapPin, Sparkles } from 'lucide-vue-next'
import JobSidebar from '../components/jobs/JobSidebar.vue'
import WorkerStatusSection from '../components/jobs/WorkerStatusSection.vue'
import JobTimer from '../components/jobs/JobTimer.vue'
import JobComments from '../components/jobs/JobComments.vue'
import JobPhotos from '../components/jobs/JobPhotos.vue'

const route = useRoute()
const router = useRouter()
const jobId = computed(() => route.params.id)

const job = ref(null)
const property = ref(null)
const tasks = ref([])
const loading = ref(true)

// AI Description placeholder
const generatingDescription = ref(false)

const fetchJob = async () => {
    if (!jobId.value) return
    loading.value = true
    const { data, error } = await supabase
        .from('jobs')
        .select(`
            *,
            properties:property_id(id, name, address, latitude, longitude),
            service_opportunities:service_opportunity_id(id, title, service_template_id)
        `)
        .eq('id', jobId.value)
        .is('deleted_at', null)
        .single()
    
    if (error) {
        console.error(error)
        alert("Job not found")
        router.push('/')
        return
    }
    
    job.value = data
    property.value = data.properties
    fetchTasks()
    loading.value = false
}

const fetchTasks = async () => {
    const { data } = await supabase
        .from('job_tasks')
        .select('*')
        .eq('job_id', jobId.value)
        .order('id')
    
    tasks.value = data || []
}

const toggleTask = async (task) => {
    const newVal = !task.is_completed
    task.is_completed = newVal
    
    const { error } = await supabase
        .from('job_tasks')
        .update({ is_completed: newVal })
        .eq('id', task.id)
    
    if (error) {
        task.is_completed = !newVal
        console.error(error)
    }
}

const completedCount = computed(() => tasks.value.filter(t => t.is_completed).length)
const progress = computed(() => {
    if (tasks.value.length === 0) return 0
    return Math.round((completedCount.value / tasks.value.length) * 100)
})

const updateStatus = async (newStatus) => {
    const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId.value)
    
    if (error) alert(error.message)
    else job.value.status = newStatus
}

const startJob = () => {
    updateStatus('In Progress')
}

const completeJob = () => {
    updateStatus('Complete')
}

const generateAIDescription = async () => {
    generatingDescription.value = true
    // Placeholder - would call AI API
    setTimeout(() => {
        alert('AI Description generation coming soon!')
        generatingDescription.value = false
    }, 1000)
}

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Pending': return 'bg-amber-100 text-amber-700'
        case 'In Progress': return 'bg-blue-100 text-blue-700'
        case 'Complete': return 'bg-green-100 text-green-700'
        case 'Cancelled': return 'bg-red-100 text-red-700'
        default: return 'bg-gray-100 text-gray-600'
    }
}

onMounted(fetchJob)
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50 overflow-hidden">
      
      <!-- Header Bar -->
      <div class="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm z-10">
          <div class="flex items-center gap-3">
              <button @click="router.back()" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition">
                  <ArrowLeft size="18" />
              </button>
              <div>
                  <h1 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                      {{ job?.title || 'Loading...' }}
                      <span 
                        v-if="job" 
                        class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                        :class="getStatusBadgeClass(job.status)"
                      >
                          {{ job.status }}
                      </span>
                  </h1>
                  <div v-if="job" class="text-xs text-gray-500">
                      {{ job.readable_id || job.id?.slice(0, 8) }}
                  </div>
              </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2">
              <button 
                class="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Undo"
              >
                  <Undo2 size="16" />
                  <span class="hidden sm:inline">Undo</span>
              </button>
              
              <button 
                v-if="job?.status === 'Pending'"
                @click="startJob"
                class="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                  <Play size="16" />
                  Start
              </button>
              
              <JobTimer v-if="job?.status === 'In Progress'" :jobId="jobId" />
              
              <button 
                v-if="job?.status === 'In Progress'" 
                @click="completeJob" 
                class="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                  <CheckCircle2 size="16" />
                  Finish
              </button>
              
              <button 
                v-if="job?.status === 'Complete'"
                @click="updateStatus('In Progress')"
                class="flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                  Reopen
              </button>
          </div>
      </div>

      <!-- Body -->
      <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
          Loading Job...
      </div>
      
      <div v-else class="flex-1 flex min-h-0 overflow-hidden">
          
          <!-- Left Sidebar -->
          <JobSidebar 
            :property="property"
            :job="job"
            :tasks-count="tasks.length"
            :completed-tasks-count="completedCount"
            :attachments-count="0"
          />
          
          <!-- Main Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
              
              <!-- Worker Status Section -->
              <WorkerStatusSection :job-id="jobId" />
              
              <!-- Summary of Work -->
              <div v-if="job.description" class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div class="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 class="font-bold text-slate-800 text-sm">Summary of Work</h3>
                      <button 
                        @click="generateAIDescription"
                        :disabled="generatingDescription"
                        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                      >
                          <Sparkles size="12" :class="{ 'animate-spin': generatingDescription }" />
                          {{ generatingDescription ? 'Generating...' : 'AI Enhance' }}
                      </button>
                  </div>
                  <div class="p-4">
                      <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ job.description }}</p>
                  </div>
              </div>

              <!-- Tasks / Checklist -->
              <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div class="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 class="font-bold text-slate-800 flex items-center gap-2 text-sm">
                          <CheckCircle2 class="text-green-600" size="16" /> 
                          Checklist
                      </h3>
                      <div class="text-xs font-bold text-gray-500">
                          {{ completedCount }} / {{ tasks.length }} Complete
                      </div>
                  </div>
                  
                  <!-- Progress Bar -->
                  <div class="h-1 bg-gray-100 w-full">
                      <div class="h-full bg-green-500 transition-all duration-500" :style="{ width: progress + '%' }"></div>
                  </div>

                  <div class="divide-y divide-gray-100">
                      <div 
                        v-for="task in tasks" 
                        :key="task.id" 
                        class="p-4 flex items-start gap-3 hover:bg-slate-50 transition cursor-pointer group"
                        @click="toggleTask(task)"
                      >
                          <div class="mt-0.5 text-gray-400 group-hover:text-blue-500 transition">
                              <CheckCircle2 v-if="task.is_completed" class="text-green-500 fill-green-50" size="20" />
                              <Circle v-else size="20" />
                          </div>
                          <div class="flex-1">
                              <p class="font-medium text-slate-900 text-sm" :class="{'line-through text-gray-400': task.is_completed}">
                                  {{ task.title }}
                              </p>
                              <p v-if="task.description" class="text-xs text-gray-500 mt-1">
                                  {{ task.description }}
                              </p>
                          </div>
                      </div>
                      <div v-if="tasks.length === 0" class="p-8 text-center text-gray-400 italic text-sm">
                          No tasks defined for this job.
                      </div>
                  </div>
              </div>

              <!-- Photos / Artifacts -->
              <JobPhotos :jobId="jobId" />
              
              <!-- Comments -->
              <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <JobComments :jobId="jobId" />
              </div>

          </div>
      </div>
  </div>
</template>
