<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { Plus, Eye, ArrowRight } from 'lucide-vue-next'
import ServiceOpportunityFormModal from '../components/services/ServiceOpportunityFormModal.vue'
import ServiceOpportunityDetailModal from '../components/services/ServiceOpportunityDetailModal.vue'
import { useAuth } from '../composables/useAuth'

const items = ref([])
const loading = ref(true)

// Modals
const showForm = ref(false)
const showDetail = ref(false)
const selectedItem = ref(null)

// Jobs Cache for Workflow viz
const jobsMap = ref({})

const { userProfile } = useAuth()

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 

    loading.value = true
    
    // Fetch Opps
    const { data: opps } = await supabase
        .from('service_opportunities')
        .select(`
            *,
            properties (name),
            service_templates (name)
        `)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
    
    items.value = opps || []

    // Fetch active jobs for visualization
    if (items.value.length > 0) {
        const ids = items.value.map(o => o.id).filter(id => !!id)
        if (ids.length > 0) {
            const { data: jobs } = await supabase
                .from('jobs')
                .select('id, service_opportunity_id, title, status')
                .in('service_opportunity_id', ids)

            // Group by Opp ID
            const map = {}
            if (jobs) {
                jobs.forEach(j => {
                    if (!map[j.service_opportunity_id]) map[j.service_opportunity_id] = []
                    map[j.service_opportunity_id].push(j)
                })
            }
            jobsMap.value = map
        }
    }

    loading.value = false
}

watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchData()
}, { immediate: true })

// Actions
const openNew = () => {
    selectedItem.value = null
    showForm.value = true
}

const openDetail = (item) => {
    selectedItem.value = item
    showDetail.value = true
}

const openEdit = (item) => {
    selectedItem.value = item
    showDetail.value = false
    showForm.value = true
}

const handleSaved = () => {
    fetchData()
}

const getWorkflowColor = (status) => {
    if (status === 'Complete') return 'bg-green-100 text-green-700'
    if (status === 'In Progress') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Service Opportunities</h1>
        <p class="text-gray-500 text-sm">Manage service requests & workflows</p>
      </div>
      
      <button 
        @click="openNew"
        class="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-800 transition shadow-sm"
      >
        <Plus class="w-4 h-4 mr-2" />
        New Opportunity
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Property</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Service</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Status</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Workflow Flow</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">Loading opportunities...</td>
           </tr>
           <tr v-else-if="items.length === 0">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">No opportunities found.</td>
           </tr>

           <tr v-for="item in items" :key="item.id" class="group hover:bg-slate-50 transition-colors cursor-pointer" @click="openDetail(item)">
             <!-- Property -->
             <td class="px-6 py-4">
                 <div class="font-bold text-slate-900">{{ item.properties?.name || 'Unknown' }}</div>
                 <div class="text-xs text-slate-500">{{ item.due_date ? 'Due ' + new Date(item.due_date).toLocaleDateString() : 'No Due Date' }}</div>
             </td>
             <!-- Service -->
             <td class="px-6 py-4">
                 <div class="text-sm text-slate-700 font-medium">{{ item.service_templates?.name || 'Ad-Hoc' }}</div>
                 <div class="text-xs text-gray-400">{{ item.trigger_source || 'Manual' }}</div>
             </td>
             <!-- Status -->
             <td class="px-6 py-4">
                 <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase" :class="getWorkflowColor(item.status)">
                     {{ item.status }}
                 </span>
             </td>
             <!-- Workflow Visualization -->
             <td class="px-6 py-4">
                 <div v-if="jobsMap[item.id] && jobsMap[item.id].length > 0" class="flex items-center gap-1 overflow-x-auto max-w-[200px] scrollbar-hide">
                     <div v-for="(job, idx) in jobsMap[item.id].sort((a,b)=>a.id-b.id)" :key="job.id" class="flex items-center">
                         <div class="px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap" :class="getWorkflowColor(job.status)">
                             {{ job.title }}
                         </div>
                         <ArrowRight v-if="idx < jobsMap[item.id].length - 1" class="mx-1 text-gray-300" size="10"/>
                     </div>
                 </div>
                 <span v-else class="text-xs text-gray-400 italic">No jobs</span>
             </td>
             <!-- Actions -->
             <td class="px-6 py-4 text-right" @click.stop>
                 <button @click="openDetail(item)" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition">
                     <Eye size="16" />
                 </button>
             </td>
           </tr>
        </tbody>
      </table>
    </div>

    <ServiceOpportunityDetailModal 
        :is-open="showDetail" 
        :opportunity="selectedItem" 
        @close="showDetail = false" 
        @edit="openEdit" 
        @refresh="handleSaved"
    />
    <ServiceOpportunityFormModal 
        :is-open="showForm" 
        :opportunity="selectedItem" 
        @close="showForm = false" 
        @saved="handleSaved" 
    />

  </div>
</template>
