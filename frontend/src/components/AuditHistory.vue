<script setup>
import { ref, watch, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-vue-next'

const props = defineProps({
  tableName: String,
  recordId: String
})

const logs = ref([])
const loading = ref(false)
const error = ref(null)
const isOpen = ref(false) // Copllapsible state

const fetchLogs = async () => {
    loading.value = true
    error.value = null
    logs.value = []
    
    try {
        let res
        if (props.tableName === 'properties') {
            res = await supabase.rpc('get_property_audit_history', { p_property_id: props.recordId })
        } else if (props.tableName === 'bom_templates') {
            res = await supabase.rpc('get_bom_audit_history', { p_bom_id: props.recordId })
        } else if (props.tableName === 'job_templates') {
            res = await supabase.rpc('get_job_audit_history', { p_job_id: props.recordId })
        } else if (props.tableName === 'service_templates') {
            res = await supabase.rpc('get_service_audit_history', { p_service_id: props.recordId })
        } else {
            res = await supabase
                .from('audit_history_view')
                .select('*')
                .eq('table_name', props.tableName)
                .eq('record_id', props.recordId)
                .order('changed_at', { ascending: false })
        }

        if (res.error) throw res.error
        logs.value = res.data || []
    } catch (e) {
        console.error("Audit fetch error", e)
        error.value = e.message
    } finally {
        loading.value = false
    }
}

// Watch for Identity change to refetch
watch(() => [props.tableName, props.recordId], async ([table, id]) => {
  if (!table || !id) return
  await fetchLogs()
}, { immediate: true })

// Helpers
const formatDate = (ts) => new Date(ts).toLocaleString()

const getBadgeColor = (op) => {
    if (op === 'INSERT') return 'bg-green-100 text-green-700'
    if (op === 'UPDATE') return 'bg-blue-100 text-blue-700'
    if (op === 'DELETE') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
}

const getUserText = (log) => {
    if (log.changed_by_email) return log.changed_by_email
    if (log.changed_by) return `User: ...${log.changed_by.slice(-4)}`
    return 'System/Anon'
}

// Diff Calculation
const getChanges = (log) => {
    if (log.operation === 'UPDATE' && log.old_values && log.new_values) {
        const changes = []
        for (const key in log.new_values) {
            // Simple strict equality check for primitive changes
            if (JSON.stringify(log.new_values[key]) !== JSON.stringify(log.old_values[key])) {
                changes.push({ key, old: log.old_values[key], new: log.new_values[key] })
            }
        }
        return changes
    }
    return []
}

const copyLog = (log) => {
    const text = `Audit Log [${log.operation}] - ${formatDate(log.changed_at)}\nUser: ${getUserText(log)}\nDescription: ${log.description}\n\nData:\n${JSON.stringify(log.new_values || log.old_values, null, 2)}`
    navigator.clipboard.writeText(text).then(() => alert("Copied log details"))
}
</script>

<template>
  <div class="mt-6 pt-6 border-t border-gray-100">
    <!-- Header / Toggle -->
    <button 
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 text-xs font-bold uppercase text-gray-500 hover:text-gray-700 mb-2 select-none w-full text-left"
    >
      <ChevronRight v-if="!isOpen" class="w-4 h-4" />
      <ChevronDown v-else class="w-4 h-4" />
      <span>Audit History ({{ logs.length }})</span>
    </button>
    
    <!-- Content -->
    <div v-if="isOpen && loading" class="text-gray-400 text-xs py-2 ml-6">Loading history...</div>
    <div v-if="isOpen && error" class="text-red-500 text-xs py-2 ml-6">Error: {{ error }}</div>
    <div v-if="isOpen && !loading && logs.length === 0" class="text-gray-400 text-xs py-2 ml-6">No history found.</div>
    
    <div v-if="isOpen && logs.length > 0" class="mt-2 pl-1 border-l-2 border-gray-100 ml-2 space-y-4">
      <div v-for="log in logs" :key="log.id" class="relative pl-4">
          <!-- Dot -->
          <div class="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-gray-300"></div>
          
          <!-- Header Line -->
          <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-500">{{ formatDate(log.changed_at) }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide" :class="getBadgeColor(log.operation)">
                      {{ log.operation }}
                  </span>
              </div>
              <div class="flex items-center gap-2">
                  <span class="text-[10px] text-gray-400 font-mono" :title="getUserText(log)">{{ getUserText(log) }}</span>
                  <button @click="copyLog(log)" class="text-gray-300 hover:text-gray-500" title="Copy Details">
                      <Copy size="12" />
                  </button>
              </div>
          </div>
          
          <!-- Description -->
          <div class="text-sm text-slate-700 mb-1">
              <span v-if="log.record_summary" class="font-bold text-slate-900">{{ log.record_summary }} - </span>
              {{ log.description }}
          </div>
          
          <!-- Diffs (UPDATE) -->
          <div v-if="log.operation === 'UPDATE'" class="bg-slate-50 rounded p-2 text-xs font-mono space-y-1 border border-slate-100">
             <div v-for="change in getChanges(log)" :key="change.key" class="flex flex-wrap gap-2">
                 <span class="font-bold text-slate-600">{{ change.key }}:</span>
                 <span class="text-red-500 line-through opacity-75">{{ JSON.stringify(change.old) }}</span>
                 <span class="text-gray-400">→</span>
                 <span class="text-green-600 font-bold">{{ JSON.stringify(change.new) }}</span>
             </div>
             <div v-if="getChanges(log).length === 0" class="text-gray-400 italic">No visible field changes</div>
          </div>
          
          <!-- New Data (INSERT) -->
          <div v-if="log.operation === 'INSERT' && log.new_values" class="bg-green-50 rounded p-2 text-xs font-mono space-y-1 border border-green-100">
              <div class="text-green-800 font-bold mb-1">New Record Data:</div>
              <div v-for="(val, key) in log.new_values" :key="key" class="flex gap-2">
                  <span class="font-bold text-slate-600">{{ key }}:</span>
                  <span class="text-green-700 break-all">{{ JSON.stringify(val) }}</span>
              </div>
          </div>
          
          <!-- Old Data (DELETE) -->
          <div v-if="log.operation === 'DELETE' && log.old_values" class="bg-red-50 rounded p-2 text-xs font-mono space-y-1 border border-red-100">
              <div class="text-red-800 font-bold mb-1">Deleted Record Data:</div>
              <div v-for="(val, key) in log.old_values" :key="key" class="flex gap-2">
                  <span class="font-bold text-slate-600">{{ key }}:</span>
                  <span class="text-red-700 break-all">{{ JSON.stringify(val) }}</span>
              </div>
          </div>
          
      </div>
    </div>
  </div>
</template>
