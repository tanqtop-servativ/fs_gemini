<script setup>
import { ref, watch } from 'vue'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../composables/useAuth'
import { X, Plus, Pencil, Trash2, RotateCcw, GripVertical } from 'lucide-vue-next'
import draggable from 'vuedraggable'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const roles = ref([])
const loading = ref(false)
const showArchived = ref(false)

// Edit State
const editingRole = ref(null) // null = none, {} = new, {id} = edit
const formName = ref('')
const formDesc = ref('')
const saving = ref(false)
const { effectiveTenantId } = useAuth()

watch(() => [props.isOpen, showArchived.value], async ([open]) => {
  if (open) {
    loading.value = true
    await fetchRoles()
    loading.value = false
    editingRole.value = null
  }
}, { immediate: true })

const fetchRoles = async () => {
    let query = supabase.from('roles').select('*').order('sort_order')
    if (!showArchived.value) query = query.is('deleted_at', null)
    
    const { data } = await query
    roles.value = data || []
}

const startEdit = (role) => {
    editingRole.value = role || {} // empty obj for new
    formName.value = role ? role.name : ''
    formDesc.value = role ? role.description : ''
}

const saveRole = async () => {
    if (!formName.value) return
    saving.value = true
    
    const tenantId = effectiveTenantId.value

    const payload = {
        name: formName.value,
        description: formDesc.value,
        tenant_id: tenantId 
    }

    try {
        if (editingRole.value.id) {
             const { error } = await supabase.from('roles').update(payload).eq('id', editingRole.value.id)
             if (error) throw error
        } else {
             // New role - set sort_order to end
             payload.sort_order = roles.value.length
             const { error } = await supabase.from('roles').insert(payload)
             if (error) throw error
        }
        editingRole.value = null
        fetchRoles()
    } catch (e) {
        alert(e.message)
    } finally {
        saving.value = false
    }
}

const toggleArchive = async (role) => {
    const isDeleted = !!role.deleted_at
    if (!confirm(isDeleted ? "Restore?" : "Archive?")) return
    
    const updates = { deleted_at: isDeleted ? null : new Date().toISOString() }
    await supabase.from('roles').update(updates).eq('id', role.id)
    fetchRoles()
}

// Handle drag reorder
const onDragEnd = async () => {
    // Update sort_order for all roles based on new array positions
    const updates = roles.value.map((role, index) => ({
        id: role.id,
        sort_order: index
    }))

    // Batch update
    for (const update of updates) {
        await supabase.from('roles').update({ sort_order: update.sort_order }).eq('id', update.id)
    }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">Manage Roles</h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" v-model="showArchived" class="rounded border-gray-300 text-black focus:ring-0">
                Show Archived
            </label>
            <button @click="startEdit(null)" class="bg-black text-white px-3 py-1.5 rounded text-xs font-bold flex items-center hover:bg-gray-800">
                <Plus size="14" class="mr-1"/> New Role
            </button>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-2">
            
            <!-- Editor (Inline at top if active) -->
            <div v-if="editingRole" class="bg-white border border-blue-200 shadow-md rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                 <h4 class="text-xs font-bold uppercase text-blue-500 mb-2">{{ editingRole.id ? 'Edit Role' : 'New Role' }}</h4>
                 <div class="space-y-3">
                     <input v-model="formName" placeholder="Role Name" class="w-full border p-2 rounded text-sm font-bold">
                     <input v-model="formDesc" placeholder="Description" class="w-full border p-2 rounded text-sm text-gray-600">
                     <div class="flex justify-end gap-2">
                         <button @click="editingRole = null" class="text-xs font-bold text-gray-500 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                         <button @click="saveRole" :disabled="saving" class="text-xs font-bold text-white px-3 py-1 bg-blue-600 rounded hover:bg-blue-700">
                             {{ saving ? 'Saving...' : 'Save' }}
                         </button>
                     </div>
                 </div>
            </div>

            <div v-if="loading" class="text-center text-gray-400 text-sm py-4">Loading...</div>
            
            <draggable 
                v-model="roles"
                item-key="id"
                handle=".drag-handle"
                class="space-y-2"
                ghost-class="opacity-50"
                @end="onDragEnd"
            >
                <template #item="{ element: role }">
                    <div 
                        class="bg-white border border-gray-100 rounded-lg p-3 flex items-center group transition shadow-sm"
                        :class="{ 'opacity-60 bg-gray-50': role.deleted_at }"
                    >
                        <!-- Drag Handle -->
                        <div class="mr-3 cursor-grab active:cursor-grabbing drag-handle text-gray-300 hover:text-gray-500">
                            <GripVertical size="16" />
                        </div>

                        <!-- Content -->
                        <div class="flex-1">
                            <div class="font-bold text-sm text-slate-800 flex items-center gap-2">
                                {{ role.name }}
                                <span v-if="role.deleted_at" class="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase">Archived</span>
                            </div>
                            <div class="text-xs text-gray-500">{{ role.description || 'No description' }}</div>
                        </div>

                        <!-- Actions -->
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button @click="startEdit(role)" class="p-1.5 hover:bg-blue-50 text-blue-600 rounded" title="Edit">
                                <Pencil size="14" />
                            </button>
                            <button @click="toggleArchive(role)" class="p-1.5 hover:bg-red-50 text-red-500 rounded" :title="role.deleted_at ? 'Restore' : 'Archive'">
                                <component :is="role.deleted_at ? RotateCcw : Trash2" size="14" />
                            </button>
                        </div>
                    </div>
                </template>
            </draggable>
        </div>

    </div>
  </div>
</template>
