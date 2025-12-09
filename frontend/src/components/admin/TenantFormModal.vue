<script setup>
import { ref, reactive, watch } from 'vue'
import { useTenants } from '../../composables/useTenants'
import { X, Check } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'saved'])

const { createTenantWithAdmin } = useTenants()

const saving = ref(false)
const form = reactive({
    name: '',
    first: '',
    last: '',
    email: '',
    password: ''
})

const resetForm = () => {
    form.name = ''
    form.first = ''
    form.last = ''
    form.email = ''
    form.password = ''
}

const handleSave = async () => {
    if (!form.name || !form.first || !form.last || !form.email || !form.password) {
        return alert("Please fill in all fields.")
    }

    saving.value = true

    const result = await createTenantWithAdmin({
        tenantName: form.name,
        firstName: form.first,
        lastName: form.last,
        email: form.email,
        password: form.password
    })

    saving.value = false

    if (!result.success) {
        alert("Error: " + result.error)
        return
    }

    alert("Tenant created successfully!")
    emit('saved')
    emit('close')
    resetForm()
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

watch(() => props.isOpen, (open) => {
    if (open) {
        resetForm()
        initialState.value = getSnapshot()
    }
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="handleClose">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
        
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">Create New Tenant</h3>
            <button @click="handleClose" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <div class="p-6 space-y-4 bg-slate-50/50">
            <div>
                 <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Tenant Name</label>
                 <input v-model="form.name" class="w-full border p-2 rounded focus:ring-1 focus:ring-blue-500" placeholder="e.g. Acme Properties">
            </div>

            <div class="pt-4 border-t border-gray-100">
                 <h4 class="text-sm font-bold text-slate-700 mb-3">Administrator Details</h4>
                 <div class="grid grid-cols-2 gap-4 mb-4">
                     <div>
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">First Name</label>
                         <input v-model="form.first" class="w-full border p-2 rounded" placeholder="John">
                     </div>
                     <div>
                         <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Last Name</label>
                         <input v-model="form.last" class="w-full border p-2 rounded" placeholder="Doe">
                     </div>
                 </div>
                 <div class="mb-4">
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
                     <input v-model="form.email" type="email" class="w-full border p-2 rounded" placeholder="admin@acme.com">
                 </div>
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Password</label>
                     <input v-model="form.password" type="password" class="w-full border p-2 rounded" placeholder="••••••••">
                 </div>
            </div>
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
             <button @click="handleClose" class="px-4 py-2 hover:bg-gray-200 rounded text-sm font-bold text-gray-600 transition">Cancel</button>
             <button @click="handleSave" :disabled="saving" class="px-6 py-2 bg-indigo-600 text-white rounded shadow text-sm font-bold hover:bg-indigo-700 flex items-center transition disabled:opacity-50">
                 <Check size="16" class="mr-2" />
                 {{ saving ? 'Creating...' : 'Create Tenant' }}
             </button>
        </div>

    </div>
  </div>
</template>
