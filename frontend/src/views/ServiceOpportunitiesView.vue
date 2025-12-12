<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Plus, Eye, ArrowRight, ChevronDown, Check, Clock, Ban, Moon } from 'lucide-vue-next'
import ServiceOpportunityFormModal from '../components/services/ServiceOpportunityFormModal.vue'
import ServiceOpportunityDetailModal from '../components/services/ServiceOpportunityDetailModal.vue'
import ContextMenu from '../components/ContextMenu.vue'
import SortableHeader from '../components/SortableHeader.vue'
import TableSearch from '../components/TableSearch.vue'
import { useAuth } from '../composables/useAuth'
import { useServiceOpportunities } from '../composables/useServiceOpportunities'
import { useTableControls } from '../composables/useTableControls'
import { perfLog } from '../lib/perfLog'
import { useDebugLifecycle } from '../composables/useDebugLifecycle'

useDebugLifecycle('ServiceOpportunitiesView')

const router = useRouter()
const route = useRoute()

const items = ref([])
const loading = ref(true)
const autoRefresh = ref(null)
const snoozedCount = ref(0)
// Initialize from localStorage or default
const savedFilter = localStorage.getItem('service_opps_filter')
const statusFilter = ref(savedFilter ? JSON.parse(savedFilter) : ['Open', 'In Progress'])
const isFilterOpen = ref(false)
const uniqueId = Math.random().toString(36).substr(2, 9)

const allStatuses = ['Open', 'In Progress', 'Snoozed', 'Captured', 'Dismissed']

// Modals
const showForm = ref(false)

const showDetail = ref(false)
const selectedItem = ref(null)
const detailModalAction = ref(null)

// Jobs Cache for Workflow viz
const jobsMap = ref({})

// Context Menu
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuOptions = ref([])

const { userProfile } = useAuth()
const { 
    fetchOpportunities, 
    fetchSnoozedCount: fetchSnoozedCountApi,
    getWorkflowColor,
    dismissOpportunity, 
    unsnoozeOpportunity, 
    undismissOpportunity 
} = useServiceOpportunities()

// Table controls
const { 
    sortKey, sortDir, searchQuery, 
    processedItems, toggleSort: toggleTableSort, resetControls, hasActiveControls 
} = useTableControls(items, {
    defaultSortKey: 'properties.name',
    defaultSortDir: 'asc',
    searchableFields: ['properties.name', 'service_templates.name', 'status', 'trigger_source']
})

const fetchData = async (isBackground = false) => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 
    
    if (!isBackground) loading.value = true
    
    // Use composable to fetch opportunities
    // Limit to 100 to prevent UI freezes with large datasets
    const limit = 100
    const result = await fetchOpportunities({ statusFilter: statusFilter.value, limit })
    if (result.success) {
        items.value = result.opportunities
        jobsMap.value = result.jobsMap
        checkRouteParam()
    }

    // Fetch Snoozed Count
    const countResult = await fetchSnoozedCountApi()
    if (countResult.success) {
        snoozedCount.value = countResult.count
    }

    if (!isBackground) loading.value = false
}

// Check if we need to open a specific item from URL
const checkRouteParam = () => {
    const id = route.query.id
    if (id && items.value.length > 0) {
        const item = items.value.find(i => i.id === id)
        if (item) {
            openDetail(item)
        }
    }
}

watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchData()
}, { immediate: true })

watch(() => route.query.id, () => {
    checkRouteParam()
})

watch(statusFilter, (newVal) => {
    localStorage.setItem('service_opps_filter', JSON.stringify(newVal))
    fetchData()
}, { deep: true })

const toggleStatus = (status) => {
    if (statusFilter.value.includes(status)) {
        statusFilter.value = statusFilter.value.filter(s => s !== status)
    } else {
        statusFilter.value = [...statusFilter.value, status]
    }
}

const showSnoozedOnly = () => {
    statusFilter.value = ['Snoozed']
}

// Close filter when clicking outside
const handleGlobalClick = (e) => {
    const target = e.target
    if (!target.closest(`#filter-dropdown-${uniqueId}`)) {
        isFilterOpen.value = false
    }
}

onMounted(() => {
    perfLog.mount('ServiceOpportunitiesView')
    perfLog.addListener('ServiceOpportunitiesView', 'click')
    document.addEventListener('click', handleGlobalClick)

    // Setup Polling
    // Setup Polling
    // autoRefresh.value = setInterval(() => fetchData(true), 30000)
    // perfLog.startInterval(autoRefresh.value, 'ServiceOpportunitiesView', 30000)
})

onUnmounted(() => {
    perfLog.unmount('ServiceOpportunitiesView')
    perfLog.removeListener('ServiceOpportunitiesView', 'click')
    document.removeEventListener('click', handleGlobalClick)
    if (autoRefresh.value) {
        perfLog.stopInterval(autoRefresh.value, 'ServiceOpportunitiesView')
        clearInterval(autoRefresh.value)
    }
})

// Actions
const openNew = () => {
    selectedItem.value = null
    showForm.value = true
}

const openDetail = (item, action = null) => {
    selectedItem.value = item
    detailModalAction.value = action
    showDetail.value = true
}

const openEdit = (item) => {
    selectedItem.value = item
    showDetail.value = false
    showForm.value = true
}

const handleSaved = async (payload) => {
    await fetchData()
    
    // If this was a new opportunity, open the detail modal
    if (payload?.isNew && payload?.id) {
        // Find the newly created item
        const newItem = items.value.find(i => i.id === payload.id)
        if (newItem) {
            openDetail(newItem)
        }
    }
}

// Context Menu Handler
const handleContextMenu = (e, item) => {
    e.preventDefault()
    
    selectedItem.value = item
    contextMenuX.value = e.clientX
    contextMenuY.value = e.clientY
    
    contextMenuOptions.value = [
        {
            label: 'View Details',
            icon: Eye,
            action: () => openDetail(item)
        },
        item.status === 'Snoozed' ? {
            label: 'Unsnooze',
            icon: Clock,
            class: 'text-emerald-600',
            action: async () => {
                const { success, error } = await unsnoozeOpportunity(item.id)
                if (success) fetchData()
                else alert(error)
            }
        } : {
            label: 'Snooze',
            icon: Clock,
            class: 'text-amber-600',
            action: () => {
                openDetail(item, 'snooze')
            }
        },
        item.status === 'Dismissed' ? {
            label: 'Undismiss',
            icon: Ban,
            class: 'text-emerald-600',
            action: async () => {
                const { success, error } = await undismissOpportunity(item.id)
                if (success) fetchData()
                else alert(error)
            }
        } : {
            label: 'Dismiss',
            icon: Ban,
            class: 'text-red-600',
            action: async () => {
                const reason = prompt("Why is this being dismissed?")
                if (!reason) return
                
                const { success, error } = await dismissOpportunity(item.id, reason)
                if (success) fetchData()
                else alert(error)
            }
        }
    ]
    
    showContextMenu.value = true
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Service Opportunities</h1>
        <p class="text-gray-500 text-sm">Manage service requests & workflows</p>
        <p 
            v-if="snoozedCount > 0" 
            @click="showSnoozedOnly"
            class="text-xs font-bold text-amber-600 mt-1 cursor-pointer hover:underline flex items-center gap-1"
        >
            <Clock size="12" /> Snoozed ({{ snoozedCount }})
        </p>
        <p class="text-xs text-slate-400 mt-1" v-if="items.length > 0">
            Showing {{ items.length }} recent items
        </p>
    </div>
      
      <div class="flex items-center gap-4">
        <TableSearch 
            v-model="searchQuery" 
            :has-active-controls="hasActiveControls"
            @reset="resetControls"
            placeholder="Search opportunities..."
        />
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
        
        <button 
          @click="openNew"
          class="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-800 transition shadow-sm"
        >
          <Plus class="w-4 h-4 mr-2" />
          New Opportunity
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="properties.name" :sort-dir="sortDir" @sort="toggleTableSort">Property</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="service_templates.name" :sort-dir="sortDir" @sort="toggleTableSort">Service</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="status" :sort-dir="sortDir" @sort="toggleTableSort">Status</SortableHeader>
            </th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Workflows</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">Loading opportunities...</td>
           </tr>
           <tr v-else-if="processedItems.length === 0">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">No opportunities found.</td>
           </tr>

           <tr v-for="item in processedItems" :key="item.id" 
                class="group hover:bg-slate-50 transition-colors cursor-pointer select-none" 
                @click="openDetail(item)"
                @contextmenu.prevent.stop="handleContextMenu($event, item)"
            >
             <!-- Property -->
             <td class="px-6 py-4">
                 <div class="font-bold text-slate-900">{{ item.properties?.name || 'Unknown' }}</div>
             </td>
             <!-- Service -->
             <td class="px-6 py-4">
                 <div class="text-sm text-slate-700 font-medium">{{ item.service_templates?.name || 'Ad-Hoc' }}</div>
                 <div class="text-xs text-gray-400">{{ item.trigger_source || 'Manual' }}</div>
             </td>
             <!-- Status -->
             <td class="px-6 py-4">
                 <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase" :class="getWorkflowColor(item.status)">
                     <template v-if="item.status === 'Snoozed' && item.snooze_until">
                        SNOOZED UNTIL {{ new Date(item.snooze_until).toLocaleString() }}
                     </template>
                     <template v-else>
                        {{ item.status }}
                     </template>
                 </span>
             </td>
             <!-- Workflow Visualization -->
             <td class="px-6 py-4">
                 <div v-if="jobsMap[item.id] && jobsMap[item.id].length > 0" class="flex flex-wrap items-center gap-1">
                     <div v-for="(job, idx) in jobsMap[item.id].slice().sort((a,b)=>(a.sort_order || 0) - (b.sort_order || 0))" :key="job.id" class="flex items-center">
                         <div class="px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap" :class="getWorkflowColor(job.status)">
                             {{ job.title }}
                         </div>
                         <ArrowRight v-if="idx < jobsMap[item.id].length - 1" class="mx-1 text-black" size="14" stroke-width="2.5"/>
                     </div>
                 </div>
                 <span v-else class="text-xs text-gray-400 italic">No jobs</span>
             </td>
             <!-- Actions -->
              <td class="px-6 py-4" @click.stop>
                  <div class="flex items-center justify-end gap-2">
                    <button @click="openDetail(item, 'snooze')" aria-label="Snooze" class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition" title="Snooze">
                        <Moon size="16" />
                    </button>
                    <button @click="openDetail(item)" aria-label="View Details" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="View Details">
                        <Eye size="16" />
                    </button>
                  </div>
              </td>
           </tr>
        </tbody>
      </table>
    </div>

    <ServiceOpportunityDetailModal 
        :is-open="showDetail" 
        :opportunity="selectedItem" 
        :initial-action="detailModalAction"
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

    <ContextMenu 
        v-model="showContextMenu"
        :x="contextMenuX"
        :y="contextMenuY"
        :options="contextMenuOptions"
    />

  </div>
</template>
