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
import CalendarEventModal from '../components/calendar/CalendarEventModal.vue'
import ServiceOpportunityFormModal from '../components/services/ServiceOpportunityFormModal.vue'
import { perfLog } from '../lib/perfLog'

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

// Context menu state
const router = useRouter()
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuEvent = ref(null)
const contextMenuDate = ref(null)

const closeContextMenu = () => {
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
    // Simplified content for MultiMonth view to avoid overflow (except for 1-month view which is now DayGrid/DayGridMonth)
    // Note: arg.view.type is the resolved type (e.g. 'dayGridMonth' or 'multiMonthYear')
    // Wait, in my config multiMonth1 IS dayGridMonth.
    // So if it's multiMonthYear (2-6), use simplified.
    if (arg.view.type === 'multiMonthYear') {
      return {
        html: `<div class="text-[10px] truncate px-1 rounded-sm leading-tight" style="color:${arg.event.textColor || '#fff'}">${arg.event.title}</div>`
      }
    }
    
    // Detailed view (cols logic adapted)
    return {
      html: `
      <div class="px-1 py-px overflow-hidden h-full flex flex-col justify-center leading-none">
          <div class="font-bold text-[10px] truncate mb-px">${arg.event.title}</div>
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
