<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { Plus, Eye, Mail, Shield, UserCircle } from 'lucide-vue-next'
import PersonDetailModal from '../components/people/PersonDetailModal.vue'
import PersonFormModal from '../components/people/PersonFormModal.vue'
import RolesManagerModal from '../components/people/RolesManagerModal.vue'
import SortableHeader from '../components/SortableHeader.vue'

// State
const router = useRouter()
const route = useRoute()
const people = ref([])
const roles = ref([])
const loading = ref(true)
const showArchived = ref(false)
const selectedRole = ref('')  // Empty = all roles

// Modals
const showDetail = ref(false)
const showForm = ref(false)
const showRoles = ref(false)
const selectedPerson = ref(null)

// Sorting
const sortKey = ref('last_name')
const sortDir = ref('asc')

const handleSort = (col) => {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col
    sortDir.value = 'asc'
  }
}

const sortedPeople = computed(() => {
  // First filter by role
  let filtered = people.value
  if (selectedRole.value) {
    filtered = filtered.filter(p => {
      const personRoles = (p.roles_display || '').split(', ').map(r => r.trim())
      return personRoles.includes(selectedRole.value)
    })
  }
  
  // Then sort
  return [...filtered].sort((a, b) => {
    let aVal = a[sortKey.value] || ''
    let bVal = b[sortKey.value] || ''
    
    // Handle name column specially (first_name + last_name)
    if (sortKey.value === 'name') {
      aVal = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
      bVal = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase()
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    if (aVal < bVal) return sortDir.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

// Actions
import { useAuth } from '../composables/useAuth'

const { userProfile, user, isTenantAdmin, impersonateUser } = useAuth()

const handleImpersonate = async (p) => {
    const fullName = `${p.first_name} ${p.last_name}`
    await impersonateUser(p.user_id, fullName)
}

const fetchData = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 

    loading.value = true

    // Fetch roles for filter dropdown
    const { data: rolesData } = await supabase.from('roles').select('id, name').order('name')
    roles.value = rolesData || []

    let query = supabase.from('people_enriched').select('*').order('last_name')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    
    if (!showArchived.value) query = query.is('deleted_at', null)

    const { data } = await query
    people.value = data || []
    checkRouteParam()
    loading.value = false
}

// Check if we need to open a specific person from URL
const checkRouteParam = () => {
    const id = route.query.id
    if (id && people.value.length > 0) {
        const p = people.value.find(x => x.id === id)
        if (p) {
            openDetail(p)
        }
    }
}

watch(showArchived, fetchData)
watch(() => route.query.id, () => {
    checkRouteParam()
})
watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchData()
}, { immediate: true })

// Handlers
const openDetail = (p) => {
    selectedPerson.value = p
    showDetail.value = true
}

const openNew = () => {
    selectedPerson.value = null
    showForm.value = true
}

const openEdit = (p) => {
    selectedPerson.value = p
    showDetail.value = false // close detail if open
    showForm.value = true
}

const handleSaved = () => {
    fetchData()
    showForm.value = false
    // If we were editing, we could re-open detail, but standard is back to list.
}

const handleRestore = async (p) => {
    if (!confirm("Restore this person?")) return
    await supabase.from('people').update({ deleted_at: null }).eq('id', p.id)
    showDetail.value = false
    fetchData()
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">People</h1>
        <p class="text-gray-500 text-sm">Manage staff, owners & users</p>
      </div>
      
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" v-model="showArchived" class="rounded border-gray-300 text-black focus:ring-0">
          Show Archived
        </label>
        
        <select 
          v-model="selectedRole" 
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All Roles</option>
          <option v-for="r in roles" :key="r.id" :value="r.name">{{ r.name }}</option>
        </select>
        
        <button 
          @click="showRoles = true"
          class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-50 transition shadow-sm"
        >
          <Shield class="w-4 h-4 mr-2" />
          Manage Roles
        </button>

        <button 
          @click="openNew"
          class="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-800 transition shadow-sm"
        >
          <Plus class="w-4 h-4 mr-2" />
          Add Person
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4"><SortableHeader column="name" :sortKey="sortKey" :sortDir="sortDir" @sort="handleSort">Name</SortableHeader></th>
            <th class="px-6 py-4"><SortableHeader column="roles_display" :sortKey="sortKey" :sortDir="sortDir" @sort="handleSort">Roles</SortableHeader></th>
            <th class="px-6 py-4"><SortableHeader column="email" :sortKey="sortKey" :sortDir="sortDir" @sort="handleSort">Contact</SortableHeader></th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
           <tr v-if="loading">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading people...</td>
           </tr>
           <tr v-else-if="people.length === 0">
             <td colspan="4" class="px-6 py-8 text-center text-gray-400">No people found.</td>
           </tr>

           <tr v-for="p in sortedPeople" :key="p.id" class="group hover:bg-slate-50 transition-colors cursor-pointer" @click="openDetail(p)">
             <!-- Name -->
             <td class="px-6 py-4">
                 <div class="flex items-center gap-3">
                     <!-- Color indicator bar -->
                     <div 
                         :style="{ backgroundColor: p.color || '#3B82F6' }" 
                         class="w-1 h-8 rounded-full flex-shrink-0"
                     ></div>
                     <div class="font-bold text-slate-900" :class="{ 'line-through text-gray-500': p.deleted_at }">
                         {{ p.first_name }} {{ p.last_name }}
                         <span v-if="p.deleted_at" class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase no-underline ml-2">Archived</span>
                     </div>
                 </div>
             </td>
             <!-- Roles -->
             <td class="px-6 py-4">
                 <span v-if="p.roles_display" class="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded border border-gray-200">
                     {{ p.roles_display }}
                 </span>
                 <span v-else class="text-gray-300">-</span>
             </td>
             <!-- Contact -->
             <td class="px-6 py-4 text-sm text-slate-600">
                 <div class="flex items-center gap-2">
                     <Mail size="12" /> {{ p.email || '-' }}
                 </div>
             </td>
             <!-- Actions -->
             <td class="px-6 py-4 text-right flex justify-end gap-1" @click.stop>
                 <button 
                     v-if="isTenantAdmin && p.user_id && p.user_id !== user?.id"
                     @click="handleImpersonate(p)" 
                     class="text-teal-600 hover:text-teal-800 transition-colors font-bold text-xs border border-teal-200 rounded bg-teal-50 hover:bg-teal-100 px-2 py-1"
                     title="View as this user"
                 >
                     View As
                 </button>
                 <button @click="openDetail(p)" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition">
                     <Eye size="16" />
                 </button>
             </td>
           </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    <PersonDetailModal :is-open="showDetail" :person="selectedPerson" @close="showDetail = false" @edit="openEdit" @restore="handleRestore"/>
    <PersonFormModal :is-open="showForm" :person="selectedPerson" @close="showForm = false" @saved="handleSaved" />
    <RolesManagerModal :is-open="showRoles" @close="showRoles = false" />

  </div>
</template>
