<script setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { supabase } from '../../lib/supabase'
import { useServiceOpportunities } from '../../composables/useServiceOpportunities'
import { useVisits } from '../../composables/useVisits'
import AuditHistory from '../AuditHistory.vue'
import PropertyDetailModal from '../properties/PropertyDetailModal.vue'
import { X, Play, AlertTriangle, CheckCircle2, Circle, ArrowRight, Pencil, CheckSquare, Square, Zap, Ban, Clock, Check, Calendar, ExternalLink } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
const props = defineProps({
  isOpen: Boolean,
  opportunity: Object,
  initialAction: { type: String, default: null }
})

const { snoozeOpportunity, unsnoozeOpportunity, dismissOpportunity, undismissOpportunity } = useServiceOpportunities()
const { createVisit, updateVisit } = useVisits()

const snoozeInput = ref(null)

const emit = defineEmits(['close', 'edit', 'refresh'])

const jobs = ref([])
const loadingJobs = ref(false)
const generating = ref(false)

// Snooze State
const isSnoozing = ref(false)
const snoozeUntilDate = ref('')

// Property Detail Modal State
const showPropertyModal = ref(false)

const openPropertyDetail = () => {
    showPropertyModal.value = true
}

const fetchJobs = async () => {
    if (!props.opportunity) return
    loadingJobs.value = true
    
    const { data } = await supabase
        .from('jobs')
        .select(`
            *,
            job_tasks (id, title, is_completed),
            visits (id, scheduled_start, scheduled_end, status)
        `)
        .eq('service_opportunity_id', props.opportunity.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

    jobs.value = data || []
    loadingJobs.value = false
}

// Scheduling state
const schedulingJobId = ref(null)
const editingVisitId = ref(null)
const scheduleStartDate = ref('')
const scheduleEndDate = ref('')

// Computed duration for display during scheduling
const scheduleDuration = computed(() => {
    if (!scheduleStartDate.value || !scheduleEndDate.value) return null
    
    const start = new Date(scheduleStartDate.value)
    const end = new Date(scheduleEndDate.value)
    
    if (end <= start) return null
    
    const diffMs = end - start
    const diffMins = Math.round(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
})

// Auto-update end time when start time changes (default: 15 minutes later)
watch(scheduleStartDate, (newStart) => {
    if (!newStart || editingVisitId.value) return // Don't auto-update if editing existing or empty
    
    const start = new Date(newStart)
    const end = new Date(start.getTime() + 15 * 60000) // 15 minutes later
    
    // Format for datetime-local input
    const offset = end.getTimezoneOffset() * 60000
    const localEnd = new Date(end.getTime() - offset)
    scheduleEndDate.value = localEnd.toISOString().slice(0, 16)
})

const startScheduling = (jobId, existingVisit = null) => {
    schedulingJobId.value = jobId
    
    if (existingVisit) {
        editingVisitId.value = existingVisit.id
        // Format existing times for input
        const start = new Date(existingVisit.scheduled_start)
        const offset = start.getTimezoneOffset() * 60000
        scheduleStartDate.value = new Date(start.getTime() - offset).toISOString().slice(0, 16)
        
        if (existingVisit.scheduled_end) {
             const end = new Date(existingVisit.scheduled_end)
             scheduleEndDate.value = new Date(end.getTime() - offset).toISOString().slice(0, 16)
        } else {
             // Default end if missing
             const end = new Date(start.getTime() + 60 * 60000)
             scheduleEndDate.value = new Date(end.getTime() - offset).toISOString().slice(0, 16)
        }
    } else {
        editingVisitId.value = null
        // Default to tomorrow 9am - 10am (1 hour)
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(9, 0, 0, 0)
        const offset = d.getTimezoneOffset() * 60000
        const localDate = new Date(d.getTime() - offset)
        scheduleStartDate.value = localDate.toISOString().slice(0, 16)
        // Watcher will set end date
    }
}

const cancelScheduling = () => {
    schedulingJobId.value = null
    editingVisitId.value = null
    scheduleStartDate.value = ''
    scheduleEndDate.value = ''
}

const confirmSchedule = async (jobId) => {
    if (!scheduleStartDate.value) {
        alert('Please select a start time')
        return
    }
    
    const startIso = new Date(scheduleStartDate.value).toISOString()
    const endIso = scheduleEndDate.value ? new Date(scheduleEndDate.value).toISOString() : null
    
    let result;
    if (editingVisitId.value) {
        result = await updateVisit(editingVisitId.value, startIso, endIso)
    } else {
        result = await createVisit(jobId, startIso, endIso)
    }
    
    if (!result.success) {
        alert('Error scheduling: ' + result.error)
    } else {
        schedulingJobId.value = null
        editingVisitId.value = null
        scheduleStartDate.value = ''
        scheduleEndDate.value = ''
        await fetchJobs() // Refresh to show new schedule
    }
}

const getJobSchedule = (job) => {
    if (!job.visits || job.visits.length === 0) return null
    // Get the first scheduled visit
    const scheduled = job.visits.find(v => v.scheduled_start)
    if (!scheduled) return null
    return {
        start: scheduled.scheduled_start,
        end: scheduled.scheduled_end
    }
}

const formatSchedule = (schedule) => {
    if (!schedule || !schedule.start) return ''
    const start = new Date(schedule.start)
    const startStr = start.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    })
    
    if (!schedule.end) return startStr
    
    const end = new Date(schedule.end)
    const endStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    
    // Calculate duration
    const diffMs = end - start
    const diffMins = Math.round(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    let durationStr = ''
    if (hours > 0 && mins > 0) durationStr = `${hours}h ${mins}m`
    else if (hours > 0) durationStr = `${hours}h`
    else durationStr = `${mins}m`
    
    return `${startStr} - ${endStr} (${durationStr})`
}

watch(() => props.isOpen, (open) => {
    if (open && props.opportunity) {
        fetchJobs()
        
        // Handle auto-actions
        if (props.initialAction === 'snooze') {
            // Slight delay to ensure modal transition doesn't interfere with picker positioning
            setTimeout(() => {
                startSnooze()
            }, 300) 
        }
    } else {
        // Reset state on close
        isSnoozing.value = false
    }
})

const generateWorkflow = async () => {
    generating.value = true
    const { data, error } = await supabase.rpc('generate_service_workflow', {
        p_service_opportunity_id: props.opportunity.id
    })

    if (error) {
        alert("Error generating workflow: " + error.message)
    } else {
        emit('refresh') // Refresh parent list
        fetchJobs() // Refresh local list
    }
    generating.value = false
}

const showDismissDialog = ref(false)
const dismissReason = ref('')

const handleDismiss = () => {
    dismissReason.value = ''
    showDismissDialog.value = true
}

const closeDismissDialog = () => {
    showDismissDialog.value = false
    dismissReason.value = ''
}

const confirmDismiss = async () => {
    if (!dismissReason.value.trim()) {
        alert("A reason is required.")
        return
    }
    
    // Optimistic UI updates could go here
    
    const { success, error } = await dismissOpportunity(props.opportunity.id, dismissReason.value)
    
    if (!success) {
        alert('Error: ' + error)
    } else {
        emit('refresh')
        emit('close')
    }
}

const startSnooze = async () => {
    isSnoozing.value = true
    
    // Always default to tomorrow 8am
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
    // Adjust for timezone offset so toISOString() returns local wall (clock) time
    const offset = d.getTimezoneOffset() * 60000
    const localDate = new Date(d.getTime() - offset)
    snoozeUntilDate.value = localDate.toISOString().slice(0, 16)
    
    // Wait for animation (200ms) to finish so picker positions correctly
    setTimeout(() => {
        if (snoozeInput.value && typeof snoozeInput.value.showPicker === 'function') {
            snoozeInput.value.showPicker()
        } else {
            snoozeInput.value?.focus()
        }
    }, 250)
}

const cancelSnooze = () => {
    isSnoozing.value = false
}

const completionMinDate = computed(() => {
    const d = new Date()
    const offset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - offset).toISOString().slice(0, 16)
})

const confirmSnooze = async () => {
    if (!snoozeUntilDate.value) {
        alert('Please select a date and time')
        return
    }
    
    const { success, error } = await snoozeOpportunity(props.opportunity.id, new Date(snoozeUntilDate.value).toISOString())
    
    if (!success) alert('Error: ' + error)
    else {
        isSnoozing.value = false
        emit('refresh')
        emit('close')
    }
}

const handleUnsnooze = async () => {
    const { success, error } = await unsnoozeOpportunity(props.opportunity.id)
    
    if (!success) alert('Error: ' + error)
    else {
        emit('refresh')
        emit('close')
    }
}

const handleUndismiss = async () => {
    const { success, error } = await undismissOpportunity(props.opportunity.id)
    
    if (!success) alert('Error: ' + error)
    else {
        emit('refresh')
        emit('close')
    }
}

const statusColor = (s) => {
    const map = { Open: 'bg-green-100 text-green-800', Pending: 'bg-yellow-100 text-yellow-800', Completed: 'bg-blue-100 text-blue-800', Dismissed: 'bg-gray-100 text-gray-500' }
    return map[s] || 'bg-gray-100 text-gray-600'
}

// ESC Key Handler
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
            <div class="flex items-center gap-3">
                <div>
                    <h3 class="font-bold text-lg text-slate-900">Opportunity Details</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs px-2 py-0.5 rounded font-bold uppercase" :class="statusColor(opportunity.status)">
                        <template v-if="opportunity.status === 'Snoozed' && opportunity.snooze_until">
                            SNOOZED UNTIL {{ new Date(opportunity.snooze_until).toLocaleString() }}
                        </template>
                        <template v-else>
                            {{ opportunity.status }}
                        </template>

                    </span>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div v-if="opportunity.status === 'Snoozed'" class="ml-4">
                     <button @click="handleUnsnooze" class="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold hover:bg-emerald-200 transition">
                        <Clock size="12" class="opacity-50" /> Unsnooze
                    </button>
                </div>

                <div v-if="opportunity.status === 'Dismissed'" class="ml-4">
                     <button @click="handleUndismiss" class="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold hover:bg-emerald-200 transition">
                        <Ban size="12" class="opacity-50" /> Undismiss
                    </button>
                </div>

                <div v-if="opportunity.status === 'Open'" class="flex gap-2 ml-4">
                    <button v-if="!isSnoozing" @click="handleDismiss" class="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 transition">
                        <Ban size="12" /> Dismiss
                    </button>
                    <button v-if="!isSnoozing" @click="startSnooze" class="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded text-xs font-bold hover:bg-amber-200 transition">
                        <Clock size="12" /> Snooze
                    </button>

                    <!-- Snooze Input Mode -->
                    <div v-if="isSnoozing" class="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                        <input 
                            ref="snoozeInput"
                            type="datetime-local" 
                            :min="completionMinDate"
                            v-model="snoozeUntilDate"
                            class="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                        <button type="button" @click.stop.prevent="confirmSnooze" class="p-1 text-green-600 hover:bg-green-50 rounded" title="Confirm Snooze">
                            <Check size="16" stroke-width="3" />
                        </button>
                        <button type="button" @click.stop.prevent="cancelSnooze" class="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                            <X size="16" />
                        </button>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button @click="$emit('edit', opportunity)" class="text-gray-400 hover:text-black transition-colors p-2 rounded hover:bg-slate-100" title="Edit Opportunity">
                    <Pencil size="16" />
                </button>
                <button @click="$emit('close')" class="text-gray-400 hover:text-black transition-colors p-2 rounded hover:bg-slate-100">
                    <X size="20" />
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            
            <!-- Info Card -->
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
                 <div>
                     <label class="flex items-center gap-1 text-xs font-bold uppercase text-gray-400 mb-1">
                         Property
                         <button 
                             v-if="opportunity.property_id"
                             @click="openPropertyDetail"
                             class="p-0.5 text-gray-400 hover:text-blue-600 rounded transition"
                             title="View Property Details"
                         >
                             <ExternalLink size="12" />
                         </button>
                     </label>
                     <div class="font-bold text-slate-800">{{ opportunity.properties?.name || 'Unknown' }}</div>
                 </div>
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-400 mb-1">Service</label>
                     <div class="font-bold text-slate-800">{{ opportunity.service_templates?.name || 'Ad-Hoc' }}</div>
                 </div>
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-400 mb-1">Source</label>
                     <div class="text-sm text-slate-600">{{ opportunity.trigger_source || 'Manual' }}</div>
                 </div>
            </div>

            <!-- Dismissal Reason (when dismissed) -->
            <div v-if="opportunity.status === 'Dismissed' && opportunity.dismissal_reason" class="bg-red-50 border border-red-200 rounded-xl p-4">
                 <label class="block text-xs font-bold uppercase text-red-400 mb-1">Dismissal Reason</label>
                 <div class="text-sm text-red-700 font-medium">{{ opportunity.dismissal_reason }}</div>
            </div>

            <!-- Workflow Section -->
            <div>
                 <div class="flex justify-between items-center mb-3">
                     <h4 class="font-bold text-slate-700 uppercase text-sm">Workflow Status</h4>
                     
                     <div v-if="jobs.length === 0 && ['Open', 'Pending'].includes(opportunity.status)" class="animate-pulse">
                         <button @click="generateWorkflow" :disabled="generating" class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 flex items-center transition disabled:opacity-50">
                             <Zap size="14" class="mr-1" />
                             {{ generating ? 'Generating...' : 'Generate Workflow' }}
                         </button>
                     </div>
                 </div>

                 <!-- Jobs List -->
                 <div v-if="loadingJobs" class="text-center text-gray-400 py-8">Loading jobs...</div>
                 
                 <div v-else-if="jobs.length > 0" class="space-y-4">
                     <!-- Horizontal Flow Visualization (Simple) -->
                     <div class="flex items-center gap-2 overflow-x-auto pb-2">
                         <div v-for="(job, idx) in jobs" :key="'flow-' + job.id" class="flex items-center">
                             <div class="px-3 py-1 rounded text-xs font-bold border whitespace-nowrap" :class="statusColor(job.status)">
                                 {{ job.title || job.type || 'Untitled' }}
                             </div>
                             <ArrowRight v-if="idx < jobs.length - 1" class="mx-2 text-gray-300" size="14" />
                         </div>
                     </div>

                     <!-- Detailed Cards -->
                     <div class="space-y-4">
                         <div v-for="(job, j_idx) in jobs" :key="job.id" class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                             <div class="flex items-center gap-2 mb-3">
                                 <span class="text-xs font-bold text-gray-500 uppercase w-12 text-right">Job {{ j_idx + 1 }}</span>
                                 <div 
                                    class="flex-1 bg-white p-2 rounded border border-gray-200 flex items-center justify-between cursor-pointer hover:border-blue-300 transition"
                                    @click="router.push(`/jobs/${job.id}`)"
                                 >
                                    <h5 class="font-bold text-slate-800 text-sm">{{ job.title || job.type || 'Untitled' }}</h5>
                                    <span class="text-[10px] px-2 py-0.5 rounded font-bold" :class="statusColor(job.status)">{{ job.status }}</span>
                                 </div>
                             </div>

                             <!-- Schedule Section -->
                             <div class="mb-3 pl-14">
                                 <div 
                                    v-if="getJobSchedule(job)" 
                                    @click="startScheduling(job.id, job.visits.find(v => v.scheduled_start))"
                                    class="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 rounded px-3 py-2 border border-blue-100 cursor-pointer hover:bg-blue-100 hover:border-blue-200 transition group/schedule"
                                    title="Click to reschedule"
                                >
                                    <Calendar size="14" class="text-blue-500" />
                                    <span class="font-medium">{{ formatSchedule(getJobSchedule(job)) }}</span>
                                    <Pencil size="12" class="ml-auto text-blue-400 opacity-0 group-hover/schedule:opacity-100" />
                                </div>
                                 <div v-else-if="schedulingJobId === job.id" class="flex flex-wrap items-center gap-2 animate-in slide-in-from-top-1">
                                     <div class="flex items-center gap-1">
                                         <span class="text-xs text-gray-500 font-medium">Start:</span>
                                         <input 
                                             type="datetime-local" 
                                             v-model="scheduleStartDate"
                                             class="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                                         />
                                     </div>
                                     <div class="flex items-center gap-1">
                                         <span class="text-xs text-gray-500 font-medium">End:</span>
                                         <input 
                                             type="datetime-local" 
                                             v-model="scheduleEndDate"
                                             class="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                                         />
                                     </div>
                                     <span v-if="scheduleDuration" class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                         {{ scheduleDuration }}
                                     </span>
                                     <span v-else-if="scheduleStartDate && scheduleEndDate" class="text-xs text-red-500">
                                         Invalid duration
                                     </span>
                                     <div class="flex items-center gap-1">
                                         <button @click="confirmSchedule(job.id)" class="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition" title="Confirm">
                                             <Check size="14" />
                                         </button>
                                         <button @click="cancelScheduling" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition" title="Cancel">
                                             <X size="14" />
                                         </button>
                                     </div>
                                 </div>
                                 <button 
                                     v-else
                                     @click.stop="startScheduling(job.id)"
                                     class="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition"
                                 >
                                     <Calendar size="12" />
                                     Schedule
                                 </button>
                             </div>

                             <!-- Tasks -->
                             <div v-if="job.job_tasks && job.job_tasks.length" class="pl-3 border-l-2 border-slate-100 space-y-1 mb-3 ml-11">
                                 <div v-for="t in job.job_tasks" :key="t.id" class="flex items-center gap-2 text-xs text-gray-600">
                                     <CheckSquare v-if="t.is_completed" class="w-3 h-3 text-green-500" />
                                     <Square v-else class="w-3 h-3 text-gray-300" />
                                     <span :class="{ 'line-through text-gray-400': t.is_completed }">{{ t.title }}</span>
                                 </div>
                             </div>

                             <!-- Inputs (Read Only) -->
                             <div v-if="job.job_inputs && job.job_inputs.length" class="mt-2 pt-2 border-t border-gray-50 grid grid-cols-2 gap-2 ml-11">
                                 <div v-for="inp in job.job_inputs" :key="inp.id">
                                     <label class="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                                         {{ inp.job_template_inputs?.label || 'Input' }}
                                     </label>
                                     <div class="text-xs text-slate-700 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                         {{ inp.value || '-' }}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div v-else class="text-center py-6 bg-white rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs italic">
                     No jobs created yet. Click "Generate Workflow" to start.
                 </div>

            </div>

            <!-- Audit History -->
            <div class="px-6 pb-6">
                <AuditHistory tableName="service_opportunities" :recordId="opportunity.id" />
            </div>

        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center">
             <!-- Audit History Only -->
        </div>

    </div>
  </div>

  <!-- Dismissal Confirmation Overlay -->
  <div v-if="showDismissDialog" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="closeDismissDialog">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
          <div class="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size="24" />
              <h3 class="font-bold text-lg">Confirm Dismissal</h3>
          </div>
          
          <p class="text-sm text-gray-600 mb-4">
              Are you sure you want to dismiss this opportunity?
          </p>

          <div v-if="jobs.length > 0" class="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p class="text-xs font-bold text-red-700 uppercase mb-2">Warning: The following jobs will be deleted:</p>
              <ul class="list-disc list-inside text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  <li v-for="job in jobs" :key="job.id">{{ job.title || job.type || 'Untitled Job' }}</li>
              </ul>
          </div>

          <div class="mb-4">
              <label class="block text-xs font-bold text-gray-700 mb-1">Reason for dismissal <span class="text-red-500">*</span></label>
              <textarea 
                  v-model="dismissReason"
                  class="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-red-500 focus:border-red-500"
                  rows="3"
                  placeholder="e.g. Current tenant cancelled service..."
                  autoFocus
              ></textarea>
          </div>

          <div class="flex justify-end gap-3">
              <button @click="closeDismissDialog" class="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button @click="confirmDismiss" class="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition">Confirm Dismissal</button>
          </div>
      </div>
  </div>

  <!-- Property Detail Modal (nested) -->
  <PropertyDetailModal 
      :is-open="showPropertyModal" 
      :property="{ id: opportunity?.property_id, name: opportunity?.properties?.name }"
      @close="showPropertyModal = false"
  />
</template>
