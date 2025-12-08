<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('cancel')"></div>
      
      <!-- Modal -->
      <div class="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        
        <!-- Step 1: Choose Action -->
        <div v-if="step === 'choose'" class="p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-2">Ready to Complete?</h2>
          <p class="text-gray-600 mb-6">Confirm your work status for this visit.</p>
          
          <button
            @click="step = 'confirm-complete'"
            class="w-full mb-3 p-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-3 transition-all"
          >
            <CheckCircle class="w-6 h-6" />
            <span>Work is Complete</span>
          </button>
          
          <button
            @click="step = 'incompletion'"
            class="w-full p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center justify-center gap-3 transition-all"
          >
            <AlertTriangle class="w-6 h-6" />
            <span>Can't Complete — Report Reason</span>
          </button>
          
          <button
            @click="$emit('cancel')"
            class="w-full mt-4 p-3 text-gray-500 hover:text-gray-700 font-medium"
          >
            Cancel
          </button>
        </div>
        
        <!-- Step 2a: Confirm Completion -->
        <div v-else-if="step === 'confirm-complete'" class="p-6">
          <div class="text-center mb-6">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle class="w-10 h-10 text-emerald-600" />
            </div>
            <h2 class="text-xl font-bold text-gray-900">Confirm Completion</h2>
          </div>
          
          <div class="bg-gray-50 rounded-xl p-4 mb-6 text-sm">
            <p class="font-medium text-gray-900 mb-2">By submitting, you confirm that:</p>
            <ul class="space-y-2 text-gray-600">
              <li class="flex items-start gap-2">
                <CheckCircle class="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>All required tasks have been completed</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckCircle class="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>The work meets quality standards</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckCircle class="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>You are the person who performed this work</span>
              </li>
            </ul>
          </div>
          
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm">
            <p class="text-amber-800">
              <strong>{{ userName }}</strong> · {{ roleName }}<br>
              <span class="text-amber-600">{{ currentTime }}</span>
            </p>
            <p class="text-amber-700 mt-1 text-xs">This record is permanent and cannot be undone.</p>
          </div>
          
          <div class="flex gap-3">
            <button
              @click="step = 'choose'"
              class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
            >
              Back
            </button>
            <button
              @click="handleSubmitCompletion"
              :disabled="submitting"
              class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {{ submitting ? 'Submitting...' : 'Confirm & Submit' }}
            </button>
          </div>
        </div>
        
        <!-- Step 2b: Incompletion Form -->
        <div v-else-if="step === 'incompletion'" class="p-6 max-h-[80vh] overflow-y-auto">
          <h2 class="text-xl font-bold text-gray-900 mb-2">Report Incompletion</h2>
          <p class="text-gray-600 mb-4">It's okay — honest reporting helps everyone.</p>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <div class="space-y-2">
                <label v-for="reason in reasonOptions" :key="reason.code" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input type="radio" v-model="incompletionReason" :value="reason.code" class="text-blue-600">
                  <span class="text-gray-900">{{ reason.label }}</span>
                </label>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">What was completed? (optional)</label>
              <textarea
                v-model="tasksCompleted"
                rows="2"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Vacuumed, cleaned bathrooms..."
              ></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">What remains? <span class="text-red-500">*</span></label>
              <textarea
                v-model="tasksRemaining"
                rows="2"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Bed linens need replacement..."
                required
              ></textarea>
            </div>
          </div>
          
          <div class="flex gap-3 mt-6">
            <button
              @click="step = 'choose'"
              class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
            >
              Back
            </button>
            <button
              @click="handleSubmitIncompletion"
              :disabled="!canSubmitIncompletion || submitting"
              class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {{ submitting ? 'Submitting...' : 'Submit Report' }}
            </button>
          </div>
        </div>
        
        <!-- Success State -->
        <div v-else-if="step === 'success'" class="p-6 text-center">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle class="w-12 h-12 text-emerald-600" />
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">
            {{ isCompletion ? 'Work Completed!' : 'Incompletion Recorded' }}
          </h2>
          <p class="text-gray-600 mb-6">
            {{ isCompletion ? 'Your attestation has been submitted.' : 'Your report has been submitted. A follow-up visit will be scheduled.' }}
          </p>
          <p v-if="!isCompletion" class="text-gray-500 text-sm mb-6">
            You did the right thing by reporting honestly. Thank you.
          </p>
          <button
            @click="$emit('complete')"
            class="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all"
          >
            Done
          </button>
        </div>
        
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { CheckCircle, AlertTriangle } from 'lucide-vue-next'
import { useWorkerStatus } from '../../composables/useWorkerStatus'
import { useAuth } from '../../composables/useAuth'

const props = defineProps({
  show: { type: Boolean, default: false },
  visitId: { type: String, required: true },
  jobId: { type: String, required: true }
})

const emit = defineEmits(['cancel', 'complete'])

const { submitCompletion, submitIncompletion } = useWorkerStatus()
const { userProfile } = useAuth()

const step = ref('choose')
const submitting = ref(false)
const isCompletion = ref(false)

// Incompletion form
const incompletionReason = ref('')
const tasksCompleted = ref('')
const tasksRemaining = ref('')

const reasonOptions = [
  { code: 'MISSING_MATERIALS', label: 'Missing materials or supplies' },
  { code: 'EQUIPMENT_ISSUE', label: 'Equipment not working' },
  { code: 'ACCESS_ISSUE', label: 'Access issue (locked, guest present)' },
  { code: 'SAFETY_CONCERN', label: 'Safety concern' },
  { code: 'TIME_INSUFFICIENT', label: 'Not enough time allocated' },
  { code: 'OTHER', label: 'Other (explain in notes)' }
]

const userName = computed(() => {
  const p = userProfile.value
  return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : 'Unknown'
})

const roleName = computed(() => {
  // Would come from active role in a full implementation
  return 'Team Member'
})

const currentTime = computed(() => {
  return new Date().toLocaleString()
})

const canSubmitIncompletion = computed(() => {
  return incompletionReason.value && tasksRemaining.value.trim()
})

const handleSubmitCompletion = async () => {
  submitting.value = true
  isCompletion.value = true
  
  try {
    const result = await submitCompletion(props.visitId, props.jobId, {
      all_tasks_complete: true,
      submitted_at: new Date().toISOString()
    })
    
    if (result.success) {
      step.value = 'success'
    } else {
      console.error('Failed to submit completion:', result.error)
    }
  } finally {
    submitting.value = false
  }
}

const handleSubmitIncompletion = async () => {
  submitting.value = true
  isCompletion.value = false
  
  try {
    const result = await submitIncompletion(props.visitId, props.jobId, {
      reason_code: incompletionReason.value,
      tasks_completed: tasksCompleted.value,
      tasks_remaining: tasksRemaining.value,
      submitted_at: new Date().toISOString()
    })
    
    if (result.success) {
      step.value = 'success'
    } else {
      console.error('Failed to submit incompletion:', result.error)
    }
  } finally {
    submitting.value = false
  }
}
</script>
