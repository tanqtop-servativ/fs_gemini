<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { Bell, FileText, Mail, MessageSquare, AlertCircle, RefreshCw } from 'lucide-vue-next'

const props = defineProps({
  limit: { type: Number, default: 50 },
  compact: Boolean
})

const feed = ref([])
const loading = ref(true)
const autoRefresh = ref(null)

import { useAuth } from '../composables/useAuth'

const { userProfile } = useAuth()

const fetchFeed = async () => {
    // Rely on watcher
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
    // Poll every 30s
    autoRefresh.value = setInterval(fetchFeed, 30000)
})

onUnmounted(() => {
    if (autoRefresh.value) clearInterval(autoRefresh.value)
})

const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    // If today, show time, else date
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString()
}

const getIcon = (item) => {
    if (item.category === 'COMMUNICATION') return Mail
    if (item.summary.includes('DELETE')) return AlertCircle
    if (item.summary.includes('UPDATE')) return FileText
    if (item.summary.includes('INSERT')) return Plus
    return Bell
}

import { Plus } from 'lucide-vue-next'
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

          <div v-for="item in feed" :key="item.event_id" class="flex gap-3 p-3 rounded-lg border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
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
                      <p class="text-sm font-medium text-slate-800 truncate pr-2">{{ item.summary }}</p>
                      <span class="text-[10px] text-gray-400 whitespace-nowrap">{{ formatTime(item.timestamp) }}</span>
                  </div>
                  <div class="text-xs text-slate-500 flex items-center justify-between mt-1">
                      <span>{{ item.actor_email || 'System' }}</span>
                      <span v-if="item.details?.table" class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-gray-400">{{ item.details.table }}</span>
                  </div>
                  <!-- JSON Details (Optional expansion) -->
              </div>
          </div>
      </div>
  </div>
</template>
