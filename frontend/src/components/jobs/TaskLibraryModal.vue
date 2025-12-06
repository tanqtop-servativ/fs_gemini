<script setup>
import { ref, watch } from 'vue'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../composables/useAuth'
import { X, Search, Plus, Book, Check } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'select'])

const tasks = ref([])
const loading = ref(false)
const searchQuery = ref('')
const showCreate = ref(false)

// Create Form
const newTitle = ref('')
const newTitleEs = ref('')
const newDesc = ref('')
const newDescEs = ref('')
const newReq = ref(false)
const newPhoto = ref(false)
const creating = ref(false)
const { effectiveTenantId } = useAuth()

watch(() => props.isOpen, (open) => {
  if (open) {
    fetchLibrary()
    showCreate.value = false
    searchQuery.value = ''
  }
})

const fetchLibrary = async () => {
    loading.value = true
    const { data } = await supabase.from('task_library').select('*').order('title')
    tasks.value = data || []
    loading.value = false
}

const handleSelect = (task) => {
    emit('select', {
        title: task.title,
        description: task.description,
        title_es: task.title_es,
        description_es: task.description_es,
        is_required: task.is_required,
        require_photo: task.require_photo,
        checklist: [] // Library tasks don't store checklists typically, or if they do, we'd copy them. Standard schema doesn't seem to have checklists on library yet? 
        // Original code: `if (!taskData.checklist) taskData.checklist = [];`
        // `openCreateLibTaskModal` payload didn't include checklist.
    })
    emit('close')
}

const saveNewTask = async () => {
    if (!newTitle.value) return alert("Title required")
    creating.value = true

    const tenantId = effectiveTenantId.value
    if (!tenantId) return alert('Tenant ID not found')

    const payload = {
        tenant_id: tenantId,
        title: newTitle.value,
        title_es: newTitleEs.value,
        description: newDesc.value,
        description_es: newDescEs.value,
        is_required: newReq.value,
        require_photo: newPhoto.value
    }

    const { error } = await supabase.from('task_library').insert(payload)
    creating.value = false
    
    if (error) alert(error.message)
    else {
        showCreate.value = false
        // Reset form
        newTitle.value = ''; newTitleEs.value = ''; newDesc.value = ''; newDescEs.value = '';
        fetchLibrary()
    }
}

// Filter
const filteredTasks = ref([])
watch([tasks, searchQuery], () => {
    if (!searchQuery.value) {
        filteredTasks.value = tasks.value
        return
    }
    const q = searchQuery.value.toLowerCase()
    filteredTasks.value = tasks.value.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.title_es && t.title_es.toLowerCase().includes(q))
    )
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <!-- Header -->
        <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <Book size="16" class="text-blue-600"/> Task Library
            </h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <!-- Create Mode -->
        <div v-if="showCreate" class="p-5 flex-1 overflow-y-auto bg-slate-50">
             <h4 class="font-bold text-sm text-slate-700 mb-4">Create New Library Task</h4>
             <div class="space-y-3 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                 <input v-model="newTitle" placeholder="Title (EN)" class="w-full border p-2 rounded text-sm focus:ring-1 focus:ring-blue-500">
                 <input v-model="newTitleEs" placeholder="Título (ES)" class="w-full border p-2 rounded text-sm focus:ring-1 focus:ring-blue-500">
                 <textarea v-model="newDesc" placeholder="Description (EN)" class="w-full border p-2 rounded text-sm h-20 resize-none"></textarea>
                 <textarea v-model="newDescEs" placeholder="Descripción (ES)" class="w-full border p-2 rounded text-sm h-20 resize-none"></textarea>
                 <div class="flex gap-4 pt-2">
                     <label class="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" v-model="newReq" class="rounded text-blue-600"> Required</label>
                     <label class="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" v-model="newPhoto" class="rounded text-blue-600"> Photo Required</label>
                 </div>
             </div>
             <div class="flex justify-end gap-2 mt-4">
                 <button @click="showCreate = false" class="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
                 <button @click="saveNewTask" :disabled="creating" class="px-6 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50">Save Task</button>
             </div>
        </div>

        <!-- List Mode -->
        <div v-else class="flex flex-col flex-1 overflow-hidden">
            <div class="p-4 border-b border-gray-100 bg-white">
                <div class="relative">
                    <Search class="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input v-model="searchQuery" class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" placeholder="Search saved tasks...">
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
                <div v-if="loading" class="text-center text-gray-400 text-sm py-8">Loading library...</div>
                <div v-else-if="filteredTasks.length === 0" class="text-center text-gray-400 text-sm py-8">No tasks found.</div>
                
                <div 
                    v-for="task in filteredTasks" 
                    :key="task.id"
                    class="p-3 hover:bg-slate-50 border border-transparent hover:border-blue-100 rounded-lg group transition-all cursor-pointer flex justify-between items-start"
                    @click="handleSelect(task)"
                >
                    <div>
                        <div class="font-bold text-sm text-slate-800">{{ task.title }}</div>
                        <div class="text-xs text-gray-500 line-clamp-1">{{ task.description }}</div>
                        <div v-if="task.title_es" class="text-[10px] text-blue-500 mt-1 font-medium">{{ task.title_es }}</div>
                    </div>
                    <button class="text-blue-600 hover:bg-blue-100 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size="16" />
                    </button>
                </div>
            </div>

            <div class="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                 <span class="text-[10px] text-gray-400">Standardize your operations.</span>
                 <button @click="showCreate = true" class="text-xs font-bold text-blue-600 hover:underline flex items-center">
                     <Plus size="12" class="mr-1"/> Create New Task
                 </button>
            </div>
        </div>

    </div>
  </div>
</template>
