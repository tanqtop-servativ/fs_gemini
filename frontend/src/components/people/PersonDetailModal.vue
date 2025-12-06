<script setup>
import { ref, watch, computed } from 'vue'
import AuditHistory from '../AuditHistory.vue'
import { X, Pencil, Mail, RotateCcw } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  person: Object
})

const emit = defineEmits(['close', 'edit', 'restore'])

const initials = computed(() => {
    if (!props.person) return ''
    return (props.person.first_name[0] + (props.person.last_name ? props.person.last_name[0] : '')).toUpperCase()
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        <div class="p-6">
             <div class="flex justify-between items-start mb-6">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500 border-2 border-white shadow-sm">
                        {{ initials }}
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900" :class="{ 'line-through decoration-red-500': person.deleted_at }">
                            {{ person.first_name }} {{ person.last_name }}
                        </h2>
                        <div class="flex items-center gap-1 text-gray-500 text-sm">
                            <Mail size="12" /> {{ person.email || 'No email' }}
                        </div>
                        <div v-if="person.deleted_at" class="text-xs font-bold text-red-500 uppercase mt-1">Archived</div>
                    </div>
                </div>
                <button @click="$emit('close')" class="text-gray-400 hover:text-black"><X size="20" /></button>
            </div>

            <div class="mb-6">
                <h3 class="text-xs font-bold uppercase text-gray-500 mb-3">Assigned Roles</h3>
                <div class="text-sm text-slate-700 font-medium bg-slate-50 p-3 rounded border border-slate-100 flex flex-wrap gap-2">
                    <span v-if="!person.roles_display" class="text-gray-400 italic">None</span>
                    <span v-else class="bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">{{ person.roles_display }}</span>
                    <!-- Note: roles_display might be comma separated string in view, or we parse it. 
                         Original code: p.roles_display used directly. -->
                </div>
            </div>

            <!-- Audit -->
            <AuditHistory table-name="people" :record-id="person.id" />
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
             <button v-if="person.deleted_at" @click="$emit('restore', person)" class="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center text-sm shadow">
                 <RotateCcw size="14" class="mr-2" /> Restore
             </button>
             <button v-else @click="$emit('edit', person)" class="bg-slate-900 text-white px-4 py-2 rounded font-bold hover:bg-slate-700 flex items-center text-sm shadow">
                 <Pencil size="14" class="mr-2" /> Edit
             </button>
        </div>

    </div>
  </div>
</template>
