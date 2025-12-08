<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Clock, Calendar, CheckCircle2, AlertTriangle, Briefcase } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useDashboard } from '../composables/useDashboard'

const router = useRouter()
const loading = ref(true)
const horizon = ref({
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    future: []
})

const counts = ref({
    overdue: 0, today: 0, tomorrow: 0, this_week: 0, next_week: 0, future: 0
})

const columnConfig = [
    { id: 'overdue', label: 'Overdue', class: 'bg-red-50 border-red-100 text-red-700' },
    { id: 'today', label: 'Today', class: 'bg-blue-50 border-blue-100 text-blue-700' },
    { id: 'tomorrow', label: 'Tomorrow', class: 'bg-green-50 border-green-100 text-green-700' },
    { id: 'this_week', label: 'This Week', class: 'bg-gray-50 border-gray-100 text-gray-700' },
    { id: 'next_week', label: 'Next Week', class: 'bg-gray-50 border-gray-100 text-gray-700' },
    { id: 'future', label: 'Future', class: 'bg-gray-50 border-gray-100 text-gray-700' }
]

const { userProfile } = useAuth()
const { fetchHorizon, getTypeColor, formatTime } = useDashboard()

const fetchDashboard = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return

    loading.value = true
    
    const result = await fetchHorizon()
    if (result.success) {
        horizon.value = result.horizon
        counts.value = result.counts
    }
    
    loading.value = false
}

watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchDashboard()
}, { immediate: true })
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50 overflow-hidden">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Horizon Board</h1>
        <p class="text-gray-500 text-sm">Overview of upcoming work</p>
      </div>
      <button @click="fetchDashboard" class="text-sm text-blue-600 font-bold hover:underline">Refresh</button>
    </div>

    <!-- Board -->
    <div class="flex-1 overflow-x-auto pb-4">
        <div class="flex gap-4 h-full w-max min-w-full">
            
            <div v-for="bucket in columnConfig" :key="bucket.id" class="w-80 bg-slate-50 rounded-xl border border-gray-200 flex flex-col h-full flex-shrink-0">
                <!-- Column Header -->
                <div class="p-3 border-b border-gray-200 rounded-t-xl font-bold text-xs uppercase flex justify-between items-center flex-shrink-0" :class="bucket.class">
                    {{ bucket.label }}
                    <span class="bg-white/50 px-2 py-0.5 rounded text-[10px] min-w-[20px] text-center">{{ counts[bucket.id] }}</span>
                </div>

                <!-- Column Body -->
                <div class="p-3 space-y-3 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                    <div v-if="loading" class="text-center py-4 text-gray-400 text-xs">Loading...</div>
                    <div v-else-if="horizon[bucket.id].length === 0" class="text-center py-8 text-gray-300 text-xs italic">No jobs</div>
                    
                    <div 
                v-for="job in horizon[bucket.id]" 
                :key="job.id" 
                class="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer group"
                @click="router.push(`/jobs/${job.id}`)"
             >
                        
                        <div class="flex justify-between items-start mb-2">
                             <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" :class="getTypeColor(job.type)">{{ job.type }}</span>
                             
                             <div class="text-xs text-gray-500 flex items-center" v-if="job.scheduled_at">
                                 <Clock class="w-3 h-3 mr-1" /> {{ formatTime(job.scheduled_at) }}
                             </div>
                             <div class="text-xs text-orange-400 flex items-center font-bold" v-else title="Using Due Date">
                                 <Calendar class="w-3 h-3 mr-1" /> Due
                             </div>
                        </div>

                        <h4 class="font-bold text-slate-800 text-sm mb-0.5 leading-tight truncate" :title="job.property_name">{{ job.property_name }}</h4>
                        <p class="text-xs text-gray-500 mb-3 truncate">{{ job.service_name || 'Ad-hoc Job' }}</p>

                        <div class="flex justify-between items-center pt-2 border-t border-gray-50">
                            <!-- Avatar Placeholder -->
                            <div class="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-400">?</div>
                            
                            <span class="text-[10px] font-bold uppercase text-slate-400 group-hover:text-blue-600 transition">{{ job.status }}</span>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for columns */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}
</style>
