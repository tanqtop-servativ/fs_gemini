<script setup>
import { ref, watch, reactive } from 'vue'
import { supabase } from '../../lib/supabase'
import { uploadFile } from '../../lib/upload'
import { useAuth } from '../../composables/useAuth'
import { 
  X, Save, Trash2, Upload, Plus, RotateCcw, 
  Wifi, Key, Home, Image as ImageIcon 
} from 'lucide-vue-next'

const { userProfile } = useAuth()

const props = defineProps({
  isOpen: Boolean,
  property: Object // null if new
})

const emit = defineEmits(['close', 'saved'])

// Component State
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('details') // details, photos, inventory, feeds, attachments

// Dropdown Data
const people = ref([])
const templates = ref([])
const catalog = ref([])

// Form State
const form = reactive({
  name: '',
  address: '',
  checkin: '16:00',
  checkout: '11:00',
  timezone: 'UTC',
  is_dst: false,
  hcp_cust: '',
  hcp_addr: '',
  wifi_network: '',
  wifi_password: '',
  door_code: '',
  garage_code: '',
  gate_code: '',
  closet_code: '',
  casita_code: '',
  bedrooms: 0,
  bathrooms: 0,
  max_guests: 0,
  sq_ft: 0,
  sinks: 0,
  baths_mats: 0,
  has_pool: false,
  has_bbq: false,
  allows_pets: false,
  has_casita: false,
  parking: '',
  front_photo_url: '',
  owner_ids: [],
  manager_ids: [],
})

const inventory = ref([])
const feeds = ref([])
const refPhotos = ref([])
const attachments = ref([])

// Watch for Modal Open / Property Change
watch(() => props.isOpen, async (open) => {
  if (open) {
    loading.value = true
    await fetchDropdowns()
    if (props.property) {
      await loadPropertyDetails(props.property)
    } else {
      resetForm()
    }
    loading.value = false
  }
})

const fetchDropdowns = async () => {
  const { data: p } = await supabase.from('people').select('id, first_name, last_name, person_roles(roles(name))')
  if (p) people.value = p
  
  const { data: t } = await supabase.from('bom_templates').select('id, name').is('deleted_at', null)
  if (t) templates.value = t
  
  const { data: c } = await supabase.from('master_item_catalog').select('*')
  if (c) catalog.value = c
}

const loadPropertyDetails = async (prop) => {
  // Populate basic fields
  Object.keys(form).forEach(k => {
    // Map props to form if keys match, else handle manually
    if (prop[k] !== undefined) form[k] = prop[k]
  })
  
  // Manual Mappings if names differ or need logic
  form.name = prop.name
  form.address = prop.display_address
  form.checkin = prop.check_in_time
  form.checkout = prop.check_out_time
  form.timezone = prop.time_zone
  form.is_dst = prop.is_dst
  form.hcp_cust = prop.hcp_customer_id
  form.hcp_addr = prop.hcp_address_id
  form.sq_ft = prop.square_footage
  form.sinks = prop.bathroom_sinks
  form.baths_mats = prop.bath_mats
  
  form.owner_ids = prop.owner_ids || []
  form.manager_ids = prop.manager_ids || []
  
  // Fetch lists
  const [resCodes, resFeeds, resInv, resRef, resAtt] = await Promise.all([
     supabase.from('property_access_codes').select('*').eq('property_id', prop.id),
     supabase.from('calendar_feeds').select('*').eq('property_id', prop.id),
     supabase.from('property_inventory').select('*').eq('property_id', prop.id),
     supabase.from('property_reference_photos').select('*').eq('property_id', prop.id).order('sort_order'),
     supabase.from('property_attachments').select('*').eq('property_id', prop.id).order('created_at', { ascending: false })
  ])
  
  // Map Codes
  const getC = (t) => resCodes.data?.find(c => c.code_type === t)?.code_value || ''
  form.door_code = getC('Door')
  form.garage_code = getC('Garage')
  form.gate_code = getC('Community Gate')
  form.closet_code = getC('Owner Closet')
  form.casita_code = getC('Casita')
  
  feeds.value = resFeeds.data || []
  inventory.value = resInv.data?.map(i => ({ name: i.item_name, qty: i.quantity, category: i.category })) || []
  refPhotos.value = resRef.data || []
  attachments.value = resAtt.data || []
}

const resetForm = () => {
  Object.keys(form).forEach(k => form[k] = (typeof form[k] === 'boolean' ? false : (Array.isArray(form[k]) ? [] : '')))
  form.checkin = '16:00'
  form.checkout = '11:00'
  form.timezone = 'UTC'
  inventory.value = []
  feeds.value = []
  refPhotos.value = []
  attachments.value = []
}

// Logic: Inventory
const selectedTemplateId = ref('')
const singleItemName = ref('')
const singleItemQty = ref(1)

const applyTemplate = async () => {
  if (!selectedTemplateId.value) return
  const { data: items } = await supabase.from('bom_template_items').select('*').eq('bom_template_id', selectedTemplateId.value)
  if (items) {
    items.forEach(newItem => {
        const existing = inventory.value.find(i => i.name.toLowerCase() === newItem.item_name.toLowerCase())
        if (existing) existing.qty += newItem.quantity
        else inventory.value.push({ name: newItem.item_name, qty: newItem.quantity, category: newItem.category })
    })
  }
  selectedTemplateId.value = ''
}

const addInventoryItem = () => {
   if (!singleItemName.value) return
   // Lookup in catalog helper
   const match = catalog.value.find(c => c.item_name.toLowerCase() === singleItemName.value.toLowerCase())
   const cat = match ? match.category : 'General' // Default if not found
   
   const existing = inventory.value.find(i => i.name.toLowerCase() === singleItemName.value.toLowerCase())
   if (existing) existing.qty += singleItemQty.value
   else inventory.value.push({ name: singleItemName.value.trim(), qty: singleItemQty.value, category: cat })
   
   singleItemName.value = ''
   singleItemQty.value = 1
}

// Logic: Feeds
const addFeed = () => {
  feeds.value.push({ name: 'Airbnb', url: '', id: null })
}

// Logic: Photo Upload
const handleFrontPhoto = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  try {
     const path = `front_${Date.now()}_${file.name.replace(/[^a-z0-9]/gi, '_')}`
     const url = await uploadFile(file, path)
     form.front_photo_url = url
  } catch (err) {
    alert("Upload failed: " + err.message)
  }
}

// Logic: Save
const saveData = async () => {
  if (!form.name || !form.owner_ids.length || !form.manager_ids.length) {
    return alert("Name, Owner, and Manager are required.")
  }
  
  saving.value = true
  
  const payload = {
    p_name: form.name,
    p_address: form.address,
    p_hcp_cust: form.hcp_cust,
    p_hcp_addr: form.hcp_addr,
    p_checkin: form.checkin,
    p_checkout: form.checkout,
    p_time_zone: form.timezone,
    p_is_dst: form.is_dst,
    p_owner_ids: form.owner_ids,
    p_manager_ids: form.manager_ids,
    p_photo_url: form.front_photo_url,
    p_door_code: form.door_code,
    p_garage_code: form.garage_code,
    p_gate_code: form.gate_code,
    p_closet_code: form.closet_code,
    p_wifi_network: form.wifi_network,
    p_wifi_password: form.wifi_password,
    p_bedrooms: form.bedrooms,
    p_bathrooms: form.bathrooms,
    p_max_guests: form.max_guests,
    p_square_footage: form.sq_ft,
    p_bathroom_sinks: form.sinks,
    p_bath_mats: form.baths_mats,
    p_has_pool: form.has_pool,
    p_has_bbq: form.has_bbq,
    p_allows_pets: form.allows_pets,
    p_has_casita: form.has_casita,
    p_casita_code: form.casita_code,
    p_parking_instructions: form.parking,
    p_feeds: feeds.value.map(f => ({ id: f.id, name: f.name, url: f.url })),
    p_inventory: inventory.value
  }
  
  // Get tenant_id from userProfile (fetched at login)
  const tenantId = userProfile.value?.tenant_id
  if (!tenantId) {
    return alert("Unable to determine tenant. Please log out and log back in.")
  }
  payload.p_tenant_id = tenantId

  try {
    let error
    if (props.property) {
      const res = await supabase.rpc('update_property_safe', { ...payload, p_id: props.property.id })
      error = res.error
    } else {
      const res = await supabase.rpc('create_property_safe', { ...payload })
      error = res.error
    }
    
    if (error) throw error
    emit('saved')
    emit('close')
  } catch (e) {
    alert("Save failed: " + e.message)
    console.error(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 class="text-lg font-bold text-slate-900">{{ property ? 'Edit Property' : 'New Property' }}</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-black transition"><X size="20" /></button>
      </div>
      
      <!-- Body -->
      <div class="flex-1 overflow-auto p-6 bg-slate-50">
        <form @submit.prevent="saveData" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- COL 1 -->
            <div class="space-y-6">
                <!-- Photo -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Front Photo</label>
                    <div class="mb-2">
                        <img v-if="form.front_photo_url" :src="form.front_photo_url" class="w-full h-40 object-cover rounded border border-gray-200">
                        <div v-else class="w-full h-40 bg-gray-50 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                            No Photo
                        </div>
                    </div>
                    <label class="cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm font-bold flex items-center justify-center hover:bg-blue-100 transition">
                        <Upload size="16" class="mr-2" /> Upload Photo
                        <input type="file" @change="handleFrontPhoto" class="hidden" accept="image/*">
                    </label>
                </div>

                <!-- Specs -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Specs</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[10px] text-gray-400 block">Beds</label><input v-model="form.bedrooms" type="number" class="w-full border p-1 rounded text-sm"></div>
                        <div><label class="text-[10px] text-gray-400 block">Baths</label><input v-model="form.bathrooms" type="number" step="0.5" class="w-full border p-1 rounded text-sm"></div>
                        <div><label class="text-[10px] text-gray-400 block">Guests</label><input v-model="form.max_guests" type="number" class="w-full border p-1 rounded text-sm"></div>
                        <div><label class="text-[10px] text-gray-400 block">Sq Ft</label><input v-model="form.sq_ft" type="number" class="w-full border p-1 rounded text-sm"></div>
                        <div><label class="text-[10px] text-gray-400 block">Sinks</label><input v-model="form.sinks" type="number" class="w-full border p-1 rounded text-sm"></div>
                        <div><label class="text-[10px] text-gray-400 block">Mats</label><input v-model="form.baths_mats" type="number" class="w-full border p-1 rounded text-sm"></div>
                    </div>
                </div>

                <!-- Amenities -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Amenities</h3>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="flex items-center gap-2"><input v-model="form.has_pool" type="checkbox"><span class="text-sm">Pool</span></label>
                        <label class="flex items-center gap-2"><input v-model="form.has_bbq" type="checkbox"><span class="text-sm">BBQ</span></label>
                        <label class="flex items-center gap-2"><input v-model="form.allows_pets" type="checkbox"><span class="text-sm">Pets</span></label>
                        <label class="flex items-center gap-2"><input v-model="form.has_casita" type="checkbox"><span class="text-sm">Casita</span></label>
                    </div>
                </div>
            </div>

            <!-- COL 2 -->
             <div class="space-y-6">
                <!-- Basic Info -->
                <div class="bg-white p-4 rounded-lg shadow-sm space-y-4">
                    <h3 class="text-xs font-bold uppercase text-gray-500">Details</h3>
                    <input v-model="form.name" class="w-full border p-2 rounded text-sm" placeholder="Property Name *">
                    <input v-model="form.address" class="w-full border p-2 rounded text-sm" placeholder="Address">
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[10px] text-gray-400 block">Check-in</label><input v-model="form.checkin" type="time" class="w-full border p-1 rounded text-sm"></div>
                        <div><label class="text-[10px] text-gray-400 block">Check-out</label><input v-model="form.checkout" type="time" class="w-full border p-1 rounded text-sm"></div>
                    </div>
                    
                    <div>
                        <label class="text-[10px] text-gray-400 block">Time Zone</label>
                        <select v-model="form.timezone" class="w-full border p-1 rounded text-sm bg-white">
                            <option value="UTC">UTC</option>
                            <option value="US/Pacific">US/Pacific</option>
                            <option value="US/Mountain">US/Mountain</option>
                            <option value="US/Arizona">US/Arizona</option>
                            <option value="US/Central">US/Central</option>
                            <option value="US/Eastern">US/Eastern</option>
                        </select>
                    </div>
                    <label class="flex items-center gap-2"><input v-model="form.is_dst" type="checkbox"><span class="text-xs">Observes DST</span></label>
                </div>

                <!-- Access Codes -->
                 <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Access Codes & Wifi</h3>
                    <div class="space-y-2">
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-gray-500">Door</span> <input v-model="form.door_code" class="col-span-2 border p-1 rounded text-sm font-mono"></div>
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-gray-500">Garage</span> <input v-model="form.garage_code" class="col-span-2 border p-1 rounded text-sm font-mono"></div>
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-gray-500">Gate</span> <input v-model="form.gate_code" class="col-span-2 border p-1 rounded text-sm font-mono"></div>
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-gray-500">Closet</span> <input v-model="form.closet_code" class="col-span-2 border p-1 rounded text-sm font-mono"></div>
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-purple-600 font-bold">Casita</span> <input v-model="form.casita_code" class="col-span-2 border p-1 rounded text-sm font-mono"></div>
                         
                         <div class="border-t my-2 pt-2"></div>
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-gray-500">Wifi</span> <input v-model="form.wifi_network" class="col-span-2 border p-1 rounded text-sm" placeholder="Network"></div>
                         <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs text-gray-500">Pass</span> <input v-model="form.wifi_password" class="col-span-2 border p-1 rounded text-sm font-mono" placeholder="Password"></div>
                    </div>
                </div>
            </div>

            <!-- COL 3 -->
            <div class="space-y-6">
                <!-- People -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">People</h3>
                    <div class="space-y-4">
                        <div>
                            <span class="text-xs font-bold block mb-1">Owner(s) <span class="text-red-500">*</span></span>
                            <div class="h-24 overflow-y-auto border rounded p-2 text-sm bg-gray-50">
                                <label v-for="p in people" :key="p.id" class="flex items-center gap-2 mb-1">
                                    <input type="checkbox" :value="p.id" v-model="form.owner_ids"> 
                                    {{ p.first_name }} {{ p.last_name }}
                                </label>
                            </div>
                        </div>
                        <div>
                            <span class="text-xs font-bold block mb-1">Manager(s) <span class="text-red-500">*</span></span>
                            <div class="h-24 overflow-y-auto border rounded p-2 text-sm bg-gray-50">
                                <label v-for="p in people" :key="p.id" class="flex items-center gap-2 mb-1">
                                    <input type="checkbox" :value="p.id" v-model="form.manager_ids"> 
                                    {{ p.first_name }} {{ p.last_name }}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Inventory -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Inventory (BOM)</h3>
                    <div class="flex gap-2 mb-2">
                        <select v-model="selectedTemplateId" class="border p-1 rounded text-xs flex-1">
                            <option value="">Select Template...</option>
                            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
                        </select>
                        <button type="button" @click="applyTemplate" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Add</button>
                    </div>
                    <div class="max-h-32 overflow-y-auto border rounded bg-gray-50 p-2 space-y-1">
                        <div v-for="(item, idx) in inventory" :key="idx" class="flex justify-between items-center text-xs border-b pb-1 last:border-0">
                            <span class="truncate">{{ item.name }}</span>
                            <div class="flex items-center gap-1">
                                <span class="font-bold">{{ item.qty }}</span>
                                <button type="button" @click="inventory.splice(idx, 1)" class="text-red-400"><X size="12" /></button>
                            </div>
                        </div>
                        <div v-if="!inventory.length" class="text-center text-gray-400 text-xs italic">No items</div>
                    </div>
                </div>
                
                <!-- Integrations -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                     <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Integrations</h3>
                     <div class="grid grid-cols-2 gap-2">
                         <div><label class="text-[10px] text-gray-400 block">HCP Guest ID</label><input v-model="form.hcp_cust" class="w-full border p-1 rounded text-sm"></div>
                         <div><label class="text-[10px] text-gray-400 block">HCP Addr ID</label><input v-model="form.hcp_addr" class="w-full border p-1 rounded text-sm"></div>
                     </div>
                </div>
            </div>

        </form>
      </div>
      
      <!-- Footer -->
      <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
        <button v-if="property" class="text-red-500 text-sm flex items-center gap-2 hover:bg-red-50 px-3 py-2 rounded">
             <Trash2 size="16"/> Archive
        </button>
        <div v-else></div> <!-- Spacer -->
        
        <div class="flex gap-4">
             <button @click="$emit('close')" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-bold">Cancel</button>
             <button @click="saveData" :disabled="saving" class="px-6 py-2 bg-slate-900 text-white rounded shadow text-sm font-bold hover:bg-slate-700 flex items-center">
                 <Save size="16" class="mr-2" />
                 {{ saving ? 'Saving...' : 'Save Property' }}
             </button>
        </div>
      </div>
    </div>
  </div>
</template>
