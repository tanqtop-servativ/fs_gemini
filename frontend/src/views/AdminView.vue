<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import { Plus, Eye, VenetianMask, ShieldAlert } from 'lucide-vue-next'
import TenantFormModal from '../components/admin/TenantFormModal.vue'
import TenantDetailModal from '../components/admin/TenantDetailModal.vue'

const { userProfile, loading: authLoading, isImpersonating, effectiveTenantName, impersonateTenant, stopImpersonating } = useAuth()
const tenants = ref([])
const loading = ref(true)

// Modals
const showForm = ref(false)
const showDetail = ref(false)
const selectedTenant = ref(null)

const isSuperuser = computed(() => userProfile.value?.is_superuser)

const handleSwitch = async (tenantId) => {
    await impersonateTenant(tenantId)
}

const fetchData = async () => {
    loading.value = true
    if (!isSuperuser.value) {
        loading.value = false
        return
    }

    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    if (error) console.error(error)
    tenants.value = data || []
    loading.value = false
}

// Watch for auth load
watch(() => userProfile.value, (val) => {
    if (val) fetchData()
}, { immediate: true })

// Actions
const openNew = () => {
    showForm.value = true
}

const openDetail = (t) => {
    selectedTenant.value = t
    showDetail.value = true
}

const handleSaved = () => {
    fetchData()
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    
    <div v-if="authLoading" class="text-center py-10 text-gray-400">Loading Auth...</div>
    
    <div v-else-if="!isSuperuser" class="flex flex-col items-center justify-center flex-1 text-center p-10">
        <ShieldAlert size="48" class="text-red-500 mb-4" />
        <h1 class="text-xl font-bold text-slate-800 mb-2">Access Denied</h1>
        <p class="text-gray-500">You do not have permission to view this page.</p>
    </div>

    <div v-else class="flex flex-col flex-1 min-h-0">
        <!-- Header -->
        <div class="mb-6 flex justify-between items-center">
        <div>
            <h1 class="text-2xl font-bold text-slate-900">Superuser Dashboard</h1>
            <p class="text-gray-500 text-sm">Manage tenants and system settings</p>
        </div>
        
        <button 
            @click="openNew"
            class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-indigo-700 transition shadow-sm"
        >
            <Plus class="w-4 h-4 mr-2" />
            New Tenant
        </button>
        </div>

        <!-- Impersonation Banner -->
        <div v-if="isImpersonating" class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="bg-amber-100 p-2 rounded-full text-amber-600">
                    <VenetianMask class="w-5 h-5" />
                </div>
                <div>
                    <div class="font-bold text-amber-900">Impersonating: {{ effectiveTenantName }}</div>
                    <div class="text-xs text-amber-700">You are viewing the system as if you belong to this tenant.</div>
                </div>
            </div>
            <button @click="stopImpersonating" class="bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 px-4 py-2 rounded font-bold text-sm shadow-sm transition-colors">
                Stop Impersonating
            </button>
        </div>

        <!-- Table -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
        <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
            <tr>
                <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">ID</th>
                <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Tenant Name</th>
                <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Created At</th>
                <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
                <td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading tenants...</td>
            </tr>
            <tr v-else-if="tenants.length === 0">
                <td colspan="4" class="px-6 py-8 text-center text-gray-400">No tenants found.</td>
            </tr>

            <tr v-for="t in tenants" :key="t.id" class="group hover:bg-slate-50 transition-colors cursor-pointer" @click="openDetail(t)">
                <!-- ID -->
                <td class="px-6 py-4 font-mono text-xs text-gray-500">#{{ t.id }}</td>
                <!-- Name -->
                <td class="px-6 py-4 font-bold text-slate-900">{{ t.name }}</td>
                <!-- Created -->
                <td class="px-6 py-4 text-gray-500 text-sm">{{ new Date(t.created_at).toLocaleDateString() }}</td>
                <!-- Actions -->
                <td class="px-6 py-4 text-right flex justify-end gap-2" @click.stop>
                    <button @click="handleSwitch(t.id)" class="text-indigo-600 hover:text-indigo-800 transition-colors font-bold text-xs border border-indigo-200 rounded bg-indigo-50 hover:bg-indigo-100 px-2 py-1">
                        Switch
                    </button>
                    <button @click="openDetail(t)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition">
                        <Eye size="16" />
                    </button>
                </td>
            </tr>
            </tbody>
        </table>
        </div>
    </div>

    <TenantDetailModal 
        :is-open="showDetail" 
        :tenant="selectedTenant" 
        @close="showDetail = false" 
        @saved="handleSaved"
    />
    <TenantFormModal 
        :is-open="showForm" 
        @close="showForm = false" 
        @saved="handleSaved" 
    />

  </div>
</template>
