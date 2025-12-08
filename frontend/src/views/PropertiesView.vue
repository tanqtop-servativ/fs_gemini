<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Home, Calendar as CalendarIcon, Plus, Eye } from 'lucide-vue-next'
import PropertyDetailModal from '../components/properties/PropertyDetailModal.vue'
import PropertyFormModal from '../components/properties/PropertyFormModal.vue'
import { useAuth } from '../composables/useAuth'
import { useProperties } from '../composables/useProperties'

const router = useRouter()
const route = useRoute()
const properties = ref([])
const loading = ref(true)
const showArchived = ref(false)

// Modal State
const showDetailModal = ref(false)
const showFormModal = ref(false)
const selectedProperty = ref(null)

// Data Fetching
const { userProfile } = useAuth()
const { fetchPropertiesEnriched } = useProperties()

const fetchProperties = async () => {
  const tenantId = userProfile.value?.tenant_id
  if (!tenantId) return

  loading.value = true
  
  const result = await fetchPropertiesEnriched({ showArchived: showArchived.value })
  if (result.success) {
    properties.value = result.properties
    checkRouteParam()
  } else {
    console.error('Error fetching properties:', result.error)
  }
  
  loading.value = false
}

// Check if we need to open a specific property from URL
const checkRouteParam = () => {
    const id = route.query.id
    if (id && properties.value.length > 0) {
        const prop = properties.value.find(p => p.id === id)
        if (prop) {
            openDetail(prop)
        }
    }
}

// Watchers
watch(showArchived, fetchProperties)
watch(() => route.query.id, () => {
    checkRouteParam()
})
watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchProperties()
}, { immediate: true })

// Actions
const openDetail = (prop) => {
  selectedProperty.value = prop
  showDetailModal.value = true
}

const openCalendar = (prop) => {
  router.push({ name: 'calendar', query: { propertyId: prop.id } })
}

const handleEdit = (prop) => {
  selectedProperty.value = prop
  showDetailModal.value = false
  showFormModal.value = true
}

const openNewProperty = () => {
  selectedProperty.value = null
  showFormModal.value = true
}

const handleSaved = () => {
  fetchProperties()
  showFormModal.value = false
}
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
     <!-- ... existing header ... -->
     <!-- ... existing table ... -->
     
     <!-- HEADER COPY for context matches -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Properties</h1>
        <p class="text-gray-500 text-sm">Manage units & assignments</p>
      </div>
      
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" v-model="showArchived" class="rounded border-gray-300 text-black focus:ring-0">
          Show Archived
        </label>
        
        <button 
          @click="openNewProperty"
          class="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-800 transition shadow-sm"
        >
          <Plus class="w-4 h-4 mr-2" />
          New Property
        </button>
      </div>
    </div>
    
    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Property</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Address</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider">Assignments</th>
            <th class="px-6 py-4 text-xs uppercase text-gray-500 font-semibold tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading properties...</td>
          </tr>
          
          <tr v-else-if="properties.length === 0">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">No properties found.</td>
          </tr>
          
          <tr 
            v-for="prop in properties" 
            :key="prop.id" 
            class="group hover:bg-slate-50 transition-colors cursor-pointer"
            @click="openDetail(prop)"
          >
            <!-- Property Name & Photo -->
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <img 
                  v-if="prop.front_photo_url" 
                  :src="prop.front_photo_url" 
                  class="w-10 h-10 rounded object-cover border border-gray-200"
                  :class="{ 'grayscale': showArchived }"
                >
                <div v-else class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                  <Home class="w-5 h-5" />
                </div>
                
                <div>
                  <div class="font-bold text-slate-900" :class="{ 'line-through text-gray-500': showArchived }">
                    {{ prop.name }}
                  </div>
                  <span v-if="showArchived" class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">
                    Archived
                  </span>
                </div>
              </div>
            </td>
            
            <!-- Address -->
            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
              {{ prop.display_address }}
            </td>
            
            <!-- Assignments -->
            <td class="px-6 py-4 text-xs text-gray-600">
               <div class="flex items-center gap-1 mb-1">
                 <span class="font-bold text-slate-400 w-12 text-[10px] uppercase">Own</span>
                 <span class="truncate">{{ prop.owner_names || 'None' }}</span>
               </div>
               <div class="flex items-center gap-1">
                 <span class="font-bold text-slate-400 w-12 text-[10px] uppercase">Mgr</span>
                 <span class="truncate">{{ prop.manager_names || 'None' }}</span>
               </div>
            </td>
            
            <!-- Actions -->
            <td class="px-6 py-4 text-right" @click.stop>
              <div class="flex items-center justify-end gap-1">
                <button 
                  @click="openCalendar(prop)"
                  class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                  title="View Calendar"
                >
                  <CalendarIcon class="w-4 h-4" />
                </button>
                <button 
                  @click="openDetail(prop)"
                  class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                  title="View Details"
                >
                  <Eye class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    <PropertyDetailModal 
      :is-open="showDetailModal" 
      :property="selectedProperty"
      @close="showDetailModal = false"
      @edit="handleEdit"
    />
    
    <PropertyFormModal 
      :is-open="showFormModal"
      :property="selectedProperty"
      @close="showFormModal = false"
      @saved="handleSaved"
    />
  </div>
</template>
