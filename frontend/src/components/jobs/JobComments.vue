<script setup>
import { ref, onMounted, watch } from 'vue'
import { Send, MessageSquare } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'
import { useJobs } from '../../composables/useJobs'

const props = defineProps({
  jobId: String
})

const { listComments, addComment } = useJobs()
const { user, userProfile } = useAuth()

const comments = ref([])
const newComment = ref('')
const loading = ref(true)
const sending = ref(false)

const fetchComments = async () => {
    if (!props.jobId) return
    loading.value = true
    
    const result = await listComments(props.jobId)
    comments.value = result.success ? result.comments : []
    loading.value = false
    scrollToBottom()
}

const sendComment = async () => {
    if (!newComment.value.trim()) return
    sending.value = true
    
    // Use person_id from profile if available, otherwise user.id
    const authorId = userProfile.value?.person_id || user.value?.id
    
    const result = await addComment(props.jobId, authorId, newComment.value)

    if (!result.success) {
        alert("Error sending: " + result.error)
    } else {
        newComment.value = ''
        fetchComments()
    }
    sending.value = false
}

const scrollToBottom = () => {
    setTimeout(() => {
        const el = document.getElementById('comments-container')
        if (el) el.scrollTop = el.scrollHeight
    }, 100)
}

watch(() => props.jobId, fetchComments, { immediate: true })
</script>

<template>
  <div class="flex flex-col">
      <div id="comments-container" class="max-h-64 overflow-y-auto p-4 space-y-4">
          <div v-if="loading" class="text-center text-gray-400 text-xs py-4">Loading...</div>
          <div v-else-if="comments.length === 0" class="text-center text-gray-400 text-xs py-6 italic">No comments yet.</div>
          
          <div v-for="c in comments" :key="c.id" class="flex flex-col items-start">
              <div class="max-w-[85%] bg-gray-50 border border-gray-100 p-3 rounded-lg">
                  <div class="text-[10px] text-gray-400 mb-1 flex justify-between gap-4">
                      <span class="font-bold text-slate-600">{{ c.author?.name || 'Unknown' }}</span>
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
