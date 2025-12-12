<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useBOMTemplates } from '../composables/useBOMTemplates'
import { Plus, Eye, GripVertical } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import BOMTemplateFormModal from '../components/bom/BOMTemplateFormModal.vue'
import BOMTemplateDetailModal from '../components/bom/BOMTemplateDetailModal.vue'
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
const { listTemplates, reorderTemplates } = useBOMTemplates()

// Table controls
const { 
    sortKey, sortDir, searchQuery, 
    processedItems, toggleSort, resetControls, hasActiveControls 
} = useTableControls(templates, {
    defaultSortKey: null,
    defaultSortDir: 'asc',
    searchableFields: ['name', 'description']
})

const canDrag = computed(() => {
    return !searchQuery.value && !showArchived.value && (!sortKey.value || sortKey.value === 'sort_order')
})

const dragList = computed({
    get: () => processedItems.value,
    set: (newVal) => {
        templates.value = newVal
    }
})

const handleDragEnd = async () => {
    const ids = templates.value.map(t => t.id)
    await reorderTemplates(ids)
}

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 

    loading.value = true

    const result = await listTemplates(showArchived.value)
    if (result.success) {
        // Since list_bom_templates RPC might not sort by sort_order, we might need to sort here initially
        // But for now trust backend or sort client side if needed.
        // Actually, if I didn't update RPC, it order by name (or random).
        // I should probably client-side sort by sort_order if present, or 0.
        // But `processedItems` will sort by `defaultSortKey` (null) which means no sort.
        // If data comes back random, it will display random.
        // I should probably manually sort `templates.value` by `sort_order`.
        let data = result.templates || []
        data.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0))
        templates.value = data
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
          <TableSearch 
              v-model="searchQuery" 
              :has-active-controls="hasActiveControls"
              @reset="resetControls"
              placeholder="Search BOMs..."
          />
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
            <th class="w-8 px-0 pl-4 py-4"></th> <!-- Drag Handle -->
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="name" :sort-dir="sortDir" @sort="toggleSort">Template Name</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="description" :sort-dir="sortDir" @sort="toggleSort">Description</SortableHeader>
            </th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <draggable 
            v-model="dragList" 
            tag="tbody" 
            item-key="id"
            handle=".drag-handle"
            :disabled="!canDrag"
            class="divide-y divide-gray-100"
            @end="handleDragEnd"
        >
          <template #item="{ element: t }">
            <tr class="group hover:bg-slate-50 transition-colors cursor-pointer" :class="{'opacity-60 bg-gray-50': t.deleted_at}" @click="openDetail(t)">
               <!-- Drag Handle -->
               <td class="pl-4 py-4 w-8 cursor-grab active:cursor-grabbing drag-handle text-gray-300 hover:text-gray-500" :class="{ 'opacity-0 pointer-events-none': !canDrag }">
                   <GripVertical size="16" />
               </td>
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
          </template>
        </draggable>

        <tbody v-if="processedItems.length === 0">
           <tr v-if="loading">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading templates...</td>
           </tr>
           <tr v-else>
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">No templates found.</td>
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
