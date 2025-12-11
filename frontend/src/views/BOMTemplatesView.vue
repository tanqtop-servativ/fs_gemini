<script setup>
import { ref, onMounted, watch } from 'vue'
import { useBOMTemplates } from '../composables/useBOMTemplates'
import { Plus, Eye } from 'lucide-vue-next'
import BOMTemplateFormModal from '../components/bom/BOMTemplateFormModal.vue'
import BOMTemplateDetailModal from '../components/bom/BOMTemplateDetailModal.vue'

const templates = ref([])
const loading = ref(true)
const showArchived = ref(false)

// Modals
const showForm = ref(false)
const showDetail = ref(false)
const selectedTemplate = ref(null)

import { useAuth } from '../composables/useAuth'

const { userProfile } = useAuth()
const { listTemplates } = useBOMTemplates()

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 

    loading.value = true

    const result = await listTemplates(showArchived.value)
    if (result.success) {
        templates.value = result.templates
    }
    
    loading.value = false
}

watch(showArchived, fetchData)
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
        <h1 class="text-2xl font-bold text-slate-900">BOM Templates</h1>
        <p class="text-gray-500 text-sm">Standard inventory lists & kits</p>
      </div>
      
      <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-sm text-gray-600 font-bold cursor-pointer select-none">
              <input type="checkbox" v-model="showArchived" class="rounded border-gray-300 text-black focus:ring-0">
              Show Archived
          </label>
          <button 
            @click="openNew"
            class="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-800 transition shadow-sm"
          >
            <Plus class="w-4 h-4 mr-2" />
            New Template
          </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Template Name</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Description</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="3" class="px-6 py-8 text-center text-gray-400">Loading templates...</td>
           </tr>
           <tr v-else-if="templates.length === 0">
             <td colspan="3" class="px-6 py-8 text-center text-gray-400">No templates found.</td>
           </tr>

           <tr v-for="t in templates" :key="t.id" class="group hover:bg-slate-50 transition-colors cursor-pointer" :class="{'opacity-60 bg-gray-50': t.deleted_at}" @click="openDetail(t)">
             <!-- Name -->
             <td class="px-6 py-4">
                 <div class="font-bold text-slate-900 flex items-center gap-2">
                     <span :class="{'line-through text-gray-500': t.deleted_at}">{{ t.name }}</span>
                     <span v-if="t.deleted_at" class="text-[10px] bg-red-100 text-red-600 px-1 rounded uppercase font-bold no-underline decoration-0">Archived</span>
                 </div>
             </td>
             <!-- Description -->
             <td class="px-6 py-4 max-w-sm">
                 <div class="text-sm text-slate-600 truncate">{{ t.description || '-' }}</div>
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

    <BOMTemplateDetailModal 
        :is-open="showDetail" 
        :template="selectedTemplate" 
        @close="showDetail = false" 
        @edit="openEdit"
        @refresh="handleSaved"
    />
    <BOMTemplateFormModal 
        :is-open="showForm" 
        :template="selectedTemplate" 
        @close="showForm = false" 
        @saved="handleSaved" 
    />

  </div>
</template>
