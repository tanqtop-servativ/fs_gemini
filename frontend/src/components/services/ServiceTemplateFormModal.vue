<script setup>
import { ref, watch, reactive, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../composables/useAuth'
import { useServiceTemplates } from '../../composables/useServiceTemplates'
import { X, Save, Plus, GripVertical, Trash2, ListTree, GitMerge } from 'lucide-vue-next'
import draggable from 'vuedraggable'

const props = defineProps({
  isOpen: Boolean,
  template: Object
})

const emit = defineEmits(['close', 'saved', 'deleted'])

const loading = ref(false)
const saving = ref(false)
const jobTemplates = ref([])

const { effectiveTenantId } = useAuth()
const { saveTemplate } = useServiceTemplates()

// Form
const form = reactive({
    name: '',
    description: '',
    steps: [] // { job_template_id, is_optional, is_billing, delay_hours, sort_order, _tempId }
})

// Unsaved Config
const initialState = ref('')
const getSnapshot = () => JSON.stringify(form)

// Fetch Job Templates for dropdown
const fetchJobTemplates = async () => {
    const tenantId = effectiveTenantId.value
    if (!tenantId) return

    const { data } = await supabase
        .from('job_templates')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name')
    
    jobTemplates.value = data || []
}

watch(() => props.isOpen, (open) => {
    if (open) {
        fetchJobTemplates()
        if (props.template) {
            form.name = props.template.name
            form.description = props.template.description || ''
            // Deep copy steps
            form.steps = (props.template.service_workflow_steps || [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((s, idx) => ({
                    ...s,
                    _tempId: idx // tracking for draggable key
                }))
        } else {
            resetForm()
        }
        initialState.value = getSnapshot()
    }
})

const resetForm = () => {
    form.name = ''
    form.description = ''
    form.steps = []
}

// Logic
const addStep = (e) => {
    const jId = e.target.value
    if (!jId) return
    
    // Find job name for potential lookup, but we store ID
    form.steps.push({
        job_template_id: jId,
        is_optional: false,
        is_billing: false,
        delay_hours: 0,
        _tempId: Date.now() + Math.random()
    })
    e.target.value = "" // Reset select
}

const removeStep = (index) => {
    form.steps.splice(index, 1)
}

const getJobName = (id) => {
    const j = jobTemplates.value.find(x => x.id == id)
    return j ? j.name : 'Unknown Job'
}

const handleSave = async () => {
    if (!form.name) return alert("Service Name required")
    saving.value = true

    try {
        const result = await saveTemplate({
            id: props.template?.id,
            name: form.name,
            description: form.description,
            steps: form.steps
        })

        if (!result.success) throw new Error(result.error)

        emit('saved')
        emit('close')

    } catch (e) {
        alert("Error saving: " + e.message)
    } finally {
        saving.value = false
    }
}

const handleDelete = async () => {
    if (!props.template?.id) return
    if (!confirm("Are you sure you want to delete this service template? This cannot be undone.")) return
    
    const { error } = await supabase
        .from('service_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', props.template.id)
    
    if (error) {
        alert("Error deleting: " + error.message)
    } else {
        emit('deleted')
        emit('close')
    }
}

const handleClose = () => {
    if (initialState.value && getSnapshot() !== initialState.value) {
        if (!confirm("You have unsaved changes. Are you sure you want to close?")) return
    }
    emit('close')
}

// ESC Key Handler
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.isOpen) {
    handleClose()
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
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="handleClose">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">{{ template ? 'Edit Workflow' : 'New Service Workflow' }}</h3>
            <button @click="handleClose" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Service Name</label>
                     <input v-model="form.name" class="w-full border p-2 rounded text-lg font-bold focus:ring-1 focus:ring-blue-500" placeholder="e.g. Standard Turnover">
                 </div>
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
                     <textarea v-model="form.description" class="w-full border p-2 rounded text-sm h-16 resize-none" placeholder="Is this for Turnovers? Warranty?"></textarea>
                 </div>
            </div>

            <!-- Steps -->
            <div>
                 <div class="flex justify-between items-center mb-2">
                     <h4 class="font-bold text-slate-700 uppercase text-sm flex items-center gap-2">
                         <GitMerge size="16" class="text-blue-500"/> Workflow Steps
                     </h4>
                 </div>

                 <draggable 
                    v-model="form.steps" 
                    item-key="_tempId" 
                    handle=".drag-handle"
                    class="space-y-3"
                    ghost-class="opacity-50"
                 >
                    <template #item="{ element: step, index }">
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm flex items-start p-3 group">
                            <!-- Handle -->
                            <div class="mt-2 mr-3 cursor-grab active:cursor-grabbing drag-handle text-gray-300 hover:text-gray-500">
                                <GripVertical size="20" />
                            </div>
                            
                            <!-- Index -->
                            <div class="mt-2 text-sm font-bold text-gray-300 w-6 text-center select-none">{{ index + 1 }}</div>

                            <!-- Content -->
                            <div class="flex-1 ml-2">
                                <div class="font-bold text-slate-800 text-sm mb-2">{{ getJobName(step.job_template_id) }}</div>
                                
                                <div class="flex flex-wrap gap-4 items-center">
                                    <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                        <input type="checkbox" v-model="step.is_optional" class="rounded text-blue-600 focus:ring-0"> Optional
                                    </label>
                                    <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                        <input type="checkbox" v-model="step.is_billing" class="rounded text-green-600 focus:ring-0"> Billing Event
                                    </label>
                                    <div class="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <span class="text-[10px] uppercase font-bold text-gray-400">Delay</span>
                                        <input v-model.number="step.delay_hours" type="number" min="0" class="w-10 text-center text-xs border rounded p-0.5" placeholder="0">
                                        <span class="text-xs text-gray-400">hrs</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Delete -->
                            <button @click="removeStep(index)" class="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition">
                                <Trash2 size="16" />
                            </button>
                        </div>
                    </template>
                 </draggable>
                 
                 <!-- Empty State -->
                 <div v-if="form.steps.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg mt-2">
                     <p class="text-gray-400 text-xs italic">No job steps defined yet.</p>
                 </div>

                 <!-- Add Step -->
                 <div class="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center gap-3">
                     <Plus size="16" class="text-blue-500"/>
                     <select @change="addStep" class="flex-1 text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white">
                         <option value="">Add Job Template as Step...</option>
                         <option v-for="j in jobTemplates" :key="j.id" :value="j.id">{{ j.name }}</option>
                     </select>
                 </div>

            </div>

        </div>

        <!-- Footer -->
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div>
                <button v-if="template" @click="handleDelete" class="text-red-500 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded flex items-center">
                    <Trash2 size="16" class="mr-2" /> Delete
                </button>
            </div>
            <div class="flex gap-3">
                <button @click="handleClose" class="px-4 py-2 hover:bg-gray-200 rounded text-sm font-bold text-gray-600 transition">Cancel</button>
                <button @click="handleSave" :disabled="saving" class="px-6 py-2 bg-slate-900 text-white rounded shadow text-sm font-bold hover:bg-slate-700 flex items-center transition disabled:opacity-50">
                    <Save size="16" class="mr-2" />
                    {{ saving ? 'Saving...' : 'Save Workflow' }}
                </button>
            </div>
        </div>

    </div>
  </div>
</template>
