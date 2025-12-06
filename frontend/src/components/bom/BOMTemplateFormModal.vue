<script setup>
import { ref, watch, reactive, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { X, Save, Plus, GripVertical, Trash2, Package } from 'lucide-vue-next'
import draggable from 'vuedraggable'

const props = defineProps({
  isOpen: Boolean,
  template: Object
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const saving = ref(false)

// Form
const form = reactive({
    name: '',
    description: '',
    items: [] // { item_name, quantity, price, category, ... }
})

// New Item Input
const newItem = reactive({
    name: '',
    qty: 1,
    price: 0,
    category: 'Linens'
})

watch(() => props.isOpen, (open) => {
    if (open) {
        if (props.template) {
            form.name = props.template.name
            form.description = props.template.description || ''
            fetchItems(props.template.id)
        } else {
            resetForm()
        }
    }
})

const fetchItems = async (id) => {
    const { data } = await supabase.from('bom_template_items').select('*').eq('bom_template_id', id).order('sort_order')
    if (data) {
        form.items = data.map(i => ({
            item_name: i.item_name,
            quantity: i.quantity,
            price: i.price,
            category: i.category,
            notes: i.notes || '',
            _tempId: Math.random() // for draggable
        }))
    }
}

const resetForm = () => {
    form.name = ''
    form.description = ''
    form.items = []
    newItem.name = ''
    newItem.qty = 1
    newItem.price = 0
    newItem.category = 'Linens'
}

const addItem = () => {
    if (!newItem.name.trim()) return
    
    form.items.push({
        item_name: newItem.name,
        quantity: newItem.qty || 1,
        price: newItem.price || 0,
        category: newItem.category,
        _tempId: Date.now() + Math.random()
    })
    
    // Reset inputs
    newItem.name = ''
    newItem.qty = 1
    newItem.price = 0
    // Keep category
}

const removeItem = (index) => {
    form.items.splice(index, 1)
}

const handleSave = async () => {
    if (!form.name) return alert("Template Name required")
    saving.value = true

    try {
        const { data: { session } } = await supabase.auth.getSession()
        const tenantId = session?.user?.user_metadata?.tenant_id

        const payload = {
            p_name: form.name,
            p_description: form.description,
            p_items: form.items
        }

        let error
        if (props.template) {
             const { error: e } = await supabase.rpc('update_bom_template', { ...payload, p_id: props.template.id })
             error = e
        } else {
             const { error: e } = await supabase.rpc('create_bom_template', { ...payload, p_tenant_id: tenantId })
             error = e
        }

        if (error) throw error

        emit('saved')
        emit('close')

    } catch (e) {
        alert("Error saving: " + e.message)
    } finally {
        saving.value = false
    }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-bold text-lg text-slate-900">{{ template ? 'Edit BOM Template' : 'New BOM Template' }}</h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Template Name</label>
                     <input v-model="form.name" class="w-full border p-2 rounded text-lg font-bold focus:ring-1 focus:ring-blue-500" placeholder="e.g. 1BR Standard Kit">
                 </div>
                 <div>
                     <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
                     <textarea v-model="form.description" class="w-full border p-2 rounded text-sm h-16 resize-none" placeholder="Description of this kit..."></textarea>
                 </div>
            </div>

            <!-- Items -->
            <div>
                 <div class="flex justify-between items-center mb-2">
                     <h4 class="font-bold text-slate-700 uppercase text-sm flex items-center gap-2">
                         <Package size="16" class="text-blue-500"/> Items
                     </h4>
                 </div>

                 <!-- Add Row -->
                 <div class="flex flex-wrap gap-2 mb-4 p-3 bg-white rounded-lg border border-blue-100 shadow-sm items-end">
                     <div class="flex-1 min-w-[120px]">
                         <label class="block text-[10px] font-bold uppercase text-gray-400 mb-1">Item Name</label>
                         <input v-model="newItem.name" @keyup.enter="addItem" class="w-full border p-2 rounded text-sm focus:ring-1 focus:ring-blue-500" placeholder="e.g. Bath Towel">
                     </div>
                     <div class="w-20">
                         <label class="block text-[10px] font-bold uppercase text-gray-400 mb-1">Qty</label>
                         <input v-model.number="newItem.qty" type="number" class="w-full border p-2 rounded text-sm text-center">
                     </div>
                     <div class="w-24">
                         <label class="block text-[10px] font-bold uppercase text-gray-400 mb-1">Price ($)</label>
                         <input v-model.number="newItem.price" type="number" step="0.01" class="w-full border p-2 rounded text-sm text-center">
                     </div>
                     <div class="w-32">
                         <label class="block text-[10px] font-bold uppercase text-gray-400 mb-1">Category</label>
                         <select v-model="newItem.category" class="w-full border p-2 rounded text-sm bg-white">
                             <option>Linens</option>
                             <option>Consumables</option>
                             <option>Kitchen</option>
                             <option>Cleaning</option>
                             <option>Decor</option>
                         </select>
                     </div>
                     <button @click="addItem" class="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 h-[38px] w-[38px] flex items-center justify-center">
                         <Plus size="18" />
                     </button>
                 </div>

                 <!-- List -->
                 <draggable 
                    v-model="form.items" 
                    item-key="_tempId" 
                    handle=".drag-handle"
                    class="space-y-2"
                    ghost-class="opacity-50"
                 >
                    <template #item="{ element: item, index }">
                        <div class="bg-white rounded border border-gray-200 shadow-sm flex items-center p-2 group hover:border-blue-300 transition-colors">
                            <div class="mr-2 cursor-grab active:cursor-grabbing drag-handle text-gray-300 hover:text-gray-500">
                                <GripVertical size="16" />
                            </div>
                            
                            <!-- Qty -->
                            <input v-model.number="item.quantity" type="number" class="w-12 text-center border rounded text-xs p-1 font-bold bg-slate-50 mr-2 focus:ring-1 focus:ring-blue-500">
                            
                            <!-- Name -->
                            <div class="flex-1">
                                <input v-model="item.item_name" class="w-full text-sm font-medium border-none p-0 focus:ring-0 text-slate-700">
                            </div>

                            <!-- Price -->
                             <span class="text-xs text-gray-400 mr-1">$</span>
                            <input v-model.number="item.price" type="number" step="0.01" class="w-16 text-right border rounded text-xs p-1 bg-slate-50 mr-2 focus:ring-1 focus:ring-blue-500">

                            <!-- Category -->
                            <select v-model="item.category" class="text-[10px] uppercase font-bold text-gray-500 border-none bg-gray-50 rounded px-1 py-0.5 mr-2 w-24 cursor-pointer">
                                 <option>Linens</option>
                                 <option>Consumables</option>
                                 <option>Kitchen</option>
                                 <option>Cleaning</option>
                                 <option>Decor</option>
                            </select>

                            <button @click="removeItem(index)" class="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition">
                                <Trash2 size="14" />
                            </button>
                        </div>
                    </template>
                 </draggable>
                 
                 <div v-if="form.items.length === 0" class="text-center py-8 text-gray-300 text-xs italic">
                     No items in this template. Add some above.
                 </div>

            </div>

        </div>

        <!-- Footer -->
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button @click="$emit('close')" class="px-4 py-2 hover:bg-gray-200 rounded text-sm font-bold text-gray-600 transition">Cancel</button>
            <button @click="handleSave" :disabled="saving" class="px-6 py-2 bg-slate-900 text-white rounded shadow text-sm font-bold hover:bg-slate-700 flex items-center transition disabled:opacity-50">
                <Save size="16" class="mr-2" />
                {{ saving ? 'Saving...' : 'Save Template' }}
            </button>
        </div>

    </div>
  </div>
</template>
