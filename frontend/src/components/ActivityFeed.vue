<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { Bell, FileText, Mail, MessageSquare, AlertCircle, RefreshCw, Plus, ChevronDown, ChevronUp, Copy, Check } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const props = defineProps({
  limit: { type: Number, default: 50 },
  compact: Boolean
})

const feed = ref([])
const loading = ref(true)
const autoRefresh = ref(null)
const expandedItems = ref({})
const copiedId = ref(null)

const { userProfile } = useAuth()

const fetchFeed = async () => {
    const tenantId = userProfile.value?.tenant_id
    if (!tenantId) return 

    loading.value = true
    const { data, error } = await supabase
        .from('tenant_activity_feed')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('timestamp', { ascending: false })
        .limit(props.limit)
    
    if (error) console.error('Feed error:', error)
    else feed.value = data || []
    
    loading.value = false
}

// Watchers
watch(userProfile, (newVal) => {
    if (newVal?.tenant_id) fetchFeed()
}, { immediate: true })

onMounted(() => {
    autoRefresh.value = setInterval(fetchFeed, 30000)
})

onUnmounted(() => {
    if (autoRefresh.value) clearInterval(autoRefresh.value)
})

const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleString([], { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    })
}

const formatFullTimestamp = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString()
}

const generateSmartSummary = (item) => {
    // Communication events are already formatted well by SQL view
    if (item.category === 'COMMUNICATION') return item.summary

    const d = item.details || {}
    const table = d.table || 'Record'
    const op = d.operation || 'UPDATE'
    const oldVal = d.old || {}
    const newVal = d.new || {}

    // 1. Readable Table Name
    const tableMap = {
        'service_opportunities': 'Service Opportunity',
        'jobs': 'Job',
        'people': 'Person',
        'properties': 'Property',
        'roles': 'Role',
        'person_roles': 'Role Assignment',
        'job_tasks': 'Job Task',
        'job_assignments': 'Job Assignment',
        'bom_templates': 'BOM Template',
        'service_templates': 'Service Template',
        'job_templates': 'Job Template'
    }
    const readableTable = tableMap[table] || table

    // 2. Readable Operation
    const opMap = {
        'INSERT': 'Created',
        'UPDATE': 'Updated',
        'DELETE': 'Deleted'
    }
    const readableOp = opMap[op] || op

    // 3. Identify Name/Title
    const record = op === 'DELETE' ? oldVal : newVal
    let name = record?.name || record?.title || record?.email || record?.description
    if (!name && (record?.first_name || record?.last_name)) {
        name = `${record.first_name || ''} ${record.last_name || ''}`.trim()
    }
    
    // Fallback for assignments if we have ID but no joined name
    // (Ideally, the audit log/feed would include enrichments, but we work with raw data here)
    if (!name) name = '' 

    // 4. Summarize Changes (for Updates)
    let changeSummary = ''
    if (op === 'UPDATE') {
        const changes = []
        const ignore = ['updated_at', 'created_at', 'deleted_at', 'readable_id', 'id', 'tenant_id']
        
        Object.keys(newVal).forEach(key => {
            if (ignore.includes(key)) return
            if (JSON.stringify(newVal[key]) !== JSON.stringify(oldVal[key])) {
                // Formatting key
                const readableKey = key.replace(/_/g, ' ')
                changes.push(readableKey)
            }
        })
        
        if (changes.length > 0) {
            const max = 2
            const joined = changes.slice(0, max).join(', ')
            changeSummary = `(Changed ${joined}${changes.length > max ? '...' : ''})`
        }
    }

    return `${readableOp} ${readableTable}: ${name} ${changeSummary}`
}

const getIcon = (item) => {
    if (item.category === 'COMMUNICATION') return Mail
    if (item.summary.includes('DELETE')) return AlertCircle
    if (item.summary.includes('UPDATE')) return FileText
    if (item.summary.includes('INSERT')) return Plus
    return Bell
}

const toggleExpand = (eventId) => {
    expandedItems.value[eventId] = !expandedItems.value[eventId]
}

const isExpanded = (eventId) => {
    return !!expandedItems.value[eventId]
}

const formatDetailsText = (item) => {
    const lines = [
        `Event ID: ${item.event_id}`,
        `Timestamp: ${formatFullTimestamp(item.timestamp)}`,
        `Summary: ${item.summary}`,
        `Actor: ${item.actor_email || 'System'}`,
        `Category: ${item.category || 'N/A'}`,
        `Severity: ${item.severity || 'INFO'}`,
        '',
        'Details:',
        JSON.stringify(item.details, null, 2)
    ]
    return lines.join('\n')
}

const copyToClipboard = async (item) => {
    try {
        await navigator.clipboard.writeText(formatDetailsText(item))
        copiedId.value = item.event_id
        setTimeout(() => { copiedId.value = null }, 2000)
    } catch (err) {
        console.error('Failed to copy:', err)
    }
}
</script>

<template>
  <div class="h-full flex flex-col">
      <div v-if="!compact" class="flex justify-between items-center mb-4">
          <h2 class="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Bell class="text-blue-500" size="20"/> Latest Activity
          </h2>
          <button @click="fetchFeed" class="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-500 transition">
              <RefreshCw size="16" :class="{'animate-spin': loading}" />
          </button>
      </div>

      <div class="flex-1 overflow-y-auto space-y-3 p-1">
          <div v-if="loading && feed.length === 0" class="text-center py-8 text-gray-400 italic">
              Loading activity...
          </div>
          <div v-else-if="feed.length === 0" class="text-center py-8 text-gray-400 italic">
              No recent activity found.
          </div>

          <div 
            v-for="item in feed" 
            :key="item.event_id" 
            class="rounded-lg border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
          >
              <!-- Main Row (Clickable to Expand) -->
              <div 
                class="flex gap-3 p-3 cursor-pointer"
                @click="toggleExpand(item.event_id)"
              >
                  <div class="mt-1">
                      <component :is="getIcon(item)" 
                        size="16" 
                        :class="{
                            'text-blue-500': item.category === 'COMMUNICATION', 
                            'text-orange-500': item.severity === 'WARNING',
                            'text-slate-400': item.severity === 'INFO' && item.category !== 'COMMUNICATION'
                        }"
                      />
                  </div>
                  <div class="flex-1 min-w-0">
                      <div class="flex justify-between items-start">
                          <p class="text-sm font-medium text-slate-800 truncate pr-2">{{ generateSmartSummary(item) }}</p>
                          <span class="text-[10px] text-gray-400 whitespace-nowrap">{{ formatTime(item.timestamp) }}</span>
                      </div>
                      <div class="text-xs text-slate-500 flex items-center justify-between mt-1">
                          <span>{{ item.actor_email || 'System' }}</span>
                          <span v-if="item.details?.table" class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-gray-400">{{ item.details.table }}</span>
                      </div>
                  </div>
                  <div class="mt-1 text-gray-300">
                      <ChevronUp v-if="isExpanded(item.event_id)" size="16" />
                      <ChevronDown v-else size="16" />
                  </div>
              </div>

              <!-- Expanded Detail View -->
              <div 
                v-if="isExpanded(item.event_id)"
                class="border-t border-gray-100 bg-slate-50 p-4 text-xs"
              >
                  <div class="flex justify-between items-start mb-3">
                      <span class="text-[10px] uppercase font-bold text-gray-400">Full Details</span>
                      <button 
                        @click.stop="copyToClipboard(item)"
                        class="flex items-center gap-1 px-2 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100 transition"
                        :class="{ 'text-green-600 border-green-300': copiedId === item.event_id }"
                      >
                          <Check v-if="copiedId === item.event_id" size="12" />
                          <Copy v-else size="12" />
                          {{ copiedId === item.event_id ? 'Copied!' : 'Copy' }}
                      </button>
                  </div>

                  <div class="space-y-2 text-slate-600">
                      <div class="flex gap-2">
                          <span class="font-medium text-slate-500 w-20">Event ID:</span>
                          <span class="font-mono text-[11px]">{{ item.event_id }}</span>
                      </div>
                      <div class="flex gap-2">
                          <span class="font-medium text-slate-500 w-20">Timestamp:</span>
                          <span>{{ formatFullTimestamp(item.timestamp) }}</span>
                      </div>
                      <div class="flex gap-2">
                          <span class="font-medium text-slate-500 w-20">Actor:</span>
                          <span>{{ item.actor_email || 'System' }}</span>
                      </div>
                      <div class="flex gap-2">
                          <span class="font-medium text-slate-500 w-20">Category:</span>
                          <span>{{ item.category || 'N/A' }}</span>
                      </div>
                      <div class="flex gap-2">
                          <span class="font-medium text-slate-500 w-20">Severity:</span>
                          <span :class="{
                              'text-orange-600': item.severity === 'WARNING',
                              'text-red-600': item.severity === 'ERROR',
                              'text-slate-600': item.severity === 'INFO'
                          }">{{ item.severity || 'INFO' }}</span>
                      </div>
                      <div v-if="item.details" class="mt-3">
                          <span class="font-medium text-slate-500 block mb-1">Details (JSON):</span>
                          <pre class="bg-white border border-gray-200 rounded p-2 overflow-x-auto font-mono text-[11px] text-slate-700">{{ JSON.stringify(item.details, null, 2) }}</pre>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  </div>
</template>
