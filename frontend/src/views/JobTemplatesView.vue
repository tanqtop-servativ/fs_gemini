<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { Plus, Eye, ListChecks, Wrench } from 'lucide-vue-next'
import JobTemplateFormModal from '../components/jobs/JobTemplateFormModal.vue'
import JobTemplateDetailModal from '../components/jobs/JobTemplateDetailModal.vue'
import SortableHeader from '../components/SortableHeader.vue'
import TableSearch from '../components/TableSearch.vue'
import { useAuth } from '../composables/useAuth'
import { useTableControls } from '../composables/useTableControls'

const templates = ref([])
const loading = ref(true)
const showArchived = ref(false)

// Modals
const showForm = ref(false)
const showDetail = ref(false)
const selectedTemplate = ref(null)

const { userProfile } = useAuth()

// Table controls
const { 
    sortKey, sortDir, searchQuery, 
    processedItems, toggleSort, resetControls, hasActiveControls 
} = useTableControls(templates, {
    defaultSortKey: 'name',
    defaultSortDir: 'asc',
    searchableFields: ['name', 'name_es', 'description']
})

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return

    loading.value = true

    let query = supabase
        .from('job_templates')
        .select('*, job_template_tasks(*, job_template_checklist_items(*))')
        .order('name')
    
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (!showArchived.value) query = query.is('deleted_at', null)

    const { data } = await query
    templates.value = data || []
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
    // Re-open detail if we were editing? Or close. Close is safe.
    // If we want to reopen detail of the specific item, we need its new ID/Fetch. 
    // Just refresh list for now.
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Job Templates</h1>
        <p class="text-gray-500 text-sm">Manage standard job workflows & checklists</p>
      </div>
      
      <div class="flex items-center gap-4">
        <TableSearch 
            v-model="searchQuery" 
            :has-active-controls="hasActiveControls"
            @reset="resetControls"
            placeholder="Search templates..."
        />
        
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
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
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="name" :sort-dir="sortDir" @sort="toggleSort">Template Name</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="description" :sort-dir="sortDir" @sort="toggleSort">Description</SortableHeader>
            </th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Tasks</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading templates...</td>
           </tr>
           <tr v-else-if="processedItems.length === 0">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">No templates found. Create one to get started.</td>
           </tr>

           <tr v-for="t in processedItems" :key="t.id" class="group hover:bg-slate-50 transition-colors cursor-pointer" @click="openDetail(t)">
             <!-- Name -->
             <td class="px-6 py-4">
                 <div class="font-bold text-slate-900 flex items-center gap-2" :class="{ 'line-through text-gray-500': t.deleted_at }">
                     <Wrench size="16" class="text-blue-500" />
                     {{ t.name }}
                     <span v-if="t.deleted_at" class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase no-underline">Archived</span>
                 </div>
                 <div class="text-xs text-blue-500 font-medium" v-if="t.name_es">{{ t.name_es }}</div>
             </td>
             <!-- Description -->
             <td class="px-6 py-4 max-w-xs">
                 <div class="text-sm text-slate-600 truncate">{{ t.description || '-' }}</div>
             </td>
             <!-- Tasks -->
             <td class="px-6 py-4">
                 <span class="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-bold flex items-center w-fit">
                     <ListChecks size="12" class="mr-1"/>
                     {{ t.job_template_tasks ? t.job_template_tasks.length : 0 }} Tasks
                 </span>
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

    <JobTemplateDetailModal :is-open="showDetail" :template="selectedTemplate" @close="showDetail = false" @edit="openEdit" />
    <JobTemplateFormModal :is-open="showForm" :template="selectedTemplate" @close="showForm = false" @saved="handleSaved" />

  </div>
</template>
