<script setup>
import { ref, watch, reactive, onMounted } from 'vue'
import { useServiceOpportunities } from '../../composables/useServiceOpportunities'
import { X, Save, Calendar, Building, FileText, Smartphone } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  opportunity: Object,
  defaultDate: String,  // For pre-populating from calendar context menu
  defaultPropertyId: String  // For pre-populating when property is selected in calendar
})

const emit = defineEmits(['close', 'saved'])

// Composables
const { saveOpportunity, deleteOpportunity, fetchFormOptions } = useServiceOpportunities()

const loading = ref(false)
const saving = ref(false)

// Data
const properties = ref([])
const serviceTemplates = ref([])

// Form
const form = reactive({
    property_id: '',
    service_template_id: '',
    trigger_source: 'Manual',
    due_date: '',
})

// Validation
const today = new Date().toISOString().split('T')[0]

// Fetch Data
const fetchOptions = async () => {
    const result = await fetchFormOptions()
    if (result.success) {
        properties.value = result.properties
        serviceTemplates.value = result.templates
    }
}

watch(() => props.isOpen, (open) => {
    if (open) {
        fetchOptions()
        if (props.opportunity) {
            form.property_id = props.opportunity.property_id
            form.service_template_id = props.opportunity.service_template_id
            form.trigger_source = props.opportunity.trigger_source || 'Manual'
            form.due_date = props.opportunity.due_date ? props.opportunity.due_date.split('T')[0] : ''
        } else {
            resetForm()
            // Pre-populate date from calendar context menu
            if (props.defaultDate) {
                form.due_date = props.defaultDate
            }
            // Pre-populate property from calendar filter
            if (props.defaultPropertyId) {
                form.property_id = props.defaultPropertyId
            }
        }
        initialState.value = getSnapshot()
    }
})

const resetForm = () => {
    form.property_id = ''
    form.service_template_id = ''
    form.trigger_source = 'Manual'
    form.due_date = ''
}

const handleSave = async () => {
    if (!form.property_id) return alert("Property is required")
    saving.value = true

    try {
        // Dynamic Title from template name
        let title = "New Service Opportunity"
        const tpl = serviceTemplates.value.find(t => t.id === form.service_template_id)
        if (tpl) title = tpl.name

        const result = await saveOpportunity({
            id: props.opportunity?.id,
            property_id: form.property_id,
            service_template_id: form.service_template_id || null,
            trigger_source: form.trigger_source,
            due_date: form.due_date || null,
            title
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
    if (!confirm("Delete this opportunity?")) return
    const result = await deleteOpportunity(props.opportunity.id)
    if (!result.success) alert(result.error)
    else { emit('saved'); emit('close'); }
}

// Unsaved Config
const initialState = ref('')
const getSnapshot = () => JSON.stringify(form)

const handleClose = () => {
    if (initialState.value && getSnapshot() !== initialState.value) {
        if (!confirm("You have unsaved changes. Are you sure you want to close?")) return
    }
    emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="handleClose">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
        
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">{{ opportunity ? 'Edit Opportunity' : 'New Service Opportunity' }}</h3>
            <button @click="handleClose" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <div class="p-6 space-y-4 bg-slate-50/50">
            
            <!-- Property -->
            <div>
                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Property</label>
                <div class="relative">
                    <Building class="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <select v-model="form.property_id" class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white" :disabled="opportunity">
                        <option value="">-- Select Property --</option>
                        <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                </div>
            </div>

            <!-- Template -->
            <div>
                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Service Template</label>
                <div class="relative">
                    <FileText class="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <select v-model="form.service_template_id" class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white">
                        <option value="">-- Select Service Template --</option>
                        <option v-for="s in serviceTemplates" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                </div>
            </div>

            <!-- Source -->
            <div>
                <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Source</label>
                <div class="relative">
                     <Smartphone class="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                     <select v-model="form.trigger_source" class="w-full pl-9 pr-2 py-2 border border-gray-300 rounded focus:ring-blue-500 bg-white text-sm">
                         <option value="Manual">Manual Entry</option>
                         <option value="Phone">Phone Call</option>
                         <option value="Email">Email</option>
                         <option value="Text">Text Message</option>
                         <option value="In Person">In Person</option>
                     </select>
                </div>
            </div>

        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
             <div>
                 <button v-if="opportunity" @click="handleDelete" class="text-red-500 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded">Delete</button>
             </div>
             <div class="flex gap-3">
                <button @click="handleClose" class="px-4 py-2 hover:bg-gray-200 rounded text-sm font-bold text-gray-600 transition">Cancel</button>
                <button @click="handleSave" :disabled="saving" class="px-6 py-2 bg-slate-900 text-white rounded shadow text-sm font-bold hover:bg-slate-700 flex items-center transition disabled:opacity-50">
                    <Save size="16" class="mr-2" />
                    {{ saving ? 'Saving...' : (opportunity ? 'Save Changes' : 'Create Opportunity') }}
                </button>
             </div>
        </div>

    </div>
  </div>
</template>
