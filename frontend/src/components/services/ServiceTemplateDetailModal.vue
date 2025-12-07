<script setup>
import { computed } from 'vue'
import AuditHistory from '../AuditHistory.vue'
import { supabase } from '../../lib/supabase'
import { X, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  template: Object
})

const emit = defineEmits(['close', 'edit', 'refresh'])

const steps = computed(() => {
    if (!props.template || !props.template.service_workflow_steps) return []
    return props.template.service_workflow_steps.sort((a, b) => a.sort_order - b.sort_order)
})

const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this service template?")) return
    const { error } = await supabase.from('service_templates').update({ deleted_at: new Date().toISOString() }).eq('id', props.template.id)
    if (error) alert("Error: " + error.message)
    else {
        emit('refresh')
        emit('close')
    }
}
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

            <!-- Steps -->
            <div>
                <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Workflow Steps</h3>
                <div class="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
                     <div v-for="(step, idx) in steps" :key="step.id" class="p-4 flex gap-4 items-center">
                         <div class="font-mono text-gray-300 text-sm font-bold w-6 text-center">{{ idx + 1 }}</div>
                         <div class="flex-1">
                             <div class="font-bold text-sm text-slate-800">{{ step.job_templates?.name || 'Unknown Job' }}</div>
                             <div class="flex gap-2 mt-1">
                                 <span v-if="step.is_optional" class="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Optional</span>
                                 <span v-if="step.is_billing" class="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Billing</span>
                                 <span v-if="step.delay_hours > 0" class="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Delay: {{ step.delay_hours }}h</span>
                             </div>
                         </div>
                     </div>
                     <div v-if="steps.length === 0" class="p-4 text-center text-gray-400 text-sm italic">No steps defined.</div>
                </div>
            </div>

            <!-- Audit -->
            <div class="mt-6 pt-6 border-t border-gray-100">
                <AuditHistory table-name="service_templates" :record-id="template.id" />
            </div>

        </div>
        
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
             <button @click="handleDelete" class="text-red-500 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded flex items-center">
                 <Trash2 size="16" class="mr-2" /> Delete
             </button>

        </div>

    </div>
  </div>
</template>
