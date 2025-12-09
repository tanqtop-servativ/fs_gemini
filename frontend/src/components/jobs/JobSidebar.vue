<script setup>
import { ref, computed } from 'vue'
import { MapPin, ChevronDown, ChevronUp, CheckSquare, Tag, Paperclip, MessageSquare, Navigation } from 'lucide-vue-next'

const props = defineProps({
    property: Object,
    job: Object,
    tasksCount: { type: Number, default: 0 },
    completedTasksCount: { type: Number, default: 0 },
    attachmentsCount: { type: Number, default: 0 }
})

// Collapsible section state
const expandedSections = ref({
    location: false,
    checklists: false,
    tags: false,
    attachments: false,
    notes: false
})

const toggleSection = (key) => {
    expandedSections.value[key] = !expandedSections.value[key]
}

// Static Google Maps URL (placeholder - would need API key for production)
const staticMapUrl = computed(() => {
    if (!props.property?.address) return null
    const address = encodeURIComponent(props.property.address)
    // Using a placeholder map image - in production, use Google Static Maps API
    return `https://maps.googleapis.com/maps/api/staticmap?center=${address}&zoom=15&size=280x150&markers=${address}&key=YOUR_API_KEY`
})

// Placeholder property image
const propertyImage = computed(() => {
    // Add reference photos support later
    return null
})
</script>

<template>
  <div class="w-72 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      
      <!-- Property Photo -->
      <div class="aspect-video bg-slate-100 relative">
          <img 
            v-if="propertyImage" 
            :src="propertyImage" 
            :alt="property?.name"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <MapPin class="w-12 h-12 text-slate-300" />
          </div>
          
          <!-- Property Name Overlay -->
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <div class="font-bold text-white text-sm">{{ property?.name || 'Unknown Property' }}</div>
          </div>
      </div>

      <!-- Property Address -->
      <div class="p-3 border-b border-gray-100">
          <div class="text-xs text-gray-500 flex items-center gap-1 mb-1">
              <MapPin size="12" /> Address
          </div>
          <div class="text-sm text-slate-700">{{ property?.address || 'No address' }}</div>
      </div>

      <!-- Map Preview -->
      <div class="border-b border-gray-100">
          <div class="aspect-[2/1] bg-slate-100 relative">
              <!-- Placeholder map - in production use static Google Maps -->
              <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                  <div class="text-center">
                      <Navigation class="w-8 h-8 text-blue-300 mx-auto mb-1" />
                      <div class="text-[10px] text-slate-400 uppercase font-bold">Map Preview</div>
                  </div>
              </div>
          </div>
      </div>

      <!-- Collapsible Sections -->
      <div class="flex-1">
          
          <!-- Location GPS -->
          <div class="border-b border-gray-100">
              <button 
                @click="toggleSection('location')"
                class="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
              >
                  <span class="flex items-center gap-2 text-sm text-slate-700">
                      <Navigation size="14" class="text-slate-400" />
                      Location GPS
                  </span>
                  <ChevronDown v-if="!expandedSections.location" size="14" class="text-gray-400" />
                  <ChevronUp v-else size="14" class="text-gray-400" />
              </button>
              <div v-if="expandedSections.location" class="px-3 pb-3 text-xs text-gray-500">
                  <div v-if="property?.latitude && property?.longitude">
                      {{ property.latitude.toFixed(6) }}, {{ property.longitude.toFixed(6) }}
                  </div>
                  <div v-else class="italic">No GPS coordinates</div>
              </div>
          </div>

          <!-- Checklists -->
          <div class="border-b border-gray-100">
              <button 
                @click="toggleSection('checklists')"
                class="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
              >
                  <span class="flex items-center gap-2 text-sm text-slate-700">
                      <CheckSquare size="14" class="text-slate-400" />
                      Checklists
                  </span>
                  <span class="flex items-center gap-2">
                      <span class="text-xs text-gray-400">{{ completedTasksCount }}/{{ tasksCount }}</span>
                      <ChevronDown v-if="!expandedSections.checklists" size="14" class="text-gray-400" />
                      <ChevronUp v-else size="14" class="text-gray-400" />
                  </span>
              </button>
              <div v-if="expandedSections.checklists" class="px-3 pb-3">
                  <div class="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        class="h-full bg-green-500 transition-all" 
                        :style="{ width: tasksCount > 0 ? (completedTasksCount / tasksCount * 100) + '%' : '0%' }"
                      ></div>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                      {{ completedTasksCount }} of {{ tasksCount }} tasks complete
                  </div>
              </div>
          </div>

          <!-- Job Tags -->
          <div class="border-b border-gray-100">
              <button 
                @click="toggleSection('tags')"
                class="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
              >
                  <span class="flex items-center gap-2 text-sm text-slate-700">
                      <Tag size="14" class="text-slate-400" />
                      Job Tags
                  </span>
                  <ChevronDown v-if="!expandedSections.tags" size="14" class="text-gray-400" />
                  <ChevronUp v-else size="14" class="text-gray-400" />
              </button>
              <div v-if="expandedSections.tags" class="px-3 pb-3 text-xs text-gray-500 italic">
                  No tags assigned
              </div>
          </div>

          <!-- Attachments -->
          <div class="border-b border-gray-100">
              <button 
                @click="toggleSection('attachments')"
                class="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
              >
                  <span class="flex items-center gap-2 text-sm text-slate-700">
                      <Paperclip size="14" class="text-slate-400" />
                      Attachments
                  </span>
                  <span class="flex items-center gap-2">
                      <span v-if="attachmentsCount > 0" class="text-xs text-gray-400">{{ attachmentsCount }}</span>
                      <ChevronDown v-if="!expandedSections.attachments" size="14" class="text-gray-400" />
                      <ChevronUp v-else size="14" class="text-gray-400" />
                  </span>
              </button>
              <div v-if="expandedSections.attachments" class="px-3 pb-3 text-xs text-gray-500 italic">
                  {{ attachmentsCount > 0 ? `${attachmentsCount} attachment(s)` : 'No attachments' }}
              </div>
          </div>

          <!-- Private Notes -->
          <div class="border-b border-gray-100">
              <button 
                @click="toggleSection('notes')"
                class="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
              >
                  <span class="flex items-center gap-2 text-sm text-slate-700">
                      <MessageSquare size="14" class="text-slate-400" />
                      Private Notes
                  </span>
                  <ChevronDown v-if="!expandedSections.notes" size="14" class="text-gray-400" />
                  <ChevronUp v-else size="14" class="text-gray-400" />
              </button>
              <div v-if="expandedSections.notes" class="px-3 pb-3 text-xs text-gray-500 italic">
                  {{ job?.notes || 'No private notes' }}
              </div>
          </div>

      </div>
  </div>
</template>
