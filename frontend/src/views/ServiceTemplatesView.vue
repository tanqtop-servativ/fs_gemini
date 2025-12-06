<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { Plus, Eye, GitMerge } from 'lucide-vue-next'
import ServiceTemplateFormModal from '../components/services/ServiceTemplateFormModal.vue'
import ServiceTemplateDetailModal from '../components/services/ServiceTemplateDetailModal.vue'

const templates = ref([])
const loading = ref(true)

// Modals
const showForm = ref(false)
const showDetail = ref(false)
const selectedTemplate = ref(null)

import { useAuth } from '../composables/useAuth'

// ...
const { userProfile } = useAuth()

const fetchData = async () => {
    // If profile not ready, skip. Watcher will re-trigger.
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 

    loading.value = true
    const { data } = await supabase
        .from('service_templates')
        .select('*, service_workflow_steps(*, job_templates(name))')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name')

    templates.value = data || []
    loading.value = false
}

// Watch userProfile for changes (initial load or auth change)
watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchData()
}, { immediate: true })

// Actions
const openNew = () => {
    selectedTemplate.value = null
    showForm.value = true
}

const openDetail = (t) => {
    selectedTemplate.value = t
    showDetail.value = true
}

const openEdit = (t) => {
    selectedTemplate.value = t
    showDetail.value = false
    showForm.value = true
}

const handleSaved = () => {
    fetchData()
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Service Templates</h1>
        <p class="text-gray-500 text-sm">Define standard service workflows (e.g. Turnaround, Warranty)</p>
      </div>
      
      <button 
        @click="openNew"
        class="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-800 transition shadow-sm"
      >
        <Plus class="w-4 h-4 mr-2" />
        New Service
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Service Name</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Description</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Workflow Steps</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading services...</td>
           </tr>
           <tr v-else-if="templates.length === 0">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">No services defined. Create one to get started.</td>
           </tr>

           <tr v-for="t in templates" :key="t.id" class="group hover:bg-slate-50 transition-colors cursor-pointer" @click="openDetail(t)">
             <!-- Name -->
             <td class="px-6 py-4">
                 <div class="font-bold text-slate-900">{{ t.name }}</div>
             </td>
             <!-- Description -->
             <td class="px-6 py-4 max-w-xs">
                 <div class="text-sm text-slate-600 truncate">{{ t.description || '-' }}</div>
             </td>
             <!-- Steps -->
             <td class="px-6 py-4">
                 <div class="flex flex-col gap-1" v-if="t.service_workflow_steps && t.service_workflow_steps.length">
                     <span class="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold w-fit flex items-center mb-1">
                         <GitMerge size="10" class="mr-1"/>
                         {{ t.service_workflow_steps.length }} Steps
                     </span>
                     <div class="text-[10px] text-gray-400 truncate max-w-[200px]">
                         {{ 
                            t.service_workflow_steps
                            .sort((a,b)=>a.sort_order-b.sort_order)
                            .map(s => s.job_templates?.name || '?')
                            .slice(0, 3)
                            .join(' → ') 
                         }}
                         {{ t.service_workflow_steps.length > 3 ? '...' : '' }}
                     </div>
                 </div>
                 <span v-else class="text-gray-400 text-xs italic">No steps</span>
             </td>
             <!-- Actions -->
             <td class="px-6 py-4 text-right" @click.stop>
                 <button @click="openDetail(t)" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition">
                     <Eye size="16" />
                 </button>
             </td>
           </tr>
        </tbody>
      </table>
    </div>

    <ServiceTemplateDetailModal 
        :is-open="showDetail" 
        :template="selectedTemplate" 
        @close="showDetail = false" 
        @edit="openEdit"
        @refresh="handleSaved"
    />
    <ServiceTemplateFormModal 
        :is-open="showForm" 
        :template="selectedTemplate" 
        @close="showForm = false" 
        @saved="handleSaved" 
    />

  </div>
</template>
