<script setup>
import { ref, watch, reactive } from 'vue'
import { supabase } from '../../lib/supabase'
import { useJobTemplates } from '../../composables/useJobTemplates'
import { X, Save, Plus, GripVertical, Trash2, Book, CheckSquare, PenTool } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import TaskLibraryModal from './TaskLibraryModal.vue'

const props = defineProps({
  isOpen: Boolean,
  template: Object
})

const emit = defineEmits(['close', 'saved'])

// Composables
const { saveTemplate, archiveTemplate, restoreTemplate } = useJobTemplates()

const saving = ref(false)
const showLibrary = ref(false)
const allRoles = ref([])
const selectedRoleIds = ref([])

// Form State
const form = reactive({
    name: '',
    name_es: '',
    description: '',
    description_es: '',
    tasks: []
})

// Fetch available roles
const fetchRoles = async () => {
    const { data } = await supabase
        .from('roles')
        .select('id, name')
        .order('name')
    allRoles.value = data || []
}

// Fetch existing template roles
const fetchTemplateRoles = async (templateId) => {
    const { data } = await supabase
        .from('job_template_roles')
        .select('role_id')
        .eq('job_template_id', templateId)
    selectedRoleIds.value = (data || []).map(r => r.role_id)
}

// Load
watch(() => props.isOpen, async (open) => {
    if (open) {
        await fetchRoles()
        
        if (props.template) {
            form.name = props.template.name
            form.name_es = props.template.name_es
            form.description = props.template.description
            form.description_es = props.template.description_es
            
            // Deep copy tasks to detach from prop
            form.tasks = (props.template.job_template_tasks || [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(t => ({
                    ...t,
                    checklist: (t.job_template_checklist_items || t.checklist || [])
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(c => ({...c})), // Copy checklist
                    id: t.id // Keep ID for potential updates
                }))
            
            await fetchTemplateRoles(props.template.id)
        } else {
            resetForm()
            selectedRoleIds.value = []
        }
        initialState.value = getSnapshot()
    }
})

const resetForm = () => {
    form.name = ''
    form.name_es = ''
    form.description = ''
    form.description_es = ''
    form.tasks = []
}

// Actions
const addTask = () => {
    form.tasks.push({
        title: '', description: '', title_es: '', description_es: '',
        is_required: true, require_photo: false,
        checklist: [],
        id: null // New task
    })
}

const addChecklistItem = (taskIndex) => {
    const task = form.tasks[taskIndex]
    task.checklist.push({
        description: '', description_es: '', item_type: 'simple', 
        sort_order: task.checklist.length
    })
}

const removeTask = (index) => {
    form.tasks.splice(index, 1)
}

const removeChecklistItem = (taskIndex, itemIndex) => {
    form.tasks[taskIndex].checklist.splice(itemIndex, 1)
}

const handleLibrarySelect = (taskData) => {
    form.tasks.push({
        ...taskData,
        checklist: [], // Ensure checklist array exists
        id: null
    })
}

const handleSave = async () => {
    if (!form.name || !form.name_es) return alert("Template Names (EN/ES) required")
    if (form.tasks.some(t => !t.title || !t.title_es)) return alert("All tasks must have titles (EN/ES)")
    
    saving.value = true

    try {
        const result = await saveTemplate({
            id: props.template?.id,
            name: form.name,
            name_es: form.name_es,
            description: form.description,
            description_es: form.description_es,
            tasks: form.tasks
        })

        if (!result.success) throw new Error(result.error)
        
        const templateId = result.templateId || props.template?.id
        
        // Save role assignments
        if (templateId) {
            // Delete existing
            await supabase
                .from('job_template_roles')
                .delete()
                .eq('job_template_id', templateId)
            
            // Insert new
            if (selectedRoleIds.value.length > 0) {
                await supabase
                    .from('job_template_roles')
                    .insert(selectedRoleIds.value.map(roleId => ({
                        job_template_id: templateId,
                        role_id: roleId
                    })))
            }
        }
        
        emit('saved')
        emit('close')

    } catch (e) {
        alert("Error saving: " + e.message)
        console.error(e)
    } finally {
        saving.value = false
    }
}

const handleArchive = async () => {
    if (!confirm("Archive this template?")) return
    const result = await archiveTemplate(props.template.id)
    if (!result.success) alert(result.error)
    else { emit('saved'); emit('close'); }
}

const handleRestore = async () => {
    if (!confirm("Restore this template?")) return
    const result = await restoreTemplate(props.template.id)
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
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">{{ template ? 'Edit Job Template' : 'New Job Template' }}</h3>
            <button @click="handleClose" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <!-- Main Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
             
             <!-- Header Fields -->
             <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Name (EN)</label>
                         <input v-model="form.name" class="w-full border p-2 rounded text-base font-bold focus:ring-1 focus:ring-blue-500" placeholder="e.g. Standard Cleaning">
                     </div>
                     <div>
                         <label class="block text-xs font-bold uppercase text-blue-500 mb-1">Name (ES)</label>
                         <input v-model="form.name_es" class="w-full border border-blue-100 p-2 rounded text-base font-bold focus:ring-1 focus:ring-blue-500" placeholder="e.g. Limpieza Estándar">
                     </div>
                 </div>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Description (EN)</label>
                         <textarea v-model="form.description" class="w-full border p-2 rounded text-sm h-20 resize-none" placeholder="What is this job for?"></textarea>
                     </div>
                     <div>
                         <label class="block text-xs font-bold uppercase text-blue-500 mb-1">Description (ES)</label>
                         <textarea v-model="form.description_es" class="w-full border border-blue-100 p-2 rounded text-sm h-20 resize-none" placeholder="¿Para qué es este trabajo?"></textarea>
                     </div>
                 </div>
                 
                 <!-- Required Roles -->
                 <div class="border-t border-gray-100 pt-4 mt-4">
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Required Roles (for assignment)</label>
                     <div class="flex flex-wrap gap-2">
                         <label 
                             v-for="role in allRoles" 
                             :key="role.id"
                             class="flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer select-none transition-colors"
                             :class="selectedRoleIds.includes(role.id) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                         >
                             <input 
                                 type="checkbox" 
                                 :value="role.id" 
                                 v-model="selectedRoleIds"
                                 class="hidden"
                             />
                             <span class="text-sm font-medium">{{ role.name }}</span>
                         </label>
                     </div>
                     <p v-if="selectedRoleIds.length === 0" class="text-xs text-gray-400 mt-1 italic">
                         No roles selected = anyone can be assigned
                     </p>
                 </div>
             </div>

             <!-- Tasks Header -->
             <div class="flex justify-between items-center pt-2">
                 <h4 class="font-bold text-slate-700 uppercase text-sm">Tasks</h4>
                 <div class="flex gap-2">
                     <button @click="showLibrary = true" class="text-xs font-bold bg-white border border-gray-200 text-slate-600 px-3 py-1.5 rounded hover:bg-gray-50 shadow-sm flex items-center transition">
                         <Book size="14" class="mr-2"/> Library
                     </button>
                     <button @click="addTask" class="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 flex items-center transition">
                         <Plus size="14" class="mr-2"/> Add Task
                     </button>
                 </div>
             </div>

             <!-- Task List (Draggable) -->
             <draggable 
                v-model="form.tasks" 
                item-key="id" 
                handle=".drag-handle"
                class="space-y-4"
                ghost-class="opacity-50"
             >
                <template #item="{ element: task, index }">
                    <div class="bg-white rounded-lg border border-gray-200 shadow-sm group relative">
                        <!-- Task Header/Handle -->
                        <div class="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-gray-50 rounded-l-lg border-r border-gray-100 drag-handle">
                            <GripVertical size="16" class="text-gray-300" />
                        </div>

                        <div class="pl-12 pr-4 py-4 space-y-4">
                            <!-- Task Row 1: Titles -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-[10px] font-bold uppercase text-gray-400 mb-1">Task Title (EN) <span class="text-red-400">*</span></label>
                                    <input v-model="task.title" class="w-full border p-1.5 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500" placeholder="Task Title">
                                    <textarea v-model="task.description" class="w-full border p-1.5 rounded text-xs mt-1 resize-none h-14" placeholder="Description"></textarea>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold uppercase text-blue-400 mb-1">Title (ES) <span class="text-red-400">*</span></label>
                                    <input v-model="task.title_es" class="w-full border border-blue-100 p-1.5 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500" placeholder="Título">
                                    <textarea v-model="task.description_es" class="w-full border border-blue-100 p-1.5 rounded text-xs mt-1 resize-none h-14" placeholder="Descripción"></textarea>
                                </div>
                            </div>

                            <!-- Options -->
                            <div class="flex gap-4 border-b border-gray-100 pb-3">
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                                    <input type="checkbox" v-model="task.is_required" class="rounded text-blue-600 focus:ring-0"> Required
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                                    <input type="checkbox" v-model="task.require_photo" class="rounded text-blue-600 focus:ring-0"> Photo Required
                                </label>
                            </div>

                            <!-- Checklist -->
                            <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-[10px] font-bold uppercase text-slate-400">Checklist Items</span>
                                    <button @click="addChecklistItem(index)" class="text-[10px] font-bold text-blue-500 hover:text-blue-700">+ Add Item</button>
                                </div>
                                <div class="space-y-2">
                                    <div v-for="(item, cIdx) in task.checklist" :key="cIdx" class="flex gap-2 items-start group/check">
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                                            <input v-model="item.description" class="w-full border p-1 rounded text-xs" placeholder="Item (EN)">
                                            <input v-model="item.description_es" class="w-full border border-blue-50 p-1 rounded text-xs" placeholder="Item (ES)">
                                        </div>
                                        <select v-model="item.item_type" class="border p-1 rounded text-xs h-7 bg-white text-slate-600">
                                            <option value="simple">Check</option>
                                            <option value="input">Input</option>
                                        </select>
                                        <button @click="removeChecklistItem(index, cIdx)" class="text-gray-300 hover:text-red-400 pt-1"><X size="14"/></button>
                                    </div>
                                    <div v-if="task.checklist.length === 0" class="text-center text-xs text-gray-400 italic py-1">No items.</div>
                                </div>
                            </div>

                        </div>

                        <!-- Delete Task -->
                        <button @click="removeTask(index)" class="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 transition">
                            <Trash2 size="16" />
                        </button>
                    </div>
                </template>
             </draggable>

             <div v-if="form.tasks.length === 0" class="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                 <p class="text-gray-400 text-sm font-medium">No tasks defined yet.</p>
                 <button @click="addTask" class="mt-2 text-blue-600 font-bold text-sm hover:underline">Add your first task</button>
             </div>

        </div>

        <!-- Footer -->
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
             <div>
                 <button v-if="template && !template.deleted_at" @click="handleArchive" class="text-red-500 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded flex items-center">
                     <Trash2 size="16" class="mr-2" /> Archive
                 </button>
                 <button v-if="template && template.deleted_at" @click="handleRestore" class="text-green-600 text-sm font-bold hover:bg-green-50 px-3 py-2 rounded flex items-center">
                     <Plus size="16" class="mr-2" /> Restore
                 </button>
             </div>
             <div class="flex gap-3">
                 <button @click="handleClose" class="px-4 py-2 hover:bg-gray-200 rounded text-sm font-bold text-gray-600 transition">Cancel</button>
                 <button @click="handleSave" :disabled="saving" class="px-6 py-2 bg-slate-900 text-white rounded shadow text-sm font-bold hover:bg-slate-700 flex items-center transition disabled:opacity-50">
                     <Save size="16" class="mr-2" />
                     {{ saving ? 'Saving...' : 'Save Template' }}
                 </button>
             </div>
        </div>
    </div>

    <TaskLibraryModal :is-open="showLibrary" @close="showLibrary = false" @select="handleLibrarySelect" />
  </div>
</template>
