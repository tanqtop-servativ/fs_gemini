<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { Users, Clock, Car, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-vue-next'

const props = defineProps({
    jobId: { type: String, required: true }
})

const workers = ref([])
const loading = ref(true)
const expanded = ref(true)

const fetchAssignments = async () => {
    loading.value = true
    
    const { data, error } = await supabase
        .from('job_assignments')
        .select(`
            id,
            person_id,
            created_at,
            people (
                id,
                first_name,
                last_name,
                email
            )
        `)
        .eq('job_id', props.jobId)
    
    if (error) {
        console.error('Error fetching assignments:', error)
    } else {
        // Enrich with visit data if available
        workers.value = (data || []).map(a => ({
            ...a,
            name: `${a.people?.first_name || ''} ${a.people?.last_name || ''}`.trim() || 'Unknown',
            status: 'Accepted', // Placeholder - would come from visits
            travelTime: null,
            timeOnJob: null
        }))
    }
    
    loading.value = false
}

const getStatusIcon = (status) => {
    switch (status) {
        case 'Accepted': return CheckCircle2
        case 'Pending': return Clock
        case 'On Site': return Car
        default: return AlertCircle
    }
}

const getStatusColor = (status) => {
    switch (status) {
        case 'Accepted': return 'text-green-600'
        case 'Pending': return 'text-amber-500'
        case 'On Site': return 'text-blue-600'
        default: return 'text-gray-500'
    }
}

const formatDuration = (minutes) => {
    if (!minutes) return '—'
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

onMounted(fetchAssignments)
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <!-- Header -->
      <button 
        @click="expanded = !expanded"
        class="w-full px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center hover:bg-gray-100 transition"
      >
          <h3 class="font-bold text-slate-800 flex items-center gap-2 text-sm">
              <Users size="16" class="text-slate-500" />
              Field Tech Status
          </h3>
          <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">{{ workers.length }} assigned</span>
              <ChevronDown v-if="!expanded" size="16" class="text-gray-400" />
              <ChevronUp v-else size="16" class="text-gray-400" />
          </div>
      </button>

      <!-- Content -->
      <div v-if="expanded">
          <div v-if="loading" class="p-4 text-center text-gray-400 text-sm">
              Loading...
          </div>
          
          <div v-else-if="workers.length === 0" class="p-4 text-center text-gray-400 text-sm italic">
              No workers assigned to this job
          </div>

          <div v-else>
              <!-- Table Header -->
              <div class="grid grid-cols-4 gap-2 px-4 py-2 bg-slate-50 text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                  <div>Employee Name</div>
                  <div>Status</div>
                  <div>Travel Time</div>
                  <div>Time on Job</div>
              </div>

              <!-- Worker Rows -->
              <div class="divide-y divide-gray-100">
                  <div 
                    v-for="worker in workers" 
                    :key="worker.id"
                    class="grid grid-cols-4 gap-2 px-4 py-3 hover:bg-slate-50 transition items-center"
                  >
                      <div class="font-medium text-slate-800 text-sm truncate">
                          {{ worker.name }}
                      </div>
                      <div class="flex items-center gap-1.5">
                          <component 
                            :is="getStatusIcon(worker.status)" 
                            size="14" 
                            :class="getStatusColor(worker.status)" 
                          />
                          <span class="text-xs" :class="getStatusColor(worker.status)">
                              {{ worker.status }}
                          </span>
                      </div>
                      <div class="text-sm text-gray-600">
                          {{ formatDuration(worker.travelTime) }}
                      </div>
                      <div class="text-sm text-gray-600">
                          {{ formatDuration(worker.timeOnJob) }}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  </div>
</template>
