<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light-border.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

// Refs for UI state
const route = useRoute()
const calendarRef = ref(null)
const selectedPropId = ref('all')
const selectedView = ref('multiMonth1') // Default internally maps to 'multiMonth1'
const selectedMonths = ref(1)
const properties = ref([])

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
    multiMonth2: { type: 'multiMonthYear', duration: { months: 2 }, multiMonthMaxColumns: 1, showNonCurrentDates: false },
    multiMonth3: { type: 'multiMonthYear', duration: { months: 3 }, multiMonthMaxColumns: 1, showNonCurrentDates: false },
    multiMonth4: { type: 'multiMonthYear', duration: { months: 4 }, multiMonthMaxColumns: 1, showNonCurrentDates: false },
    multiMonth5: { type: 'multiMonthYear', duration: { months: 5 }, multiMonthMaxColumns: 1, showNonCurrentDates: false },
    multiMonth6: { type: 'multiMonthYear', duration: { months: 6 }, multiMonthMaxColumns: 1, showNonCurrentDates: false },
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
    
    tippy(info.el, {
      content: `
        <div class="font-bold">${info.event.title}</div>
        <div class="text-xs text-blue-200 border-b border-white/20 pb-1 mb-1">${timeStr}</div>
        <div class="text-xs">${props.property_name || ''}</div>
        <div class="text-[10px] opacity-75">${props.property_address || ''}</div>
      `,
      allowHTML: true,
      theme: 'light-border'
    })
  }
}

const { userProfile } = useAuth()

// Data Fetching
const fetchProperties = async () => {
    // Rely on RLS, but ensure auth is ready
    if (!userProfile.value) return
    const { data } = await supabase.from('properties').select('id, name').eq('status', 'active')
    if (data) properties.value = data
}

const fetchEvents = async () => {
    if (!userProfile.value) return
    
  const calApi = calendarRef.value?.getApi()
  if (!calApi) return
  
  let query = supabase.from('master_calendar').select('*')
  if (selectedPropId.value !== 'all') {
    query = query.eq('property_id', selectedPropId.value)
  }
  
  const { data, error } = await query
  if (error) {
    console.error(error)
    return
  }
  
  const fcEvents = data.map(evt => ({
    id: evt.id,
    title: evt.title,
    start: evt.start_date,
    end: evt.end_date,
    color: evt.color,
    classNames: [evt.class_name],
    allDay: evt.all_day,
    extendedProps: {
      description: evt.description,
      property_name: evt.property_name,
      property_address: evt.property_address
    }
  }))
  
  calApi.removeAllEvents()
  calApi.addEventSource(fcEvents)
}

watch(() => route.query.propertyId, (newId) => {
    selectedPropId.value = newId || 'all'
}, { immediate: true })

watch(userProfile, (newVal) => {
    if (newVal) {
        fetchProperties()
        fetchEvents()
    }
}, { immediate: true })

onMounted(() => {
    if (userProfile.value) {
        fetchEvents() 
    }
})
const pageTitle = computed(() => {
    if (selectedPropId.value === 'all') return 'Master Calendar'
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
          <option value="all">All Properties</option>
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
      </div>
    </div>
    
    <!-- Calendar -->
    <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden">
      <FullCalendar ref="calendarRef" :options="calendarOptions" />
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
</style>
