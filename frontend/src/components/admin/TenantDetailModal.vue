<script setup>
import { ref, watch, reactive, computed } from 'vue'
import AuditHistory from '../AuditHistory.vue'
import { supabase } from '../../lib/supabase'
import { X, Pencil, Trash2, Plus, ArrowRight } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  tenant: Object
})

const emit = defineEmits(['close', 'saved'])

const admins = ref([])
const loadingAdmins = ref(false)
const editMode = ref(false)

const form = reactive({ name: '' })

// Admin Form
const showAdminForm = ref(false)
const adminForm = reactive({ id: null, first: '', last: '', email: '', password: '' })

watch(() => props.isOpen, (open) => {
    if (open && props.tenant) {
        fetchAdmins()
        form.name = props.tenant.name
        editMode.value = false
        showAdminForm.value = false
    }
})

const fetchAdmins = async () => {
    loadingAdmins.value = true
    const { data } = await supabase.rpc('get_tenant_users', { p_tenant_id: props.tenant.id })
    admins.value = data || []
    loadingAdmins.value = false
}

const updateName = async () => {
    if (!form.name) return
    const { error } = await supabase.rpc('update_tenant', {
        p_tenant_id: props.tenant.id,
        p_name: form.name
    })
    if (error) alert(error.message)
    else {
        alert("Updated!")
        emit('saved') // Should refresh parent list, but we keep modal open
    }
}

const deleteTenant = async () => {
    const check = prompt("Type DELETE to confirm archiving this tenant:")
    if (check !== 'DELETE') return

    const { error } = await supabase.rpc('delete_tenant', {
        p_tenant_id: props.tenant.id
    })
    if (error) alert(error.message)
    else {
        alert("Tenant Archived")
        emit('saved')
        emit('close')
    }
}

// Admin Logic
const openAdminForm = (u = null) => {
    if (u) {
        adminForm.id = u.id
        adminForm.first = u.first_name
        adminForm.last = u.last_name
        adminForm.email = u.email
        adminForm.password = ''
    } else {
        adminForm.id = null
        adminForm.first = ''
        adminForm.last = ''
        adminForm.email = ''
        adminForm.password = ''
    }
    showAdminForm.value = true
}

const saveAdmin = async () => {
    const op = adminForm.id ? 'UPDATE' : 'CREATE'
    const { error } = await supabase.rpc('manage_tenant_user', {
        p_operation: op,
        p_tenant_id: props.tenant.id,
        p_user_id: adminForm.id || null,
        p_email: adminForm.email,
        p_password: adminForm.password || null,
        p_first: adminForm.first,
        p_last: adminForm.last
    })

    if (error) alert(error.message)
    else {
        showAdminForm.value = false
        fetchAdmins()
    }
}

const deleteAdmin = async (uid) => {
    if (!confirm("Remove this admin user?")) return
    const { error } = await supabase.rpc('manage_tenant_user', {
        p_operation: 'DELETE',
        p_tenant_id: props.tenant.id,
        p_user_id: uid
    })
    if (error) alert(error.message)
    else fetchAdmins()
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <div>
                <h2 class="text-xl font-bold text-slate-900">{{ tenant.name }}</h2>
                <div class="text-xs text-slate-500 font-mono">ID: {{ tenant.id }}</div>
            </div>
            <div class="flex items-center gap-2">
                <button @click="editMode = !editMode" class="text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50">
                    <Pencil size="20" />
                </button>
                <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
            </div>
        </div>

        <div class="p-6 overflow-y-auto flex-1 space-y-8">
            
            <!-- Details -->
            <div class="space-y-4">
                 <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-gray-100 pb-2">Tenant Details</h4>
                 <div v-if="editMode" class="flex gap-4 items-end">
                     <div class="flex-1">
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Name</label>
                         <input v-model="form.name" class="w-full p-2 border rounded">
                     </div>
                     <button @click="updateName" class="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded">Update</button>
                 </div>
                 <div v-else class="grid grid-cols-2 gap-4">
                     <div>
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Name</label>
                         <div class="text-sm font-medium">{{ tenant.name }}</div>
                     </div>
                     <div>
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Created</label>
                         <div class="text-sm text-gray-600">{{ new Date(tenant.created_at).toLocaleDateString() }}</div>
                     </div>
                 </div>
            </div>

            <!-- Admins -->
            <div class="space-y-4">
                 <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                     <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">Administrators</h4>
                     <button v-if="editMode" @click="openAdminForm()" class="text-xs font-bold text-indigo-600 flex items-center gap-1">
                         <Plus size="14" /> Add Admin
                     </button>
                 </div>

                 <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                     <table class="w-full text-left text-xs">
                         <thead class="bg-gray-100 text-gray-500 font-medium">
                             <tr>
                                 <th class="px-4 py-2">Name</th>
                                 <th class="px-4 py-2">Email</th>
                                 <th v-if="editMode" class="px-4 py-2 text-right">Actions</th>
                             </tr>
                         </thead>
                         <tbody class="divide-y divide-gray-200">
                             <tr v-for="u in admins" :key="u.id">
                                 <td class="px-4 py-2 font-medium">{{ u.first_name }} {{ u.last_name }}</td>
                                 <td class="px-4 py-2 font-mono text-gray-500">{{ u.email }}</td>
                                 <td v-if="editMode" class="px-4 py-2 text-right flex justify-end gap-2">
                                     <button @click="openAdminForm(u)" class="text-blue-600 hover:underline">Edit</button>
                                     <button @click="deleteAdmin(u.id)" class="text-red-600 hover:underline">Remove</button>
                                 </td>
                             </tr>
                             <tr v-if="admins.length === 0">
                                 <td colspan="3" class="px-4 py-4 text-center text-gray-400 italic">No admins found.</td>
                             </tr>
                         </tbody>
                     </table>
                 </div>

                 <!-- Admin Form -->
                 <div v-if="showAdminForm" class="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mt-4 animate-in fade-in">
                     <h5 class="text-xs font-bold text-indigo-800 mb-3 uppercase">{{ adminForm.id ? 'Edit Admin' : 'Add New Admin' }}</h5>
                     <div class="grid grid-cols-2 gap-3 mb-3">
                         <input v-model="adminForm.first" placeholder="First Name" class="p-2 border rounded text-sm">
                         <input v-model="adminForm.last" placeholder="Last Name" class="p-2 border rounded text-sm">
                     </div>
                     <div class="grid grid-cols-2 gap-3 mb-3">
                         <input v-model="adminForm.email" placeholder="Email" class="p-2 border rounded text-sm">
                         <input v-model="adminForm.password" placeholder="Password (empty to keep)" type="password" class="p-2 border rounded text-sm">
                     </div>
                     <div class="flex justify-end gap-2">
                         <button @click="showAdminForm = false" class="px-3 py-1 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
                         <button @click="saveAdmin" class="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded">Save Admin</button>
                     </div>
                 </div>
            </div>

            <!-- Danger -->
            <div v-if="editMode" class="pt-8 mt-8 border-t border-red-100">
                 <h4 class="text-sm font-bold text-red-700 uppercase tracking-wide mb-2">Danger Zone</h4>
                 <div class="bg-red-50 border border-red-100 rounded-lg p-4 flex justify-between items-center">
                     <div>
                         <div class="font-bold text-red-900 text-sm">Delete Tenant</div>
                         <div class="text-red-600 text-xs">Archive this tenant (Soft Delete).</div>
                     </div>
                     <button @click="deleteTenant" class="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded hover:bg-red-600 hover:text-white transition-colors">
                         Delete Tenant
                     </button>
                 </div>
            </div>

            <div class="mt-6 pt-6 border-t border-gray-100">
                <AuditHistory table-name="tenants" :record-id="tenant.id" />
            </div>

        </div>
    </div>
  </div>
</template>
