<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { ArrowLeft, CheckCircle2, Circle, Calendar, MapPin, Briefcase } from 'lucide-vue-next'
import JobTimer from '../components/jobs/JobTimer.vue'
import JobComments from '../components/jobs/JobComments.vue'
import JobPhotos from '../components/jobs/JobPhotos.vue'

const route = useRoute()
const router = useRouter()
const jobId = computed(() => route.params.id)

const job = ref(null)
const tasks = ref([])
const loading = ref(true)

const fetchJob = async () => {
    if (!jobId.value) return
    loading.value = true
    const { data, error } = await supabase
        .from('jobs')
        .select(`
            *,
            property:property_id(name, address),
            service:service_opportunity_id(service_template_id)
        `)
        .eq('id', jobId.value)
        .single()
    
    if (error) {
        console.error(error)
        alert("Job not found")
        router.push('/')
        return
    }
    
    job.value = data
    fetchTasks()
    loading.value = false
}

const fetchTasks = async () => {
    const { data } = await supabase
        .from('job_tasks')
        .select('*')
        .eq('job_id', jobId.value)
        .order('id') // or sort_order if exists
    
    tasks.value = data || []
}

const toggleTask = async (task) => {
    const newVal = !task.is_completed
    // Optimistic update
    task.is_completed = newVal
    
    const { error } = await supabase
        .from('job_tasks')
        .update({ is_completed: newVal })
        .eq('id', task.id)
    
    if (error) {
        task.is_completed = !newVal // Revert
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

onMounted(fetchJob)
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50 overflow-hidden">
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
          <div class="flex items-center gap-4">
              <button @click="router.back()" class="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition">
                  <ArrowLeft size="20" />
              </button>
              <div>
                  <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                      {{ job?.title || 'Loading...' }}
                      <span v-if="job" class="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider" 
                        :class="{
                            'bg-blue-100 text-blue-700': job.status === 'Scheduled',
                            'bg-green-100 text-green-700': job.status === 'Completed',
                            'bg-gray-100 text-gray-600': job.status === 'Draft'
                        }">
                          {{ job.status }}
                      </span>
                  </h1>
                  <div v-if="job" class="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span class="flex items-center gap-1"><MapPin size="14" /> {{ job.property?.name }}</span>
                      <span class="flex items-center gap-1"><Calendar size="14" /> {{ new Date(job.created_at).toLocaleDateString() }}</span>
                  </div>
              </div>
          </div>

          <div class="flex items-center gap-4">
              <JobTimer :jobId="jobId" />
              <button 
                v-if="job?.status !== 'Completed'" 
                @click="updateStatus('Completed')" 
                class="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition shadow-sm"
              >
                  Mark Complete
              </button>
              <button 
                v-else
                @click="updateStatus('Scheduled')"
                class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition shadow-sm"
              >
                  Reopen
              </button>
          </div>
      </div>

      <!-- Body -->
      <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">Loading Job...</div>
      <div v-else class="flex-1 flex min-h-0">
          
          <!-- Left: Tasks & Info -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
              
              <!-- Description -->
              <div v-if="job.description" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 class="font-bold text-gray-900 mb-2">Instructions</h3>
                  <p class="text-gray-700 whitespace-pre-wrap">{{ job.description }}</p>
              </div>

              <!-- Tasks -->
              <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div class="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 class="font-bold text-slate-800 flex items-center gap-2">
                          <CheckCircle2 class="text-green-600" size="18" /> Checklist
                      </h3>
                      <div class="text-xs font-bold text-gray-500">{{ completedCount }} / {{ tasks.length }} Completed</div>
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
                              <p class="font-medium text-slate-900" :class="{'line-through text-gray-400': task.is_completed}">{{ task.title }}</p>
                          </div>
                      </div>
                      <div v-if="tasks.length === 0" class="p-8 text-center text-gray-400 italic">No tasks defined for this job.</div>
                  </div>
              </div>

              <!-- Job Photos -->
              <JobPhotos :jobId="jobId" />
          </div>

          <!-- Right: Comments & Activity -->
          <div class="w-96 border-l border-gray-200 bg-white flex flex-col">
              <JobComments :jobId="jobId" />
          </div>

      </div>
  </div>
</template>
