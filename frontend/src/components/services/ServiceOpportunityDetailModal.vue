```vue
<script setup>
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { supabase } from '../../lib/supabase'
import AuditHistory from '../AuditHistory.vue'
import { X, Play, AlertTriangle, CheckCircle2, Circle, ArrowRight, Pencil, CheckSquare, Square, Zap, Ban, Clock, Check } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
const props = defineProps({
  isOpen: Boolean,
  opportunity: Object
})

const snoozeInput = ref(null)

const emit = defineEmits(['close', 'edit', 'refresh'])

const jobs = ref([])
const loadingJobs = ref(false)
const generating = ref(false)

// Snooze State
const isSnoozing = ref(false)
const snoozeUntilDate = ref('')

const fetchJobs = async () => {
    if (!props.opportunity) return
    loadingJobs.value = true
    
    const { data } = await supabase
        .from('jobs')
        .select(`
            *,
            job_tasks (id, title, is_completed)
        `)
        .eq('service_opportunity_id', props.opportunity.id)
        .order('id', { ascending: true })

    jobs.value = data || []
    loadingJobs.value = false
}

watch(() => props.isOpen, (open) => {
    if (open && props.opportunity) {
        fetchJobs()
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

const dismissOpportunity = async () => {
    if (!confirm('Dismiss this opportunity? It will be archived.')) return
    const { error } = await supabase
        .from('service_opportunities')
        .update({ status: 'Dismissed', updated_at: new Date().toISOString() })
        .eq('id', props.opportunity.id)
    
    if (error) alert('Error: ' + error.message)
    else {
        emit('refresh')
        emit('close')
    }
}

const startSnooze = async () => {
    isSnoozing.value = true
    // Default to tomorrow 9am if empty? Or just let them pick
    if (!snoozeUntilDate.value) {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(8, 0, 0, 0)
        // Adjust for timezone offset so toISOString() returns local wall (clock) time
        const offset = d.getTimezoneOffset() * 60000
        const localDate = new Date(d.getTime() - offset)
        snoozeUntilDate.value = localDate.toISOString().slice(0, 16)
    }
    
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
    
    const { error } = await supabase
        .from('service_opportunities')
        .update({ 
            status: 'Snoozed', 
            snooze_until: new Date(snoozeUntilDate.value).toISOString(),
            updated_at: new Date().toISOString() 
        })
        .eq('id', props.opportunity.id)
    
    if (error) alert('Error: ' + error.message)
    else {
        isSnoozing.value = false
        emit('refresh')
        emit('close')
    }
}

const unsnoozeOpportunity = async () => {
    const { error } = await supabase
        .from('service_opportunities')
        .update({ 
            status: 'Open', 
            snooze_until: null,
            updated_at: new Date().toISOString() 
        })
        .eq('id', props.opportunity.id)
    
    if (error) alert('Error: ' + error.message)
    else {
        emit('refresh')
        emit('close')
    }
}

const statusColor = (s) => {
    if (s === 'Complete' || s === 'Captured') return 'bg-green-100 text-green-700'
    if (s === 'In Progress') return 'bg-blue-100 text-blue-700'
    if (s === 'Snoozed') return 'bg-amber-100 text-amber-800'
    if (s === 'Dismissed') return 'bg-red-50 text-red-600'
    return 'bg-gray-100 text-gray-600'
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
            <div class="flex items-center gap-3">
                <div>
                    <h3 class="font-bold text-lg text-slate-900">Opportunity Details</h3>
<span class="text-xs px-2 py-0.5 rounded font-bold uppercase" :class="statusColor(opportunity.status)">
                        <template v-if="opportunity.status === 'Snoozed' && opportunity.snooze_until">
                            SNOOZED UNTIL {{ new Date(opportunity.snooze_until).toLocaleString() }}
                        </template>
                        <template v-else>
                            {{ opportunity.status }}
                        </template>
                    </span>
                </div>
                
                <!-- Action Buttons -->
                <div v-if="opportunity.status === 'Snoozed'" class="ml-4">
                     <button @click="unsnoozeOpportunity" class="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold hover:bg-emerald-200 transition">
                        <Clock size="12" class="opacity-50" /> Unsnooze
                    </button>
                </div>

                <div v-if="opportunity.status === 'Open'" class="flex gap-2 ml-4">
                    <button v-if="!isSnoozing" @click="dismissOpportunity" class="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 transition">
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
                        <button @click="confirmSnooze" class="p-1 text-green-600 hover:bg-green-50 rounded" title="Confirm Snooze">
                            <Check size="16" stroke-width="3" />
                        </button>
                        <button @click="cancelSnooze" class="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                            <X size="16" />
                        </button>
                    </div>
                </div>
            </div>
            <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            
            <!-- Info Card -->
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-400 mb-1">Property</label>
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
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-400 mb-1">Due Date</label>
                     <div class="text-sm text-slate-600">{{ opportunity.due_date ? new Date(opportunity.due_date).toLocaleDateString() : 'None' }}</div>
                 </div>
            </div>

            <!-- Workflow Section -->
            <div>
                 <div class="flex justify-between items-center mb-3">
                     <h4 class="font-bold text-slate-700 uppercase text-sm">Workflow Status</h4>
                     
                     <div v-if="jobs.length === 0 && opportunity.status === 'Pending'" class="animate-pulse">
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
                                 {{ job.type }}
                             </div>
                             <ArrowRight v-if="idx < jobs.length - 1" class="mx-2 text-gray-300" size="14" />
                         </div>
                     </div>

                     <!-- Detailed Cards -->
                     <div class="space-y-4">
                         <div v-for="(job, j_idx) in jobs" :key="job.id" class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                             <div class="flex items-center gap-2 mb-3">
                                 <span class="text-xs font-bold text-gray-500 uppercase w-12 text-right">Step {{ j_idx + 1 }}</span>
                                 <div 
                                    class="flex-1 bg-white p-2 rounded border border-gray-200 flex items-center justify-between cursor-pointer hover:border-blue-300 transition"
                                    @click="router.push(`/jobs/${job.id}`)"
                                 >
                                    <h5 class="font-bold text-slate-800 text-sm">{{ job.type }}</h5>
                                    <span class="text-[10px] px-2 py-0.5 rounded font-bold" :class="statusColor(job.status)">{{ job.status }}</span>
                                 </div>
                             </div>

                             <!-- Tasks -->
                             <div v-if="job.job_tasks && job.job_tasks.length" class="pl-3 border-l-2 border-slate-100 space-y-1 mb-3">
                                 <div v-for="t in job.job_tasks" :key="t.id" class="flex items-center gap-2 text-xs text-gray-600">
                                     <CheckSquare v-if="t.is_completed" class="w-3 h-3 text-green-500" />
                                     <Square v-else class="w-3 h-3 text-gray-300" />
                                     <span :class="{ 'line-through text-gray-400': t.is_completed }">{{ t.title }}</span>
                                 </div>
                             </div>

                             <!-- Inputs (Read Only) -->
                             <div v-if="job.job_inputs && job.job_inputs.length" class="mt-2 pt-2 border-t border-gray-50 grid grid-cols-2 gap-2">
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

        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
             <button @click="$emit('edit', opportunity)" class="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center">
                 <Pencil size="14" class="mr-2" /> Edit Details
             </button>
        </div>

    </div>
  </div>
</template>
