<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import AuditHistory from '../AuditHistory.vue'
import { supabase } from '../../lib/supabase'
import { X, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  template: Object
})

const emit = defineEmits(['close', 'edit', 'refresh'])

const items = ref([])
const loadingItems = ref(false)

const fetchItems = async () => {
    if (!props.template) return
    loadingItems.value = true
    const { data } = await supabase.from('bom_template_items').select('*').eq('bom_template_id', props.template.id).order('sort_order')
    items.value = data || []
    loadingItems.value = false
}

watch(() => props.isOpen, (open) => {
    if (open) fetchItems()
})

const handleDelete = async () => {
    if (!confirm("Are you sure you want to archive this template?")) return
    const { error } = await supabase.from('bom_templates').update({ deleted_at: new Date().toISOString() }).eq('id', props.template.id)
    if (error) alert("Error: " + error.message)
    else {
        emit('refresh')
        emit('close')
    }
}

// ESC Key Handler
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
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
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <div class="p-6 border-b border-gray-100 flex justify-between items-start bg-slate-50">
             <div>
                <h2 class="text-xl font-bold text-slate-900">{{ template.name }}</h2>
            </div>
            <div class="flex items-center gap-1">
                <button @click="$emit('edit', template)" class="text-gray-400 hover:text-black transition-colors p-2 rounded hover:bg-slate-100" title="Edit Template">
                    <Pencil size="16" />
                </button>
                <button @click="$emit('close')" class="text-gray-400 hover:text-black transition-colors p-2 rounded hover:bg-slate-100"><X size="20" /></button>
            </div>
        </div>

        <div class="p-6 overflow-y-auto flex-1 space-y-6">
            <!-- Desc -->
            <div>
                 <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Description</h3>
                 <p class="text-sm text-gray-700">{{ template.description || 'No description.' }}</p>
            </div>

            <!-- Items -->
            <div>
                <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Inventory Items</h3>
                <div class="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
                     <div v-for="item in items" :key="item.id" class="p-3 flex justify-between items-center text-sm">
                         <div class="flex items-center gap-3">
                             <span class="bg-slate-100 px-2 rounded font-bold text-slate-700 text-xs py-0.5">{{ item.quantity }}x</span>
                             <span class="font-medium text-slate-900">{{ item.item_name }}</span>
                         </div>
                         <div class="flex items-center gap-3">
                             <span class="font-bold text-slate-700 text-xs">${{ (item.price || 0).toFixed(2) }}</span>
                             <span class="text-[10px] text-gray-400 bg-gray-50 uppercase px-1 rounded">{{ item.category }}</span>
                         </div>
                     </div>
                     <div v-if="loadingItems" class="p-4 text-center text-gray-400 italic">Loading items...</div>
                     <div v-else-if="items.length === 0" class="p-4 text-center text-gray-400 italic">No items defined.</div>
                </div>
            </div>

            <!-- Audit -->
            <div class="mt-6 pt-6 border-t border-gray-100">
                <AuditHistory table-name="bom_templates" :record-id="template.id" />
            </div>

        </div>
        
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
             <button @click="handleDelete" class="text-red-500 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded flex items-center">
                 <Trash2 size="16" class="mr-2" /> Archive
             </button>

        </div>

    </div>
  </div>
</template>
