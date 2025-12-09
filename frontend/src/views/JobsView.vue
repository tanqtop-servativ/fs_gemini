<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, ChevronDown, Check, Briefcase, Calendar, UserPlus, X, Trash2 } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useJobs } from '../composables/useJobs'
import { useTableControls } from '../composables/useTableControls'
import { useVisits } from '../composables/useVisits'
import { supabase } from '../lib/supabase'
import SortableHeader from '../components/SortableHeader.vue'
import TableSearch from '../components/TableSearch.vue'

const router = useRouter()

const items = ref([])
const loading = ref(true)
const statusFilter = ref(['Pending', 'In Progress'])
const isFilterOpen = ref(false)
const uniqueId = Math.random().toString(36).substr(2, 9)

const allStatuses = ['Pending', 'In Progress', 'Complete', 'Cancelled']

const { userProfile } = useAuth()
const { fetchJobs, getStatusColor } = useJobs()
const { createVisit } = useVisits()

// Context Menu State
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextJob = ref(null)

// Scheduling Modal
const showRescheduleModal = ref(false)
const rescheduleDate = ref('')

// Crew Assignment Modal
const showAssignModal = ref(false)
const availableWorkers = ref([])
const selectedWorker = ref('')

// Table controls
const { 
    sortKey, sortDir, searchQuery, 
    processedItems, toggleSort, resetControls, hasActiveControls 
} = useTableControls(items, {
    defaultSortKey: 'title',
    defaultSortDir: 'asc',
    searchableFields: ['title', 'properties.name', 'service_opportunities.title', 'status']
})

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 
    
    loading.value = true
    
    const result = await fetchJobs({ statusFilter: statusFilter.value })
    if (result.success) {
        items.value = result.jobs
    }
    
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

onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick)
})

const goToJob = (job) => {
    router.push(`/jobs/${job.id}`)
}

// Context Menu
const openContextMenu = (e, job) => {
    e.preventDefault()
    contextJob.value = job
    contextMenuX.value = e.clientX
    contextMenuY.value = e.clientY
    showContextMenu.value = true
}

const getContextMenuOptions = () => {
    const job = contextJob.value
    if (!job) return []
    
    return [
        {
            label: 'Reschedule',
            icon: Calendar,
            action: () => openReschedule()
        },
        {
            label: 'Unschedule',
            icon: X,
            action: () => unscheduleJob()
        },
        {
            label: 'Assign Crew',
            icon: UserPlus,
            action: () => openAssignModal()
        },
        {
            label: 'Delete',
            icon: Trash2,
            class: 'text-red-600 hover:bg-red-50',
            action: () => softDeleteJob()
        }
    ]
}

// Reschedule
const openReschedule = () => {
    showContextMenu.value = false
    // Default to tomorrow 9am
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    const offset = d.getTimezoneOffset() * 60000
    const localDate = new Date(d.getTime() - offset)
    rescheduleDate.value = localDate.toISOString().slice(0, 16)
    showRescheduleModal.value = true
}

const confirmReschedule = async () => {
    if (!rescheduleDate.value || !contextJob.value) return
    
    const result = await createVisit(contextJob.value.id, new Date(rescheduleDate.value).toISOString())
    
    if (!result.success) {
        alert('Error scheduling: ' + result.error)
    } else {
        showRescheduleModal.value = false
        rescheduleDate.value = ''
        await fetchData()
    }
}

// Unschedule
const unscheduleJob = async () => {
    showContextMenu.value = false
    if (!contextJob.value) return
    if (!confirm('Remove scheduling for this job? This will cancel all pending visits.')) return
    
    // Cancel all pending visits for this job
    const { error } = await supabase
        .from('visits')
        .update({ status: 'Cancelled' })
        .eq('job_id', contextJob.value.id)
        .in('status', ['Scheduled', 'Pending'])
    
    if (error) {
        alert('Error unscheduling: ' + error.message)
    } else {
        await fetchData()
    }
}

// Assign Crew
const openAssignModal = async () => {
    showContextMenu.value = false
    
    // Fetch available workers
    const tenantId = userProfile.value?.tenant_id
    const { data } = await supabase
        .from('people')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenantId)
        .order('first_name')
    
    availableWorkers.value = data || []
    selectedWorker.value = ''
    showAssignModal.value = true
}

const confirmAssignment = async () => {
    if (!selectedWorker.value || !contextJob.value) return
    
    // Create job assignment
    const { error } = await supabase
        .from('job_assignments')
        .insert({
            job_id: contextJob.value.id,
            person_id: selectedWorker.value
        })
    
    if (error) {
        alert('Error assigning: ' + error.message)
    } else {
        showAssignModal.value = false
        selectedWorker.value = ''
        await fetchData()
    }
}

// Soft Delete
const softDeleteJob = async () => {
    showContextMenu.value = false
    if (!contextJob.value) return
    if (!confirm(`Delete job "${contextJob.value.title}"? This can be undone.`)) return
    
    const { error } = await supabase
        .from('jobs')
        .update({ status: 'Cancelled', deleted_at: new Date().toISOString() })
        .eq('id', contextJob.value.id)
    
    if (error) {
        alert('Error deleting: ' + error.message)
    } else {
        await fetchData()
    }
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
        <!-- Search & Reset -->
        <TableSearch 
            v-model="searchQuery" 
            :has-active-controls="hasActiveControls"
            @reset="resetControls"
            placeholder="Search jobs..."
        />
        
        <!-- Status Filter -->
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
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="title" :sort-dir="sortDir" @sort="toggleSort">Job</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="properties.name" :sort-dir="sortDir" @sort="toggleSort">Property</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="service_opportunities.title" :sort-dir="sortDir" @sort="toggleSort">Service Opportunity</SortableHeader>
            </th>
            <th class="px-6 py-4">
                <SortableHeader :sort-key="sortKey" column="status" :sort-dir="sortDir" @sort="toggleSort">Status</SortableHeader>
            </th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">Loading jobs...</td>
           </tr>
           <tr v-else-if="processedItems.length === 0">
             <td colspan="5" class="px-6 py-8 text-center text-gray-400">No jobs found.</td>
           </tr>

           <tr v-for="item in processedItems" :key="item.id" 
                class="group hover:bg-slate-50 transition-colors cursor-pointer" 
                @click="goToJob(item)"
                @contextmenu="openContextMenu($event, item)"
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

    <!-- Context Menu -->
    <Teleport to="body">
      <div 
        v-if="showContextMenu" 
        class="fixed inset-0 z-50"
        @click="showContextMenu = false"
        @contextmenu.prevent="showContextMenu = false"
      >
        <div 
          class="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
          :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
          @click.stop
        >
          <div class="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 truncate max-w-[200px]">
            {{ contextJob?.title }}
          </div>
          <button 
            @click="openReschedule"
            class="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
          >
            <Calendar class="w-4 h-4" />
            Reschedule
          </button>
          <button 
            @click="unscheduleJob"
            class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <X class="w-4 h-4" />
            Unschedule
          </button>
          <button 
            @click="openAssignModal"
            class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <UserPlus class="w-4 h-4" />
            Assign Crew
          </button>
          <button 
            @click="softDeleteJob"
            class="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 class="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Reschedule Modal -->
    <Teleport to="body">
      <div v-if="showRescheduleModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]" @click.self="showRescheduleModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
          <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar size="20" class="text-blue-500" />
            Schedule Job
          </h3>
          <div class="mb-4">
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Date & Time</label>
            <input 
              type="datetime-local" 
              v-model="rescheduleDate"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button @click="showRescheduleModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
            <button @click="confirmReschedule" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Schedule</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Assign Crew Modal -->
    <Teleport to="body">
      <div v-if="showAssignModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]" @click.self="showAssignModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
          <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus size="20" class="text-blue-500" />
            Assign Crew
          </h3>
          <div class="mb-4">
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Select Worker</label>
            <select 
              v-model="selectedWorker"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a worker...</option>
              <option v-for="w in availableWorkers" :key="w.id" :value="w.id">
                {{ w.first_name }} {{ w.last_name }}
              </option>
            </select>
          </div>
          <div class="flex justify-end gap-2">
            <button @click="showAssignModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
            <button @click="confirmAssignment" :disabled="!selectedWorker" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Assign</button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
