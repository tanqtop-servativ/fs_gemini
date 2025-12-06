<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { Send, MessageSquare } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'

const props = defineProps({
  jobId: String
})

const comments = ref([])
const newComment = ref('')
const loading = ref(true)
const sending = ref(false)
const { user } = useAuth()

const fetchComments = async () => {
    loading.value = true
    const { data } = await supabase
        .from('job_comments')
        .select('*, user:user_id(email)')
        .eq('job_id', props.jobId)
        .order('created_at', { ascending: true })
    
    comments.value = data || []
    loading.value = false
    scrollToBottom()
}

const sendComment = async () => {
    if (!newComment.value.trim()) return
    sending.value = true
    
    const { error } = await supabase.from('job_comments').insert({
        job_id: props.jobId,
        user_id: user.value.id,
        content: newComment.value
    })

    if (error) alert("Error sending: " + error.message)
    else {
        newComment.value = ''
        fetchComments()
    }
    sending.value = false
}

const scrollToBottom = () => {
    // Simple timeout to wait for render
    setTimeout(() => {
        const el = document.getElementById('comments-container')
        if (el) el.scrollTop = el.scrollHeight
    }, 100)
}

onMounted(fetchComments)
</script>

<template>
  <div class="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <MessageSquare size="16" class="text-gray-500" />
          <h3 class="font-bold text-slate-700 text-sm uppercase">Comments</h3>
      </div>
      
      <div id="comments-container" class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          <div v-if="comments.length === 0" class="text-center text-gray-400 text-xs py-10 italic">No comments yet.</div>
          
          <div v-for="c in comments" :key="c.id" class="flex flex-col" :class="{'items-end': c.user_id === user?.id, 'items-start': c.user_id !== user?.id}">
              <div class="max-w-[85%] bg-white border border-gray-100 p-3 rounded-lg shadow-sm" :class="{'bg-blue-50 border-blue-100': c.user_id === user?.id}">
                  <div class="text-[10px] text-gray-400 mb-1 flex justify-between gap-4">
                      <span class="font-bold text-slate-600">{{ c.user?.email || 'Unknown' }}</span>
                      <span>{{ new Date(c.created_at).toLocaleString() }}</span>
                  </div>
                  <p class="text-sm text-slate-800 whitespace-pre-wrap">{{ c.content }}</p>
              </div>
          </div>
      </div>

      <div class="p-3 bg-white border-t border-gray-100 flex gap-2">
          <input 
            v-model="newComment" 
            @keyup.enter="sendComment"
            placeholder="Type a comment..." 
            class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
          >
          <button @click="sendComment" :disabled="sending || !newComment.trim()" class="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              <Send size="18" />
          </button>
      </div>
  </div>
</template>
