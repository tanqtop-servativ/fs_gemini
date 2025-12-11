<script setup>
import { ref, watch, reactive, onMounted, onUnmounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { usePeople } from '../../composables/usePeople'
import { X, Save, Check, UserPlus, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  person: Object
})

const emit = defineEmits(['close', 'saved'])

// Composables
const { createUserLogin, createPerson, updatePerson, assignRoles, archivePerson } = usePeople()

// State
const loading = ref(false)
const saving = ref(false)
const roles = ref([])

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  color: '#3B82F6',
  role_ids: [],
  create_user: false,
  auth_method: 'invite', // invite, manual
  password: ''
})

// Reset & Load
watch(() => props.isOpen, async (open) => {
  if (open) {
    loading.value = true
    resetForm()
    
    // Fetch Roles
    const { data } = await supabase.from('roles').select('id, name')
        .order('name')
    roles.value = data || []

    if (props.person) {
      loadPerson(props.person)
    }
    initialState.value = getSnapshot()
    loading.value = false
  }
})

const resetForm = () => {
    form.first_name = ''
    form.last_name = ''
    form.email = ''
    form.color = '#3B82F6'
    form.role_ids = []
    form.create_user = false
    form.auth_method = 'invite'
    form.password = ''
}

const loadPerson = (p) => {
    form.first_name = p.first_name
    form.last_name = p.last_name
    form.email = p.email
    form.color = p.color || '#3B82F6'
    form.role_ids = p.role_ids || []
}

const handleSave = async () => {
    if (!form.first_name || !form.email) return alert("Name and Email required")
    if (!form.role_ids.length) return alert("At least one role must be selected")
    
    if (form.create_user && form.auth_method === 'manual' && form.password.length < 6) {
        return alert("Password must be at least 6 characters")
    }

    saving.value = true
    try {
        let userId = props.person?.user_id || null

        // 1. Create User Login (if needed)
        if (form.create_user && !userId) {
            const userResult = await createUserLogin({
                email: form.email,
                password: form.password,
                invite: form.auth_method === 'invite'
            })
            if (!userResult.success) throw new Error(userResult.error)
            userId = userResult.userId
        }

        // 2. Save Person
        if (props.person) {
            // Update existing person
            const result = await updatePerson({
                id: props.person.id,
                first_name: form.first_name,
                last_name: form.last_name,
                email: form.email,
                color: form.color,
                role_ids: form.role_ids
            })
            if (!result.success) throw new Error(result.error)
        } else {
            // Create new person
            const result = await createPerson({
                first_name: form.first_name,
                last_name: form.last_name,
                email: form.email,
                color: form.color,
                userId
            })
            if (!result.success) throw new Error(result.error)

            // Assign Roles (if any)
            if (form.role_ids.length > 0 && result.personId) {
                const roleResult = await assignRoles({
                    personId: result.personId,
                    roleIds: form.role_ids,
                    personData: {
                        first_name: form.first_name,
                        last_name: form.last_name,
                        email: form.email
                    }
                })
                if (!roleResult.success) throw new Error(roleResult.error)
            }
        }

        emit('saved')
        emit('close')

    } catch (e) {
        alert("Error: " + e.message)
        console.error(e)
    } finally {
        saving.value = false
    }
}

const handleArchive = async () => {
    if (!confirm("Archive this person?")) return
    const result = await archivePerson(props.person.id)
    if (!result.success) alert(result.error)
    else {
        emit('saved')
        emit('close')
    }
}

// Unsaved Changes Check
const initialState = ref('')

const getSnapshot = () => JSON.stringify(form)

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
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">{{ person ? 'Edit Person' : 'New Person' }}</h3>
            <button @click="handleClose" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <div class="p-6 overflow-y-auto space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                     <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">First Name</label>
                     <input v-model="form.first_name" class="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <div>
                     <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Last Name</label>
                     <input v-model="form.last_name" class="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
            </div>
            
            <div>
                 <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Email</label>
                 <input v-model="form.email" type="email" class="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            </div>

            <!-- Roles -->
            <!-- Color Picker -->
            <div>
                 <label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Color</label>
                 <div class="flex items-center gap-3">
                     <!-- Clickable Color Preview (opens hidden color picker) -->
                     <label class="cursor-pointer">
                         <div :style="{ backgroundColor: form.color }" class="w-10 h-10 rounded-lg shadow-inner border border-gray-200 hover:border-gray-400 transition-colors"></div>
                         <input 
                             type="color" 
                             v-model="form.color" 
                             class="sr-only"
                         >
                     </label>
                     <!-- Hex Input -->
                     <input 
                         v-model="form.color" 
                         class="w-24 border p-2 rounded text-sm font-mono uppercase"
                         maxlength="7"
                         placeholder="#FFFFFF"
                     >
                 </div>
            </div>
            <div>
                 <label class="text-xs font-bold text-gray-500 uppercase mb-2 block">Assign Roles</label>
                 <div class="max-h-32 overflow-y-auto border border-gray-100 rounded p-2 bg-slate-50 grid grid-cols-3 gap-2">
                     <label v-for="role in roles" :key="role.id" class="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded">
                         <input type="checkbox" :value="role.id" v-model="form.role_ids" class="rounded border-gray-300 text-blue-600 focus:ring-0">
                         {{ role.name }}
                     </label>
                 </div>
            </div>

            <!-- User Creation (Only if new or no user_id) -->
            <div v-if="!person || !person.user_id" class="border-t border-gray-100 pt-4 mt-4">
                <label class="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" v-model="form.create_user" class="rounded border-gray-300 text-green-600 focus:ring-0">
                    <span class="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <UserPlus size="16" /> Create User Login?
                    </span>
                </label>

                <div v-if="form.create_user" class="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-3 animate-in slide-in-from-top-2">
                    <div class="flex gap-4 text-sm">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="invite" v-model="form.auth_method" class="text-indigo-600 focus:ring-0">
                            <span>Send Invite Email</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="manual" v-model="form.auth_method" class="text-indigo-600 focus:ring-0">
                            <span>Set Password</span>
                        </label>
                    </div>
                    
                    <div v-if="form.auth_method === 'manual'">
                        <input v-model="form.password" type="password" placeholder="Temporary Password (min 6 chars)" class="w-full border p-2 rounded text-sm">
                    </div>
                </div>
            </div>
            <div v-else class="mt-4 flex items-center text-green-600 text-sm font-bold bg-green-50 p-2 rounded border border-green-100">
                <Check size="16" class="mr-2"/> User Login Active
            </div>

        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
             <button v-if="person" @click="handleArchive" class="text-red-500 text-sm flex items-center gap-2 hover:bg-red-50 px-3 py-2 rounded transition">
                 <Trash2 size="16"/> Archive
             </button>
             <div v-else></div>

             <div class="flex gap-3">
                 <button @click="handleClose" class="px-4 py-2 hover:bg-gray-200 rounded text-sm font-bold text-gray-600 transition">Cancel</button>
                 <button @click="handleSave" :disabled="saving" class="px-6 py-2 bg-slate-900 text-white rounded shadow text-sm font-bold hover:bg-slate-700 flex items-center transition disabled:opacity-50">
                     <Save size="16" class="mr-2" />
                     {{ saving ? 'Saving...' : 'Save Person' }}
                 </button>
             </div>
        </div>

    </div>
  </div>
</template>
