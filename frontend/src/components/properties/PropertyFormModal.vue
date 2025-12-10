<script setup>
import { ref, watch, reactive, onMounted, onUnmounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { uploadFile } from '../../lib/upload'
import { useAuth } from '../../composables/useAuth'
import { useProperties } from '../../composables/useProperties'
import { 
  X, Save, Trash2, Upload, Plus, RotateCcw, 
  Wifi, Key, Home, Image as ImageIcon 
} from 'lucide-vue-next'

const { userProfile } = useAuth()
const { saveProperty, archiveProperty, getPropertyDetail } = useProperties()

const props = defineProps({
  isOpen: Boolean,
  property: Object // null if new
})

const emit = defineEmits(['close', 'saved'])

// Logic: Archive
const handleDelete = async () => {
    if (!confirm("Are you sure you want to archive this property? It will be hidden from lists.")) return
    
    saving.value = true
    try {
        const result = await deleteProperty(props.property.id)
        if (!result.success) throw new Error(result.error)
        emit('saved')
        emit('close')
    } catch (e) {
        alert("Archive failed: " + e.message)
    } finally {
        saving.value = false
    }
}

// Component State
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const activeTab = ref('details') // details, photos, inventory, feeds, attachments

// Dropdown Data
const people = ref([])
const templates = ref([])
const catalog = ref([])

// Form State
const form = reactive({
  name: '',
  street_address: '',
  city: '',
  state: '',
  zip: '',
  check_in_time: '16:00',
  check_out_time: '10:00',
  time_zone: 'US/Mountain',
  is_dst: false,
  hcp_customer_id: '',
  hcp_address_id: '',
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
  square_footage: 0,
  bathroom_sinks: 0,
  bath_mats: 0,
  has_pool: false,
  has_bbq: false,
  allows_pets: false,
  has_casita: false,
  parking_instructions: '',
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
      // Fetch full property details via RPC to get discrete fields and assignments
      const result = await getPropertyDetail(props.property.id)
      if (result.success) {
        await loadPropertyDetails(result.property)
      } else {
        console.error('Failed to load property details:', result.error)
        // Fall back to using the prop data
        await loadPropertyDetails(props.property)
      }
    } else {
      resetForm()
    }
    initialState.value = getSnapshot() // Capture baseline
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
  console.log('[PropertyForm] Loading property details:', prop)
  // Populate basic fields - now form field names match DB column names so direct mapping works
  Object.keys(form).forEach(k => {
    if (prop[k] !== undefined) form[k] = prop[k]
  })
  
  // Fields that still need manual handling
  form.name = prop.name
  form.street_address = prop.street_address || ''
  form.city = prop.city || ''
  form.state = prop.state || ''
  form.zip = prop.zip || ''
  form.front_photo_url = prop.front_photo_url || ''
  form.parking_instructions = prop.parking_instructions || ''
  
  // Extract IDs from owners/managers arrays (RPC returns {id, name} objects)
  form.owner_ids = (prop.owners || []).map(o => o.id)
  form.manager_ids = (prop.managers || []).map(m => m.id)
  
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
  form.check_in_time = '16:00'
  form.check_out_time = '10:00'
  form.time_zone = 'US/Mountain'
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

// Logic: Address Autocomplete (Photon API)
const addressSuggestions = ref([])
const showAddressSuggestions = ref(false)
let addressDebounce = null

const onAddressInput = (e) => {
  const query = e.target.value
  clearTimeout(addressDebounce)
  
  if (!query || query.length < 3) {
    addressSuggestions.value = []
    showAddressSuggestions.value = false
    return
  }
  
  addressDebounce = setTimeout(async () => {
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`)
      const data = await res.json()
      addressSuggestions.value = (data.features || []).map(f => {
        const p = f.properties
        let street = p.street || p.name || ''
        if (p.housenumber) street = `${p.housenumber} ${street}`
        const fullAddress = [street, p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ')
        return {
          street: street.trim(),
          city: p.city || '',
          state: p.state || '',
          zip: p.postcode || '',
          country: p.country || '',
          fullAddress  // For display in dropdown
        }
      })
      showAddressSuggestions.value = addressSuggestions.value.length > 0
    } catch (err) {
      console.error('Address search failed:', err)
    }
  }, 400)
}

const selectAddress = (suggestion) => {
  form.street_address = suggestion.street
  form.city = suggestion.city
  form.state = suggestion.state
  form.zip = suggestion.zip
  showAddressSuggestions.value = false
  addressSuggestions.value = []
}

const hideAddressSuggestions = () => {
  // Delay to allow click event on suggestion to fire first
  setTimeout(() => {
    showAddressSuggestions.value = false
  }, 200)
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
    errorMessage.value = "Upload failed: " + err.message
  }
}

// Logic: Save
const saveData = async () => {
  errorMessage.value = ''
  if (!form.name || !form.owner_ids.length || !form.manager_ids.length) {
    errorMessage.value = "Name, Owner, and Manager are required."
    return
  }
  
  saving.value = true

  console.log('[PropertyForm] Saving with data:', {
    id: props.property?.id,
    owner_ids: form.owner_ids,
    manager_ids: form.manager_ids,
    details: form
  })

  try {
    const result = await saveProperty({
      id: props.property?.id,
      details: form,
      feeds: feeds.value,
      inventory: inventory.value
    })
    
    if (!result.success) throw new Error(result.error)
    emit('saved')
    emit('close')
  } catch (e) {
    errorMessage.value = "Save failed: " + e.message
    console.error(e)
  } finally {
    saving.value = false
  }
}

// Logic: Check Changes
const initialState = ref('')

const getSnapshot = () => {
    return JSON.stringify({
        form: form,
        feeds: feeds.value,
        inventory: inventory.value
    })
}

const handleClose = () => {
    const current = getSnapshot()
    if (initialState.value && current !== initialState.value) {
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
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto flex flex-col md:flex-row gap-6">
      
      <!-- Error Banner -->
      <div v-if="errorMessage" class="absolute top-0 left-0 right-0 bg-red-100 border-b border-red-300 text-red-800 px-4 py-3 text-sm font-medium flex justify-between items-center rounded-t-xl">
        <span>{{ errorMessage }}</span>
        <button @click="errorMessage = ''" class="text-red-600 hover:text-red-800 font-bold">×</button>
      </div>
      
      <!-- LEFT COLUMN (1/3) -->
      <div class="w-full md:w-1/3 space-y-6">
        <!-- Front Photo -->
        <div>
          <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Front Photo</label>
          <div class="mb-2">
            <img v-if="form.front_photo_url" :src="form.front_photo_url" class="w-full h-32 object-cover rounded-lg border border-gray-200">
            <div v-else class="w-full h-32 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">No Photo</div>
          </div>
          <label class="cursor-pointer text-xs text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200">
            <input type="file" @change="handleFrontPhoto" class="text-xs" accept="image/*">
          </label>
        </div>

        <!-- Timings -->
        <div class="bg-slate-50 p-3 rounded border border-slate-100">
          <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Timings</label>
          <div class="space-y-2">
            <div><span class="text-xs text-gray-400 block">Check-in</span><input v-model="form.check_in_time" type="time" class="w-full border p-1 rounded text-sm"></div>
            <div><span class="text-xs text-gray-400 block">Check-out</span><input v-model="form.check_out_time" type="time" class="w-full border p-1 rounded text-sm"></div>
            <div>
              <span class="text-xs text-gray-400 block">Time Zone</span>
              <select v-model="form.time_zone" class="w-full border p-1 rounded text-sm bg-white">
                <option value="UTC">UTC</option>
                <option value="US/Pacific">US/Pacific</option>
                <option value="US/Mountain">US/Mountain</option>
                <option value="US/Arizona">US/Arizona</option>
                <option value="US/Central">US/Central</option>
                <option value="US/Eastern">US/Eastern</option>
              </select>
            </div>
            <label class="flex items-center gap-2 cursor-pointer pt-1"><input v-model="form.is_dst" type="checkbox"><span class="text-xs">Observes DST</span></label>
          </div>
        </div>

        <!-- Specs -->
        <div class="bg-blue-50 p-3 rounded border border-blue-100">
          <label class="block text-xs font-bold uppercase text-blue-700 mb-2">Specs</label>
          <div class="grid grid-cols-3 gap-2">
            <div><span class="text-[10px] text-gray-400 block">Beds</span><input v-model="form.bedrooms" type="number" min="0" class="w-full border p-1 rounded text-sm"></div>
            <div><span class="text-[10px] text-gray-400 block">Baths</span><input v-model="form.bathrooms" type="number" step="0.5" min="0" class="w-full border p-1 rounded text-sm"></div>
            <div><span class="text-[10px] text-gray-400 block">Guests</span><input v-model="form.max_guests" type="number" min="0" class="w-full border p-1 rounded text-sm"></div>
            <div><span class="text-[10px] text-gray-400 block">Sq Ft</span><input v-model="form.square_footage" type="number" min="0" class="w-full border p-1 rounded text-sm"></div>
            <div><span class="text-[10px] text-gray-400 block">Sinks</span><input v-model="form.bathroom_sinks" type="number" min="0" class="w-full border p-1 rounded text-sm"></div>
            <div><span class="text-[10px] text-gray-400 block">Mats</span><input v-model="form.bath_mats" type="number" min="0" class="w-full border p-1 rounded text-sm"></div>
          </div>
        </div>

        <!-- Amenities -->
        <div class="bg-pink-50 p-3 rounded border border-pink-100">
          <label class="block text-xs font-bold uppercase text-pink-700 mb-2">Amenities</label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2 cursor-pointer"><input v-model="form.has_pool" type="checkbox"><span class="text-xs">Has Pool</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input v-model="form.has_bbq" type="checkbox"><span class="text-xs">Has BBQ</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input v-model="form.allows_pets" type="checkbox"><span class="text-xs">Pets Allowed</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input v-model="form.has_casita" type="checkbox"><span class="text-xs">Has Casita</span></label>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN (2/3) -->
      <div class="w-full md:w-2/3 space-y-4">
        <!-- Title -->
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-lg text-slate-900">{{ property ? 'Edit Property' : 'New Property' }}</h3>
          <span v-if="property?.status === 'archived'" class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold uppercase">Archived</span>
        </div>
        
        <!-- Name -->
        <input v-model="form.name" class="w-full border p-2 rounded" placeholder="Property Name">
        
        <!-- Address Fields with Autocomplete -->
        <div class="space-y-2">
          <!-- Street Address with Autocomplete -->
          <div class="flex gap-2">
            <select class="border p-2 rounded bg-white text-sm"><option value="us">🇺🇸</option><option value="ca">🇨🇦</option></select>
            <div class="relative flex-1">
              <input 
                v-model="form.street_address" 
                @input="onAddressInput" 
                @blur="hideAddressSuggestions"
                class="w-full border p-2 rounded" 
                placeholder="Street Address"
                autocomplete="off"
              >
              <div v-if="showAddressSuggestions && addressSuggestions.length > 0" class="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                <div v-for="(suggestion, idx) in addressSuggestions" :key="idx" @mousedown="selectAddress(suggestion)" class="p-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-50 last:border-0">
                  <div class="font-bold text-slate-700">{{ suggestion.street }}</div>
                  <div class="text-gray-500">{{ suggestion.fullAddress }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- City, State, Zip -->
          <div class="grid grid-cols-6 gap-2">
            <input v-model="form.city" class="col-span-3 border p-2 rounded" placeholder="City">
            <input v-model="form.state" class="col-span-1 border p-2 rounded uppercase" placeholder="State" maxlength="2">
            <input v-model="form.zip" class="col-span-2 border p-2 rounded" placeholder="Zip Code" maxlength="10">
          </div>
        </div>

        <!-- Parking -->
        <div>
          <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Parking Instructions</label>
          <textarea v-model="form.parking_instructions" class="w-full border p-2 rounded text-sm h-20 resize-none" placeholder="Enter parking details..."></textarea>
        </div>

        <!-- Access Codes -->
        <div class="bg-yellow-50 p-4 rounded border border-yellow-100">
          <label class="block text-xs font-bold uppercase text-yellow-700 mb-3">Access Codes</label>
          <div class="grid grid-cols-2 gap-4">
            <div><span class="text-[10px] uppercase text-gray-500 font-bold">Front Door</span><input v-model="form.door_code" class="w-full border p-2 rounded text-sm font-mono bg-white"></div>
            <div><span class="text-[10px] uppercase text-gray-500 font-bold">Garage</span><input v-model="form.garage_code" class="w-full border p-2 rounded text-sm font-mono bg-white"></div>
            <div><span class="text-[10px] uppercase text-gray-500 font-bold">Comm. Gate</span><input v-model="form.gate_code" class="w-full border p-2 rounded text-sm font-mono bg-white"></div>
            <div><span class="text-[10px] uppercase text-gray-500 font-bold">Owner Closet</span><input v-model="form.closet_code" class="w-full border p-2 rounded text-sm font-mono bg-white"></div>
            <div><span class="text-[10px] uppercase text-gray-500 font-bold text-purple-600">Casita Code</span><input v-model="form.casita_code" class="w-full border p-2 rounded text-sm font-mono bg-white"></div>
          </div>
        </div>

        <!-- Wifi -->
        <div class="bg-indigo-50 p-4 rounded border border-indigo-100">
          <label class="block text-xs font-bold uppercase text-indigo-700 mb-3">Wifi Details</label>
          <div class="grid grid-cols-2 gap-4">
            <div><span class="text-[10px] uppercase text-gray-500 font-bold">Network Name</span><input v-model="form.wifi_network" class="w-full border p-2 rounded text-sm bg-white"></div>
            <div><span class="text-[10px] uppercase text-gray-500 font-bold">Password</span><input v-model="form.wifi_password" class="w-full border p-2 rounded text-sm bg-white"></div>
          </div>
        </div>

        <!-- Inventory -->
        <div class="bg-green-50 p-4 rounded border border-green-100">
          <div class="flex justify-between items-center mb-3">
            <label class="block text-xs font-bold uppercase text-green-700">Inventory (BOM)</label>
            <div class="flex gap-2">
              <select v-model="selectedTemplateId" class="border border-green-200 p-1 rounded text-xs bg-white w-32">
                <option value="">Apply Template...</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
              <button type="button" @click="applyTemplate" class="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-green-700">Add</button>
            </div>
          </div>
          <div class="flex gap-2 mb-2">
            <input v-model="singleItemName" list="catalog-list" class="flex-1 border p-1 rounded text-xs" placeholder="Search Master Catalog...">
            <datalist id="catalog-list"><option v-for="c in catalog" :key="c.id" :value="c.item_name">{{ c.category }}</option></datalist>
            <input v-model.number="singleItemQty" type="number" class="w-12 border p-1 rounded text-xs text-center" value="1">
            <button type="button" @click="addInventoryItem" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 rounded"><Plus size="12" /></button>
          </div>
          <div class="bg-white border border-green-100 rounded p-2 max-h-40 overflow-y-auto space-y-1">
            <div v-for="(item, idx) in inventory" :key="idx" class="flex justify-between items-center border-b border-gray-50 pb-1 last:border-0">
              <div class="flex items-center gap-2">
                <input type="number" v-model="item.qty" class="w-10 text-center border rounded text-xs p-0.5 font-bold bg-gray-50">
                <span class="text-xs font-medium text-slate-700">{{ item.name }}</span>
                <span class="text-[10px] text-gray-400 bg-gray-50 px-1 rounded">{{ item.category || '' }}</span>
              </div>
              <button type="button" @click="inventory.splice(idx, 1)" class="text-red-400 hover:text-red-600 p-1"><X size="12" /></button>
            </div>
            <div v-if="!inventory.length" class="text-center text-gray-400 text-xs py-2">No inventory items.</div>
          </div>
        </div>

        <!-- Calendar Feeds -->
        <div class="bg-blue-50 p-4 rounded border border-blue-100">
          <label class="block text-xs font-bold uppercase text-blue-700 mb-3">Calendar Sync (iCal)</label>
          <div class="space-y-2">
            <div v-for="(feed, idx) in feeds" :key="idx" class="flex gap-2 items-center">
              <select v-model="feed.name" class="border p-2 rounded text-xs bg-white w-32">
                <option v-for="t in ['Airbnb', 'VRBO', 'Booking.com', 'Guesty', 'HomeAway', 'Hospitable', 'HostTools', 'Lodgify', 'OwnerRez']" :key="t" :value="t">{{ t }}</option>
              </select>
              <input v-model="feed.url" class="flex-1 border p-2 rounded text-xs" placeholder="https://...">
              <button type="button" @click="feeds.splice(idx, 1)" class="text-red-400 hover:text-red-600 p-1"><Trash2 size="14" /></button>
            </div>
          </div>
          <button type="button" @click="addFeed" class="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus size="12" /> Add Feed
          </button>
        </div>

        <!-- People -->
        <div class="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Owner(s) <span class="text-red-500">*</span></label>
            <div class="h-32 overflow-y-auto border border-gray-200 bg-white rounded p-2 space-y-1">
              <label v-for="p in people" :key="p.id" class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input type="checkbox" :value="p.id" v-model="form.owner_ids">
                <span class="text-xs">{{ p.first_name }} {{ p.last_name }}</span>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Property Manager(s) <span class="text-red-500">*</span></label>
            <div class="h-32 overflow-y-auto border border-gray-200 bg-white rounded p-2 space-y-1">
              <label v-for="p in people" :key="p.id" class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input type="checkbox" :value="p.id" v-model="form.manager_ids">
                <span class="text-xs">{{ p.first_name }} {{ p.last_name }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- HCP IDs -->
        <div class="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">HCP Customer ID</label>
            <input v-model="form.hcp_customer_id" class="w-full border p-2 rounded text-xs text-gray-700" placeholder="e.g. 12345">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">HCP Address ID</label>
            <input v-model="form.hcp_address_id" class="w-full border p-2 rounded text-xs text-gray-700" placeholder="e.g. 67890">
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between pt-4 mt-2 border-t border-gray-100">
          <button v-if="property" type="button" @click="handleDelete" class="text-red-500 hover:text-red-700 font-bold text-sm px-2">Archive Property</button>
          <div v-else></div>
          <div class="flex gap-2">
            <button type="button" @click="handleClose" class="px-4 py-2 text-sm hover:bg-gray-100 rounded">Cancel</button>
            <button type="button" @click="saveData" :disabled="saving" class="bg-black text-white px-6 py-2 rounded text-sm font-bold hover:bg-gray-800">
              {{ saving ? 'Saving...' : 'Save Property' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
