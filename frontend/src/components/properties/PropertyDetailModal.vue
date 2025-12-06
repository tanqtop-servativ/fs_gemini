<script setup>
import { ref, watch, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import AuditHistory from '../AuditHistory.vue'
import { 
  X, Pencil, Image as ImageIcon, FileText, Trash2, 

  MapPin, Check, Wifi, Key, ExternalLink 
} from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  property: Object
})

const emit = defineEmits(['close', 'edit'])

// Component State
const loading = ref(false)
const codes = ref([])
const feeds = ref([])
const inventory = ref([])
const refPhotos = ref([])
const attachments = ref([])

// Fetch additional details when property changes
watch(() => props.property, async (newProp) => {
  if (!newProp || !props.isOpen) return
  
  loading.value = true
  try {
    const [resCodes, resFeeds, resInv, resPhotos, resAtt] = await Promise.all([
      supabase.from('property_access_codes').select('*').eq('property_id', newProp.id),
      supabase.from('calendar_feeds').select('*').eq('property_id', newProp.id),
      supabase.from('property_inventory').select('*').eq('property_id', newProp.id),
      supabase.from('property_reference_photos').select('*').eq('property_id', newProp.id).order('sort_order'),
      supabase.from('property_attachments').select('*').eq('property_id', newProp.id).order('created_at', { ascending: false })
    ])
    
    codes.value = resCodes.data || []
    feeds.value = resFeeds.data || []
    inventory.value = resInv.data || []
    refPhotos.value = resPhotos.data || []
    attachments.value = resAtt.data || []
  } catch (e) {
    console.error("Error loading property details", e)
  } finally {
    loading.value = false
  }
}, { immediate: true })

// Helper accessors
const getCode = (type) => codes.value.find(c => c.code_type === type)?.code_value

const displayAddress = computed(() => {
    if (!props.property?.display_address) return ''
    return props.property.display_address
})

const mapLink = computed(() => `https://maps.google.com/?q=${encodeURIComponent(displayAddress.value)}`)

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
      
      <!-- Loading State -->
      <div v-if="loading" class="flex-1 flex items-center justify-center p-12">
        <span class="text-slate-400">Loading details...</span>
      </div>

      <div v-else class="flex-1 overflow-y-auto">
        <!-- Header Image -->
        <div v-if="property.front_photo_url" class="relative h-64 w-full">
            <img :src="property.front_photo_url" class="w-full h-full object-cover">
            <button @click="$emit('close')" class="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-md transition">
                <X size="20" />
            </button>
        </div>
        <div v-else class="h-48 bg-slate-100 flex items-center justify-center text-slate-400 relative">
            <ImageIcon size="48" />
            <button @click="$emit('close')" class="absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 text-gray-600 p-2 rounded-full transition">
                <X size="20" />
            </button>
        </div>

        <div class="p-6">
          <!-- Title Row -->
          <div class="flex justify-between items-start mb-6">
            <div>
              <h2 class="text-2xl font-bold text-slate-900">{{ property.name }}</h2>
              <a :href="mapLink" target="_blank" class="text-gray-500 text-sm hover:text-blue-600 flex items-center gap-1 mt-1">
                <MapPin size="14" />
                {{ displayAddress }}
              </a>
            </div>
            <button @click="$emit('edit', property)" class="text-gray-400 hover:text-black transition-colors p-2 rounded hover:bg-slate-50" title="Edit Property">
              <Pencil size="20" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            
            <!-- COLUMN 1: Codes & Wifi -->
            <div class="space-y-4">
                <!-- Access Codes -->
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h3 class="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                        <Key size="12" /> Access Codes
                    </h3>
                    <div class="space-y-2 text-sm">
                        <div v-if="getCode('Door')" class="flex justify-between"><span class="text-gray-500">Door</span> <span class="font-mono font-bold">{{ getCode('Door') }}</span></div>
                        <div v-if="getCode('Garage')" class="flex justify-between"><span class="text-gray-500">Garage</span> <span class="font-mono font-bold">{{ getCode('Garage') }}</span></div>
                        <div v-if="getCode('Community Gate')" class="flex justify-between"><span class="text-gray-500">Gate</span> <span class="font-mono font-bold">{{ getCode('Community Gate') }}</span></div>
                        <div v-if="getCode('Owner Closet')" class="flex justify-between"><span class="text-gray-500">Closet</span> <span class="font-mono font-bold">{{ getCode('Owner Closet') }}</span></div>
                        <div v-if="getCode('Casita')" class="flex justify-between text-purple-600"><span class="font-bold">Casita</span> <span class="font-mono font-bold">{{ getCode('Casita') }}</span></div>
                    </div>
                </div>

                <!-- Wifi -->
                <div v-if="property.wifi_network || property.wifi_password" class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <h3 class="text-xs font-bold uppercase text-indigo-500 mb-3 flex items-center gap-2">
                        <Wifi size="12" /> Wifi
                    </h3>
                    <div class="space-y-2 text-sm">
                        <div v-if="property.wifi_network" class="flex justify-between flex-wrap"><span class="text-gray-500 w-full mb-1">Network</span> <span class="font-bold break-all">{{ property.wifi_network }}</span></div>
                        <div v-if="property.wifi_password" class="flex justify-between flex-wrap"><span class="text-gray-500 w-full mb-1">Password</span> <span class="font-mono font-bold break-all">{{ property.wifi_password }}</span></div>
                    </div>
                </div>
            </div>

            <!-- COLUMN 2: Specs & Amenities -->
            <div class="space-y-4">
                <!-- Specs -->
                 <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 class="text-xs font-bold uppercase text-blue-500 mb-3">Details</h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-500">Bedrooms</span> <span class="font-bold">{{ property.bedrooms }}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Bathrooms</span> <span class="font-bold">{{ property.bathrooms }}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Max Guests</span> <span class="font-bold">{{ property.max_guests }}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Sq Ft</span> <span class="font-bold">{{ property.square_footage }}</span></div>
                    </div>
                </div>

                <!-- Amenities -->
                <div class="bg-pink-50 p-4 rounded-lg border border-pink-100">
                    <h3 class="text-xs font-bold uppercase text-pink-500 mb-3">Amenities</h3>
                    <div class="space-y-2 text-sm">
                        <div v-if="property.has_pool" class="flex justify-between"><span class="text-gray-500">Pool</span> <Check size="14" class="text-pink-600"/></div>
                        <div v-if="property.has_bbq" class="flex justify-between"><span class="text-gray-500">BBQ</span> <Check size="14" class="text-pink-600"/></div>
                        <div v-if="property.allows_pets" class="flex justify-between"><span class="text-gray-500">Pets Allowed</span> <Check size="14" class="text-pink-600"/></div>
                        <div v-if="property.has_casita" class="flex justify-between"><span class="text-gray-500">Casita</span> <Check size="14" class="text-pink-600"/></div>
                    </div>
                </div>

                <!-- Timings -->
                <div class="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <h3 class="text-xs font-bold uppercase text-orange-500 mb-3">Timings</h3>
                    <div class="space-y-2 text-sm">
                         <div class="flex justify-between"><span class="text-gray-500">Check-in</span> <span class="font-bold">{{ property.check_in_time }}</span></div>
                         <div class="flex justify-between"><span class="text-gray-500">Check-out</span> <span class="font-bold">{{ property.check_out_time }}</span></div>
                         <div class="flex justify-between"><span class="text-gray-500">Time Zone</span> <span class="font-bold">{{ property.time_zone }}</span></div>
                    </div>
                </div>
            </div>

            <!-- COLUMN 3: Lists (Photos, Materials, Attachments) -->
            <div class="space-y-4">
                 <!-- Ref Photos -->
                 <div v-if="refPhotos.length">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Ref Photos</h3>
                    <div class="grid grid-cols-3 gap-2">
                        <a v-for="p in refPhotos" :key="p.id" :href="p.photo_url" target="_blank" class="block relative group aspect-square">
                            <img :src="p.photo_url" class="w-full h-full object-cover rounded border border-gray-200">
                            <div v-if="p.label" class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 truncate">{{ p.label }}</div>
                        </a>
                    </div>
                 </div>

                 <!-- Materials -->
                 <div v-if="inventory.length">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Materials</h3>
                    <div class="max-h-40 overflow-y-auto space-y-1">
                        <div v-for="item in inventory" :key="item.id" class="text-xs flex justify-between border-b border-gray-50 py-1 last:border-0">
                            <span>{{ item.item_name }}</span>
                            <span class="font-bold text-gray-700">{{ item.quantity }}</span>
                        </div>
                    </div>
                 </div>

                 <!-- Attachments -->
                 <div v-if="attachments.length">
                    <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Attachments</h3>
                    <div class="space-y-1">
                        <a v-for="att in attachments" :key="att.id" :href="att.file_url" target="_blank" class="flex items-center gap-2 text-xs text-blue-600 hover:underline py-1">
                            <FileText size="12" /> {{ att.file_name }}
                        </a>
                    </div>
                 </div>
            </div>

          </div>
          
          <!-- Parking -->
          <div v-if="property.parking_instructions" class="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
             <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Parking Instructions</h3>
             <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ property.parking_instructions }}</p>
          </div>

          <!-- Bottom Grid: People & Integrations -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div>
                 <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">People</h3>
                 <div class="space-y-2 text-sm">
                     <div><span class="text-xs text-gray-400 block">Owner(s)</span> {{ property.owner_names || '-' }}</div>
                     <div><span class="text-xs text-gray-400 block">Manager(s)</span> {{ property.manager_names || '-' }}</div>
                 </div>
             </div>
             <div>
                 <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Integrations</h3>
                 <div class="space-y-2 text-sm">
                     <div><span class="text-xs text-gray-400 block">HCP Customer ID</span> {{ property.hcp_customer_id || '-' }}</div>
                     <div><span class="text-xs text-gray-400 block">HCP Address ID</span> {{ property.hcp_address_id || '-' }}</div>
                 </div>
             </div>
          </div>

          <!-- Calendar Feeds -->
          <div v-if="feeds.length" class="mb-6">
             <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Calendar Feeds</h3>
             <div class="bg-gray-50 border border-gray-100 rounded p-2 space-y-2">
                 <div v-for="feed in feeds" :key="feed.id" class="text-xs flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                     <span class="font-bold text-slate-700 w-32 shrink-0 truncate">{{ feed.name }}</span>
                     <a :href="feed.url" target="_blank" class="text-blue-500 hover:underline truncate flex-1 font-mono flex items-center gap-1">
                         {{ feed.url }} <ExternalLink size="10"/>
                     </a>
                 </div>
             </div>
          </div>

          <!-- Audit History -->
          <AuditHistory table-name="properties" :record-id="property.id" />

        </div>
        
        <!-- Footer -->
        <div class="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button @click="$emit('close')" class="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 text-gray-700">Close</button>
        </div>
      </div>

    </div>
  </div>
</template>
