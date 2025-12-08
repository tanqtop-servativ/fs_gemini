<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      
      <!-- Modal -->
      <div class="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="p-5 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <h2 class="text-xl font-bold">Create Special Service</h2>
          <p class="text-sm opacity-80">Ad-hoc work with structured categorization</p>
        </div>
        
        <!-- Form -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <!-- Category & Subcategory -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Category <span class="text-red-500">*</span></label>
              <select v-model="form.category" @change="form.subcategory = ''" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                <option value="">Select category...</option>
                <option v-for="cat in categories" :key="cat.category" :value="cat.category">
                  {{ cat.category }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Subcategory <span class="text-red-500">*</span></label>
              <select v-model="form.subcategory" :disabled="!form.category" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100">
                <option value="">Select subcategory...</option>
                <option v-for="sub in subcategoryOptions" :key="sub.subcategory" :value="sub.subcategory">
                  {{ sub.subcategory }} {{ sub.requires_photos ? '📷' : '' }}
                </option>
              </select>
            </div>
          </div>
          
          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Description <span class="text-red-500">*</span>
              <span class="text-gray-400 font-normal">(min 50 characters)</span>
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Describe the work to be performed in detail..."
            ></textarea>
            <p class="text-xs text-gray-400 mt-1">{{ form.description.length }}/50 characters</p>
          </div>
          
          <!-- Billing -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center gap-3 mb-3">
              <input type="checkbox" v-model="form.billable" id="billable" class="w-4 h-4 text-purple-600">
              <label for="billable" class="font-medium text-gray-700">Billable to owner</label>
            </div>
            
            <div v-if="form.billable" class="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Billing Type</label>
                <select v-model="form.billingType" class="w-full px-4 py-2 border rounded-lg">
                  <option v-for="bt in billingTypes" :key="bt.value" :value="bt.value">
                    {{ bt.label }}
                  </option>
                </select>
              </div>
              <div v-if="form.billingType === 'fixed'">
                <label class="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">$</span>
                  <input 
                    type="number" 
                    v-model.number="form.billingAmount" 
                    step="0.01"
                    class="w-full pl-8 pr-4 py-2 border rounded-lg"
                    placeholder="0.00"
                  >
                </div>
              </div>
            </div>
          </div>
          
          <!-- Estimated Duration -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (minutes)</label>
            <input 
              type="number" 
              v-model.number="form.estimatedDuration" 
              class="w-full px-4 py-2 border rounded-lg"
              placeholder="30"
            >
          </div>
          
          <!-- Requestor -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
            <input 
              type="text" 
              v-model="form.requestor" 
              class="w-full px-4 py-2 border rounded-lg"
              placeholder="Owner name, guest, etc."
            >
          </div>
        </div>
        
        <!-- Footer -->
        <div class="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            @click="$emit('close')" 
            class="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button 
            @click="handleSubmit"
            :disabled="!canSubmit || submitting"
            class="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {{ submitting ? 'Creating...' : 'Create Job' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSpecialService } from '../../composables/useSpecialService'

const props = defineProps({
  show: { type: Boolean, default: false },
  serviceOpportunityId: { type: String, required: true }
})

const emit = defineEmits(['close', 'created'])

const { categories, loadCategories, createSpecialServiceJob, billingTypes } = useSpecialService()

const submitting = ref(false)
const form = ref({
  category: '',
  subcategory: '',
  description: '',
  billable: false,
  billingType: 'fixed',
  billingAmount: null,
  estimatedDuration: null,
  requestor: ''
})

const subcategoryOptions = computed(() => {
  const cat = categories.value.find(c => c.category === form.value.category)
  return cat?.subcategories || []
})

const canSubmit = computed(() => {
  return (
    form.value.category &&
    form.value.subcategory &&
    form.value.description.length >= 50 &&
    (!form.value.billable || form.value.billingType) &&
    (form.value.billingType !== 'fixed' || form.value.billingAmount > 0 || !form.value.billable)
  )
})

const handleSubmit = async () => {
  submitting.value = true
  
  const result = await createSpecialServiceJob({
    serviceOpportunityId: props.serviceOpportunityId,
    category: form.value.category,
    subcategory: form.value.subcategory,
    description: form.value.description,
    billable: form.value.billable,
    billingType: form.value.billable ? form.value.billingType : null,
    billingAmount: form.value.billable && form.value.billingType === 'fixed' ? form.value.billingAmount : null,
    estimatedDurationMinutes: form.value.estimatedDuration,
    requestor: form.value.requestor || null
  })
  
  submitting.value = false
  
  if (result.success) {
    emit('created', result.data)
    emit('close')
  } else {
    alert('Error: ' + result.error)
  }
}

watch(() => props.show, (val) => {
  if (val && categories.value.length === 0) {
    loadCategories()
  }
})

onMounted(() => {
  if (categories.value.length === 0) {
    loadCategories()
  }
})
</script>
