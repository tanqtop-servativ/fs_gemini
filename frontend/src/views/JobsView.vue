<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { Eye, ArrowRight, ChevronDown, Check, Briefcase } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const router = useRouter()

const items = ref([])
const loading = ref(true)
const statusFilter = ref(['Pending', 'In Progress'])
const isFilterOpen = ref(false)
const uniqueId = Math.random().toString(36).substr(2, 9)

const allStatuses = ['Pending', 'In Progress', 'Complete', 'Cancelled']

const { userProfile } = useAuth()

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 
    
    loading.value = true
    
    let query = supabase
        .from('jobs')
        .select(`
            *,
            properties (name),
            service_opportunities (title, due_date)
        `)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
    
    if (statusFilter.value.length > 0) {
        query = query.in('status', statusFilter.value)
    }
    
    const { data } = await query.order('created_at', { ascending: false })
    
    items.value = data || []
    loading.value = false
}

watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchData()
}, { immediate: true })

watch(statusFilter, () => fetchData(), { deep: true })

const toggleStatus = (status) => {
    if (statusFilter.value.includes(status)) {
        statusFilter.value = statusFilter.value.filter(s => s !== status)
    } else {
        statusFilter.value = [...statusFilter.value, status]
    }
}

const handleGlobalClick = (e) => {
    const target = e.target
    if (!target.closest(`#filter-dropdown-${uniqueId}`)) {
        isFilterOpen.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', handleGlobalClick)
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick)
})

const goToJob = (job) => {
    router.push(`/jobs/${job.id}`)
}

const getStatusColor = (status) => {
    if (status === 'Complete') return 'bg-green-100 text-green-700'
    if (status === 'In Progress') return 'bg-blue-100 text-blue-700'
    if (status === 'Cancelled') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase class="text-slate-600" size="24" /> Jobs
        </h1>
        <p class="text-gray-500 text-sm">All jobs across service opportunities</p>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative" :id="'filter-dropdown-' + uniqueId">
            <button 
                @click="isFilterOpen = !isFilterOpen"
                class="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm hover:border-slate-400 transition"
            >
                <span class="text-gray-600">Status:</span>
                <span class="font-bold text-slate-800">
                    {{ statusFilter.length === allStatuses.length ? 'All' : statusFilter.length + ' selected' }}
                </span>
                <ChevronDown size="14" class="text-gray-400" />
            </button>

            <!-- Dropdown Panel -->
            <div v-if="isFilterOpen" class="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-100">
                <div class="space-y-1">
                    <label v-for="status in allStatuses" :key="status" class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer select-none">
                        <div 
                            class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                            :class="statusFilter.includes(status) ? 'bg-slate-900 border-slate-900' : 'border-gray-300 bg-white'"
                        >
                            <Check v-if="statusFilter.includes(status)" size="10" class="text-white" stroke-width="3" />
                        </div>
                        <input type="checkbox" class="hidden" :checked="statusFilter.includes(status)" @change="toggleStatus(status)">
                        <span class="text-sm font-medium text-slate-700">{{ status }}</span>
                    </label>
                </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Job</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Property</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Service Opportunity</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Status</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">Loading jobs...</td>
           </tr>
           <tr v-else-if="items.length === 0">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">No jobs found.</td>
           </tr>

           <tr v-for="item in items" :key="item.id" 
                class="group hover:bg-slate-50 transition-colors cursor-pointer" 
                @click="goToJob(item)"
            >
             <!-- Job Title -->
             <td class="px-6 py-4">
                 <div class="font-bold text-slate-900">{{ item.title }}</div>
                 <div class="text-xs text-slate-500">{{ item.readable_id || item.id.slice(0, 8) }}</div>
             </td>
             <!-- Property -->
             <td class="px-6 py-4">
                 <div class="text-sm text-slate-700 font-medium">{{ item.properties?.name || 'Unknown' }}</div>
             </td>
             <!-- Service Opportunity -->
             <td class="px-6 py-4">
                 <div class="text-sm text-slate-600">{{ item.service_opportunities?.title || '—' }}</div>
                 <div v-if="item.service_opportunities?.due_date" class="text-xs text-gray-400">
                     Due {{ new Date(item.service_opportunities.due_date).toLocaleDateString() }}
                 </div>
             </td>
             <!-- Status -->
             <td class="px-6 py-4">
                 <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase" :class="getStatusColor(item.status)">
                     {{ item.status }}
                 </span>
             </td>
             <!-- Actions -->
              <td class="px-6 py-4" @click.stop>
                  <div class="flex items-center justify-end gap-2">
                    <button @click="goToJob(item)" aria-label="View Details" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="View Details">
                        <Eye size="16" />
                    </button>
                  </div>
              </td>
           </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
