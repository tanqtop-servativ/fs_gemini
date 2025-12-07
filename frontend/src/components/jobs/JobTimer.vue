<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { Play, Square, Clock } from 'lucide-vue-next'

const props = defineProps({
  jobId: String
})

const activeTimer = ref(null)
const duration = ref(0)
const interval = ref(null)
const loading = ref(true)

const fetchActiveTimer = async () => {
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
        .from('job_timers')
        .select('*')
        .eq('job_id', props.jobId)
        .eq('user_id', session.user.id)
        .is('stopped_at', null)
        .maybeSingle()  // Use maybeSingle to avoid error when no timer exists
    
    activeTimer.value = data
    loading.value = false
    
    if (data) {
        startTicker()
    }
}

const startTicker = () => {
    if (interval.value) clearInterval(interval.value)
    interval.value = setInterval(() => {
        if (activeTimer.value) {
            const start = new Date(activeTimer.value.started_at).getTime()
            duration.value = Math.floor((Date.now() - start) / 1000)
        } else {
            duration.value = 0
        }
    }, 1000)
}

const toggleTimer = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    if (activeTimer.value) {
        // Stop
        const { error } = await supabase
            .from('job_timers')
            .update({ stopped_at: new Date().toISOString() })
            .eq('id', activeTimer.value.id)
        
        if (error) alert("Error stopping timer: " + error.message)
        else {
            activeTimer.value = null
            clearInterval(interval.value)
            duration.value = 0
        }
    } else {
        // Start
        const { data, error } = await supabase
            .from('job_timers')
            .insert({
                job_id: props.jobId,
                user_id: session.user.id
            })
            .select()
            .single()
        
        if (error) alert("Error starting timer: " + error.message)
        else {
            activeTimer.value = data
            startTicker()
        }
    }
}

onMounted(fetchActiveTimer)

onUnmounted(() => {
    if (interval.value) clearInterval(interval.value)
})

const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="flex items-center gap-2">
      <div v-if="activeTimer" class="font-mono text-xl font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded">
          {{ formatDuration(duration) }}
      </div>
      <button 
        @click="toggleTimer"
        class="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition shadow-sm min-w-[120px] justify-center"
        :class="activeTimer ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'"
      >
          <component :is="activeTimer ? Square : Play" size="18" :fill="activeTimer ? 'currentColor' : 'none'" />
          {{ activeTimer ? 'Stop' : 'Start Timer' }}
      </button>
  </div>
</template>
