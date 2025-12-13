<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light-border.css'
import { useAuth } from '../composables/useAuth'
import { useCalendar } from '../composables/useCalendar'
import { supabase } from '../lib/supabase'
import CalendarEventModal from '../components/calendar/CalendarEventModal.vue'
import ServiceOpportunityFormModal from '../components/services/ServiceOpportunityFormModal.vue'
import JobDetailModal from '../components/jobs/JobDetailModal.vue'
import { perfLog } from '../lib/perfLog'
import { UserPlus, X, Check } from 'lucide-vue-next'
import { useDebugLifecycle } from '../composables/useDebugLifecycle'

useDebugLifecycle('CalendarView')

// Refs for UI state
const route = useRoute()
const calendarRef = ref(null)
const selectedPropId = ref('all')
const selectedView = ref('multiMonthYear') // Matches value in dropdown option
const selectedMonths = ref(1)
const properties = ref([])

// Modal state
const showEventModal = ref(false)
const selectedEvent = ref(null)
const showServiceOpportunityModal = ref(false)
const newOpportunityDate = ref(null)
const showJobModal = ref(false)
const selectedJobId = ref(null)

// Context menu state
const router = useRouter()
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuEvent = ref(null)
const contextMenuDate = ref(null)

// Worker assignment state
const showAssignModal = ref(false)
const assignModalJob = ref(null)
const availableWorkers = ref([])
const currentAssignmentIds = ref([]) // person_ids already assigned
const selectedWorkerIds = ref([]) // checkbox selections
const requiredRoleIds = ref([])
const assignmentLoading = ref(false)
const assignmentSaving = ref(false)

const closeContextMenu = (e) => {
  // Don't close if clicking inside the assign modal
  if (showAssignModal.value) return
  
  showContextMenu.value = false
  contextMenuEvent.value = null
  contextMenuDate.value = null
}

// Close context menu on click outside
onMounted(() => {
  perfLog.mount('CalendarView')
  perfLog.addListener('CalendarView', 'click')
  document.addEventListener('click', closeContextMenu)
})
onUnmounted(() => {
  perfLog.unmount('CalendarView')
  perfLog.removeListener('CalendarView', 'click')
  document.removeEventListener('click', closeContextMenu)
})

// Zoom Control via CSS Transform
const zoomScale = ref(100) // Percentage: 70% to 130%
const MIN_ZOOM = 70
const MAX_ZOOM = 130
const ZOOM_STEP = 10

const zoomIn = () => { zoomScale.value = Math.min(zoomScale.value + ZOOM_STEP, MAX_ZOOM) }
const zoomOut = () => { zoomScale.value = Math.max(zoomScale.value - ZOOM_STEP, MIN_ZOOM) }

// Computed style for the calendar wrapper
const calendarWrapperStyle = computed(() => {
  const scale = zoomScale.value / 100
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${100 / scale}%`,
    height: `${100 / scale}%`
  }
})

// Helper to resolve view name based on selection
const resolveViewName = (view, months) => {
  if (view === 'multiMonthYear') {
    return 'multiMonth' + months
  }
  return view
}

// Watchers to update Calendar API
watch([selectedView, selectedMonths], ([view, months]) => {
  const calApi = calendarRef.value?.getApi()
  if (!calApi) return
  
  const target = resolveViewName(view, months)
  calApi.changeView(target)
})

watch(selectedPropId, (newVal) => {
  fetchEvents()
})

// FullCalendar Options
const calendarOptions = {
  plugins: [ dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin ],
  initialView: 'multiMonth1',
  headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
  height: '100%',
  fixedWeekCount: false,
  allDaySlot: true,
  slotMinTime: '06:00:00',
  slotMaxTime: '22:00:00',
  slotEventOverlap: false, // Place overlapping events side-by-side
  eventMinHeight: 45, // Ensure 15m events are tall enough for text
   views: {
    multiMonth1: { type: 'dayGridMonth', duration: { months: 1 }, showNonCurrentDates: true },
    multiMonth2: { type: 'multiMonthYear', duration: { months: 2 }, multiMonthMaxColumns: 2, showNonCurrentDates: false },
    multiMonth3: { type: 'multiMonthYear', duration: { months: 3 }, multiMonthMaxColumns: 3, showNonCurrentDates: false },
    multiMonth4: { type: 'multiMonthYear', duration: { months: 4 }, multiMonthMaxColumns: 2, showNonCurrentDates: false },
    multiMonth5: { type: 'multiMonthYear', duration: { months: 5 }, multiMonthMaxColumns: 3, showNonCurrentDates: false },
    multiMonth6: { type: 'multiMonthYear', duration: { months: 6 }, multiMonthMaxColumns: 3, showNonCurrentDates: false },
  },
  events: [], // Will be populated
  eventContent: (arg) => {
    const props = arg.event.extendedProps
    const isCompleted = arg.event.classNames?.includes('status-completed')
    // Bigger, bolder checkmark (increased to 1.3em), darker green
    const checkmark = isCompleted ? '<span style="color: #16a34a; margin-right: 4px; font-weight: 900; font-size: 1.3em;">✓</span>' : ''
    // Remove strikethrough, keep opacity
    const titleStyle = isCompleted ? 'opacity: 0.7;' : ''
    
    // Simplified content for MultiMonth view to avoid overflow (except for 1-month view which is now DayGrid/DayGridMonth)
    // Note: arg.view.type is the resolved type (e.g. 'dayGridMonth' or 'multiMonthYear')
    // Wait, in my config multiMonth1 IS dayGridMonth.
    // So if it's multiMonthYear (2-6), use simplified.
    if (arg.view.type === 'multiMonthYear') {
      return {
        html: `<div class="text-[10px] truncate px-1 rounded-sm leading-tight" style="color:${arg.event.textColor || '#fff'}; ${titleStyle}">${checkmark}${arg.event.title}</div>`
      }
    }
    
    // Detailed view (cols logic adapted)
    return {
      html: `
      <div class="px-1 py-px overflow-hidden h-full flex flex-col justify-center leading-none">
          <div class="font-bold text-[10px] truncate mb-px" style="${titleStyle}">${checkmark}${arg.event.title}</div>
          ${props.property_name ? `<div class="text-[9px] truncate opacity-90">${props.property_name}</div>` : ''}
      </div>`
    }
  },
  eventDidMount: (info) => {
    const props = info.event.extendedProps
    const fmt = (d) => d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
    const timeStr = `${fmt(info.event.start)} - ${fmt(info.event.end)}`
    
    // Create tippy instance and store reference for cleanup
    const tippyInstance = tippy(info.el, {
      content: `
        <div class="font-bold">${info.event.title}</div>
        <div class="text-xs text-gray-600 border-b border-gray-200 pb-1 mb-1">${timeStr}</div>
        <div class="text-xs">${props.property_name || ''}</div>
        <div class="text-[10px] text-gray-500">${props.property_address || ''}</div>
      `,
      allowHTML: true,
      theme: 'light-border'
    })
    
    // Store tippy instance on element for cleanup
    info.el._tippyInstance = tippyInstance
    
    // Create named handler for cleanup
    const contextMenuHandler = (e) => {
      e.preventDefault()
      contextMenuX.value = e.clientX
      contextMenuY.value = e.clientY
      contextMenuEvent.value = info.event
      contextMenuDate.value = null
      showContextMenu.value = true
    }
    
    // Store handler reference for removal
    info.el._contextMenuHandler = contextMenuHandler
    info.el.addEventListener('contextmenu', contextMenuHandler)
  },
  eventWillUnmount: (info) => {
    // Clean up tippy instance
    if (info.el._tippyInstance) {
      info.el._tippyInstance.destroy()
      delete info.el._tippyInstance
    }
    // Clean up context menu listener
    if (info.el._contextMenuHandler) {
      info.el.removeEventListener('contextmenu', info.el._contextMenuHandler)
      delete info.el._contextMenuHandler
    }
  },
  eventClick: (info) => {
    const eventType = info.event.extendedProps?.event_type
    const jobId = info.event.extendedProps?.job_id
    
    // For Job events, open job detail modal
    if (eventType === 'Job' && jobId) {
      selectedJobId.value = jobId
      showJobModal.value = true
      return
    }
    
    // For other events (Bookings), show the event modal
    selectedEvent.value = info.event
    showEventModal.value = true
  },
  dayCellDidMount: (info) => {
    // Create named handler for cleanup
    const dayCellContextMenuHandler = (e) => {
      // Only trigger if not clicking on an event
      if (e.target.closest('.fc-event')) return
      
      e.preventDefault()
      contextMenuX.value = e.clientX
      contextMenuY.value = e.clientY
      contextMenuEvent.value = null
      contextMenuDate.value = info.date.toISOString().split('T')[0]
      showContextMenu.value = true
    }
    
    // Store handler reference for removal
    info.el._dayCellContextMenuHandler = dayCellContextMenuHandler
    info.el.addEventListener('contextmenu', dayCellContextMenuHandler)
  },
  dayCellWillUnmount: (info) => {
    // Clean up day cell context menu listener
    if (info.el._dayCellContextMenuHandler) {
      info.el.removeEventListener('contextmenu', info.el._dayCellContextMenuHandler)
      delete info.el._dayCellContextMenuHandler
    }
  }
}

// Handle right-click on events
const handleEventRightClick = (e, event) => {
  e.preventDefault()
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuEvent.value = event
  contextMenuDate.value = null
  showContextMenu.value = true
}

// Handle right-click on date cells
const handleDateRightClick = (e, dateStr) => {
  e.preventDefault()
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuEvent.value = null
  contextMenuDate.value = dateStr
  showContextMenu.value = true
}

// Context menu actions
const viewEventDetails = () => {
  if (contextMenuEvent.value) {
    selectedEvent.value = contextMenuEvent.value
    showEventModal.value = true
  }
  closeContextMenu()
}

const copyEventToClipboard = () => {
  if (contextMenuEvent.value) {
    const e = contextMenuEvent.value
    const props = e.extendedProps || {}
    const text = `${e.title}\nDate: ${e.start?.toLocaleDateString()} - ${e.end?.toLocaleDateString()}\nProperty: ${props.property_name || ''}\nAddress: ${props.property_address || ''}`
    navigator.clipboard.writeText(text)
  }
  closeContextMenu()
}

const createServiceOpportunity = () => {
  // Open modal with pre-populated date
  newOpportunityDate.value = contextMenuDate.value || (contextMenuEvent.value?.start?.toISOString().split('T')[0])
  showServiceOpportunityModal.value = true
  closeContextMenu()
}

const handleOpportunitySaved = () => {
  showServiceOpportunityModal.value = false
  newOpportunityDate.value = null
  fetchEvents() // Refresh calendar
}

// Worker Assignment Functions
const openAssignWorkers = async () => {
  const jobId = contextMenuEvent.value?.extendedProps?.job_id
  if (!jobId) return
  
  // Save job ID before closing context menu
  const savedJobId = jobId
  closeContextMenu()
  assignmentLoading.value = true
  showAssignModal.value = true
  
  // Fetch job details via RPC
  const { data: jobData, error: jobError } = await supabase.rpc('get_job_detail', { p_job_id: savedJobId })
  
  if (jobError || !jobData) {
    console.error('Failed to fetch job:', jobError)
    showAssignModal.value = false
    assignmentLoading.value = false
    return
  }
  
  assignModalJob.value = jobData
  
  // Fetch job_template_id separately (not included in get_job_detail RPC)
  const { data: jobTemplateData } = await supabase.rpc('get_job_template_id', { p_job_id: savedJobId })
  const jobTemplateId = jobTemplateData
  
  // Fetch required roles for this job template
  if (jobTemplateId) {
    const { data: roles } = await supabase
      .from('job_template_roles')
      .select('role_id')
      .eq('job_template_id', jobTemplateId)
    
    requiredRoleIds.value = (roles || []).map(r => r.role_id)
    console.log('Required roles for job:', requiredRoleIds.value)
  } else {
    requiredRoleIds.value = []
    console.log('No job template, showing all workers')
  }
  
  // Fetch current assignments
  const { data: assignments } = await supabase
    .from('job_assignments')
    .select('person_id')
    .eq('job_id', savedJobId)
  
  currentAssignmentIds.value = (assignments || []).map(a => a.person_id)
  selectedWorkerIds.value = [...currentAssignmentIds.value]
  
  // Fetch available workers with their roles
  const { data: people } = await supabase
    .from('people')
    .select('id, first_name, last_name, person_roles(role_id, roles(name))')
    .is('deleted_at', null)
    .order('first_name')
  
  // Filter by required roles if any
  if (requiredRoleIds.value.length > 0) {
    availableWorkers.value = (people || []).filter(p => {
      const personRoleIds = (p.person_roles || []).map(pr => pr.role_id)
      return requiredRoleIds.value.some(reqId => personRoleIds.includes(reqId))
    })
  } else {
    availableWorkers.value = people || []
  }
  
  assignmentLoading.value = false
}

const toggleWorker = (personId) => {
  const idx = selectedWorkerIds.value.indexOf(personId)
  if (idx >= 0) {
    selectedWorkerIds.value.splice(idx, 1)
  } else {
    selectedWorkerIds.value.push(personId)
  }
}

const saveAssignments = async () => {
  if (!assignModalJob.value) return
  assignmentSaving.value = true
  
  const jobId = assignModalJob.value.id
  const toAdd = selectedWorkerIds.value.filter(id => !currentAssignmentIds.value.includes(id))
  const toRemove = currentAssignmentIds.value.filter(id => !selectedWorkerIds.value.includes(id))
  
  // Add new assignments
  for (const personId of toAdd) {
    await supabase.rpc('assign_person_to_job', {
      p_job_id: jobId,
      p_person_id: personId
    })
  }
  
  // Remove unchecked assignments
  for (const personId of toRemove) {
    await supabase
      .from('job_assignments')
      .delete()
      .eq('job_id', jobId)
      .eq('person_id', personId)
  }
  
  assignmentSaving.value = false
  showAssignModal.value = false
  assignModalJob.value = null
  selectedWorkerIds.value = []
  currentAssignmentIds.value = []
  availableWorkers.value = []
}

const closeAssignModal = () => {
  showAssignModal.value = false
  assignModalJob.value = null
  selectedWorkerIds.value = []
  currentAssignmentIds.value = []
  availableWorkers.value = []
}

const getWorkerRoles = (worker) => {
  return (worker.person_roles || []).map(pr => pr.roles?.name).filter(Boolean).join(', ')
}

const { userProfile } = useAuth()
const { fetchProperties: fetchPropertiesApi, fetchEvents: fetchEventsApi } = useCalendar()

// Data Fetching
const fetchPropertiesData = async () => {
    if (!userProfile.value?.tenant_id) return
    const result = await fetchPropertiesApi()
    if (result.success) {
        properties.value = result.properties
    }
}

const fetchEvents = async () => {
    if (!userProfile.value) return
    
    const calApi = calendarRef.value?.getApi()
    if (!calApi) return
    
    const result = await fetchEventsApi({ propertyId: selectedPropId.value })
    if (result.success) {
        calApi.removeAllEvents()
        calApi.addEventSource(result.events)
    }
}

watch(() => route.query.propertyId, (newId) => {
    selectedPropId.value = newId || 'all'
}, { immediate: true })

watch(userProfile, (newVal) => {
    if (newVal) {
        fetchPropertiesData()
        fetchEvents()
    }
}, { immediate: true })

onMounted(() => {
    if (userProfile.value) {
        fetchEvents() 
    }
})
const pageTitle = computed(() => {
    if (selectedPropId.value === 'all') return 'Work Calendar'
    const prop = properties.value.find(p => p.id === selectedPropId.value)
    return prop ? `Property Calendar: ${prop.name}` : 'Property Calendar'
})
</script>

<template>
  <div class="h-screen flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
      <h1 class="text-2xl font-bold text-slate-900">{{ pageTitle }}</h1>
      
      <div class="flex gap-2 items-center">
        <!-- Property Selector -->
        <select v-model="selectedPropId" class="border border-gray-300 rounded-lg p-2 text-sm bg-white min-w-[200px]">
          <option value="all">All Work</option>
          <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        
        <div class="border-l border-gray-300 h-6 mx-2"></div>
        
        <!-- View Selector -->
        <select v-model="selectedView" class="border border-gray-300 rounded-lg p-2 text-sm bg-white font-medium">
          <option value="multiMonthYear">Month View</option>
          <option value="timeGridWeek">Week</option>
          <option value="timeGridDay">Day (Timeline)</option>
          <option value="listWeek">List</option>
        </select>
        
        <!-- Month Count Selector (Visible only for month view) -->
        <select v-if="selectedView === 'multiMonthYear'" v-model="selectedMonths" class="border border-gray-300 rounded-lg p-2 text-sm bg-white font-medium" title="Number of months to show">
          <option :value="1">1 Month</option>
          <option :value="2">2 Months</option>
          <option :value="3">3 Months</option>
          <option :value="4">4 Months</option>
          <option :value="5">5 Months</option>
          <option :value="6">6 Months</option>
        </select>

        <div class="border-l border-gray-300 h-6 mx-2"></div>

        <!-- Zoom Control -->
        <div class="flex items-center gap-1" title="Zoom In/Out">
          <button @click="zoomOut" class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-600 font-bold text-sm" :disabled="zoomScale <= MIN_ZOOM">−</button>
          <span class="text-xs text-gray-500 w-10 text-center">{{ zoomScale }}%</span>
          <button @click="zoomIn" class="w-7 h-7 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-600 font-bold text-sm" :disabled="zoomScale >= MAX_ZOOM">+</button>
        </div>
      </div>
    </div>
    
    <!-- Calendar -->
    <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 overflow-auto">
      <div :style="calendarWrapperStyle" class="min-w-max">
        <FullCalendar ref="calendarRef" :options="calendarOptions" />
      </div>
    </div>

    <!-- Event Detail Modal -->
    <CalendarEventModal 
      :isOpen="showEventModal" 
      :event="selectedEvent" 
      @close="showEventModal = false" 
    />

    <!-- Service Opportunity Form Modal -->
    <ServiceOpportunityFormModal
      :isOpen="showServiceOpportunityModal"
      :defaultDate="newOpportunityDate"
      :defaultPropertyId="selectedPropId !== 'all' ? selectedPropId : null"
      @close="showServiceOpportunityModal = false; newOpportunityDate = null"
      @saved="handleOpportunitySaved"
    />

    <!-- Job Detail Modal -->
    <JobDetailModal
      :isOpen="showJobModal"
      :jobId="selectedJobId"
      @close="showJobModal = false; selectedJobId = null"
    />

    <!-- Context Menu -->
    <div 
      v-if="showContextMenu" 
      class="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      @click.stop
    >
      <template v-if="contextMenuEvent">
        <button @click="viewEventDetails" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
          📋 View Details
        </button>
        <button @click="copyEventToClipboard" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
          📄 Copy to Clipboard
        </button>
        <!-- Assign Workers (only for Job events) -->
        <button 
          v-if="contextMenuEvent.extendedProps?.event_type === 'Job' && contextMenuEvent.extendedProps?.job_id"
          @click="openAssignWorkers" 
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
        >
          👥 Assign Workers
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="createServiceOpportunity" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
          ➕ Create Service Opportunity
        </button>
      </template>
      <template v-else-if="contextMenuDate">
        <button @click="createServiceOpportunity" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
          ➕ Create Service Opportunity for {{ contextMenuDate }}
        </button>
      </template>
    </div>

    <!-- Worker Assignment Modal -->
    <div 
      v-if="showAssignModal" 
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="closeAssignModal"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <!-- Header -->
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
              <UserPlus size="18" class="text-blue-600" />
              Assign Workers
            </h3>
            <p v-if="assignModalJob" class="text-sm text-gray-500 mt-0.5">{{ assignModalJob.title }}</p>
          </div>
          <button @click="closeAssignModal" class="text-gray-400 hover:text-black p-1 rounded hover:bg-gray-100">
            <X size="18" />
          </button>
        </div>
        
        <!-- Content -->
        <div class="p-4 max-h-80 overflow-y-auto">
          <!-- Loading -->
          <div v-if="assignmentLoading" class="text-center text-gray-400 py-8">
            Loading workers...
          </div>
          
          <!-- Workers List -->
          <div v-else-if="availableWorkers.length > 0" class="space-y-2">
            <p v-if="requiredRoleIds.length > 0" class="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded mb-3">
              Showing only workers with required role(s) for this job type
            </p>
            
            <label 
              v-for="worker in availableWorkers" 
              :key="worker.id"
              class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
              :class="selectedWorkerIds.includes(worker.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-slate-50'"
            >
              <input 
                type="checkbox"
                :checked="selectedWorkerIds.includes(worker.id)"
                @change="toggleWorker(worker.id)"
                class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <div class="flex-1">
                <div class="font-medium text-slate-800">
                  {{ worker.first_name }} {{ worker.last_name }}
                </div>
                <div v-if="getWorkerRoles(worker)" class="text-xs text-gray-500">
                  {{ getWorkerRoles(worker) }}
                </div>
              </div>
              <Check v-if="selectedWorkerIds.includes(worker.id)" size="18" class="text-blue-600" />
            </label>
          </div>
          
          <!-- Empty State -->
          <div v-else class="text-center text-gray-400 py-8">
            <p>No workers available</p>
            <p v-if="requiredRoleIds.length > 0" class="text-xs mt-1">No one has the required role(s) for this job.</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="p-4 border-t border-gray-100 flex justify-between items-center bg-slate-50">
          <div class="text-sm text-gray-500">
            {{ selectedWorkerIds.length }} selected
          </div>
          <div class="flex gap-2">
            <button 
              @click="closeAssignModal" 
              class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button 
              @click="saveAssignments" 
              :disabled="assignmentSaving"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <span v-if="assignmentSaving">Saving...</span>
              <span v-else>Save Assignments</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Tippy minimal override if needed */
.tippy-box[data-theme~='light-border'] {
  background-color: white;
  border: 1px solid #e5e7eb;
  color: #374151;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Compact Calendar Styling - Uses dynamic --row-height from parent */
:deep(.fc) {
  --fc-daygrid-day-min-height: var(--row-height, 60px);
}

:deep(.fc .fc-daygrid-day) {
  min-height: var(--row-height, 60px) !important;
}

:deep(.fc .fc-daygrid-day-frame) {
  min-height: calc(var(--row-height, 60px) - 5px) !important;
}

/* Smaller day numbers */
:deep(.fc .fc-daygrid-day-number) {
  font-size: 11px;
  padding: 2px 4px;
}

/* Compact events */
:deep(.fc .fc-daygrid-event) {
  font-size: 10px;
  padding: 1px 2px;
  margin-bottom: 1px;
}

/* Compact multi-month headers */
:deep(.fc .fc-multimonth-header) {
  padding: 4px 0;
}

:deep(.fc .fc-multimonth-title) {
  font-size: 14px;
  padding: 4px 0;
}

/* Multi-month view also uses --row-height */
:deep(.fc .fc-multimonth-daygrid) {
  --fc-daygrid-day-min-height: var(--row-height, 50px);
}

:deep(.fc .fc-multimonth .fc-daygrid-day) {
  min-height: var(--row-height, 50px) !important;
}
</style>
