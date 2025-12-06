<script setup>
import { computed } from 'vue'
import AuditHistory from '../AuditHistory.vue'
import { X, Pencil, CheckSquare, PenTool } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  template: Object
})

const emit = defineEmits(['close', 'edit'])

const tasks = computed(() => {
    if (!props.template || !props.template.job_template_tasks) return []
    return props.template.job_template_tasks.sort((a, b) => a.sort_order - b.sort_order)
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <div class="p-6 border-b border-gray-100 flex justify-between items-start bg-slate-50">
             <div>
                <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                    {{ template.name }}
                    <span v-if="template.deleted_at" class="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold uppercase">Archived</span>
                </h2>
                <p v-if="template.name_es" class="text-sm text-blue-600 font-medium mt-1">{{ template.name_es }}</p>
            </div>
            <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
        </div>

        <div class="p-6 overflow-y-auto flex-1 space-y-6">
            <!-- Desc -->
            <div>
                 <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Description</h3>
                 <p class="text-sm text-gray-700">{{ template.description || 'No description.' }}</p>
                 <p v-if="template.description_es" class="text-sm text-gray-500 mt-2 italic border-l-2 border-blue-200 pl-2">{{ template.description_es }}</p>
            </div>

            <!-- Tasks -->
            <div>
                <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Tasks ({{ tasks.length }})</h3>
                <div class="bg-slate-50 rounded-lg border border-gray-200 divide-y divide-gray-100">
                     <div v-for="(task, idx) in tasks" :key="task.id" class="p-4">
                         <div class="flex gap-3">
                             <div class="mt-0.5 text-slate-400 font-mono text-xs">{{ idx + 1 }}.</div>
                             <div class="flex-1">
                                 <div class="font-bold text-sm text-slate-800">{{ task.title }}</div>
                                 <div class="text-xs text-blue-500" v-if="task.title_es">{{ task.title_es }}</div>
                                 
                                 <div class="flex gap-2 mt-2">
                                     <span v-if="task.is_required" class="text-[10px] font-bold uppercase text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Required</span>
                                     <span v-if="task.require_photo" class="text-[10px] font-bold uppercase text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Photo Req.</span>
                                 </div>

                                 <!-- Checklist (Read Only) -->
                                 <div v-if="task.job_template_checklist_items && task.job_template_checklist_items.length > 0" class="mt-3 bg-white/50 rounded p-2 border border-slate-100">
                                     <div class="text-[10px] font-bold uppercase text-slate-400 mb-1">Checklist</div>
                                     <ul class="space-y-1">
                                         <li v-for="item in task.job_template_checklist_items.sort((a,b)=>a.sort_order-b.sort_order)" :key="item.id" class="flex items-start gap-2 text-xs text-slate-600">
                                             <component :is="item.item_type === 'input' ? PenTool : CheckSquare" class="w-3 h-3 mt-0.5 text-slate-400" />
                                             <div>
                                                 <span>{{ item.description }}</span>
                                                  <span v-if="item.item_type === 'input'" class="ml-1 text-[10px] bg-slate-200 px-1 rounded text-slate-500">Input</span>
                                             </div>
                                         </li>
                                     </ul>
                                 </div>
                             </div>
                         </div>
                     </div>
                     <div v-if="tasks.length === 0" class="p-4 text-center text-gray-400 text-sm italic">No tasks.</div>
                </div>
            </div>

            <!-- Audit -->
            <div class="mt-6 pt-6 border-t border-gray-100">
                <AuditHistory table-name="job_templates" :record-id="template.id" />
            </div>

        </div>
        
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end" v-if="!template.deleted_at">
             <button @click="$emit('edit', template)" class="bg-slate-900 text-white px-6 py-2 rounded font-bold hover:bg-slate-700 flex items-center text-sm shadow">
                 <Pencil size="14" class="mr-2" /> Edit Template
             </button>
        </div>

    </div>
  </div>
</template>
