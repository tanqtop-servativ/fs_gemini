<template>
  <div class="worker-home min-h-screen bg-gray-100">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-blue-200 text-sm">Welcome back</p>
          <h1 class="text-xl font-bold">{{ userName }}</h1>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold">{{ activeJobs.length }}</p>
          <p class="text-blue-200 text-sm">Active Jobs</p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="p-8 text-center text-gray-400">
      <div class="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full mb-4"></div>
      <p>Loading your jobs...</p>
    </div>

    <!-- No Jobs -->
    <div v-else-if="activeJobs.length === 0" class="p-8 text-center">
      <div class="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
        <CheckCircle class="w-10 h-10 text-gray-400" />
      </div>
      <h2 class="text-xl font-semibold text-gray-700 mb-2">All Caught Up!</h2>
      <p class="text-gray-500">No active jobs assigned to you right now.</p>
    </div>

    <!-- Active Jobs -->
    <div v-else class="p-4 space-y-4">
      <div 
        v-for="job in activeJobs" 
        :key="job.id"
        class="bg-white rounded-2xl shadow-lg overflow-hidden"
      >
        <!-- Job Header -->
        <div class="p-4 border-b">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-bold text-gray-900">{{ job.title }}</h3>
              <p class="text-sm text-gray-500">{{ job.properties?.name || 'Unknown Property' }}</p>
            </div>
            <span class="px-3 py-1 text-xs font-medium rounded-full" :class="getStatusBadgeClass(job.status)">
              {{ job.status }}
            </span>
          </div>
          <div v-if="job.scheduled_at" class="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <Clock class="w-4 h-4" />
            {{ formatScheduledTime(job.scheduled_at) }}
          </div>
        </div>

        <!-- Quick Actions / Status Panel -->
        <div class="p-4">
          <WorkerStatusPanel 
            v-if="selectedJobVisit[job.id]"
            :visit-id="selectedJobVisit[job.id]"
            :initial-status="getWorkerStatus(job.id)"
            @status-changed="handleStatusChanged(job.id, $event)"
            @finish-requested="openAttestation(job.id)"
          />
          <div v-else class="text-center py-4 text-gray-400">
            <p>Loading visit...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Attestation Modal -->
    <AttestationModal
      v-if="attestationJob"
      :show="showAttestation"
      :visit-id="selectedJobVisit[attestationJob]"
      :job-id="attestationJob"
      @cancel="closeAttestation"
      @complete="handleAttestationComplete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Clock, CheckCircle } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import { useVisits } from '../composables/useVisits'
import WorkerStatusPanel from '../components/worker/WorkerStatusPanel.vue'
import AttestationModal from '../components/worker/AttestationModal.vue'

const { userProfile, effectiveTenantId } = useAuth()
const { fetchVisitsForJob } = useVisits()

const loading = ref(true)
const activeJobs = ref([])
const selectedJobVisit = ref({})
const workerStatuses = ref({})
const showAttestation = ref(false)
const attestationJob = ref(null)

const userName = computed(() => {
  const p = userProfile.value
  return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Worker' : 'Worker'
})

const loadAssignedJobs = async () => {
  loading.value = true
  
  // Get person ID for current user
  const { data: person } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', userProfile.value?.id)
    .single()
  
  if (!person) {
    loading.value = false
    return
  }
  
  // Get active job assignments
  const { data: assignments } = await supabase
    .from('job_assignments')
    .select(`
      id,
      status,
      job_id,
      jobs (
        id,
        title,
        status,
        type,
        scheduled_at,
        properties (name)
      )
    `)
    .eq('person_id', person.id)
    .not('status', 'in', '(finished,removed,no_show)')
  
  // Filter to only pending/in-progress jobs
  activeJobs.value = (assignments || [])
    .filter(a => a.jobs && !['Complete', 'Cancelled', 'Deferred', 'Not Required'].includes(a.jobs.status))
    .map(a => ({
      ...a.jobs,
      assignmentStatus: a.status,
      assignmentId: a.id
    }))
  
  // Load latest visit for each job
  for (const job of activeJobs.value) {
    const result = await fetchVisitsForJob(job.id)
    if (result.success && result.visits.length > 0) {
      const latestVisit = result.visits.find(v => !['Completed', 'Incomplete', 'Aborted'].includes(v.status)) 
                          || result.visits[result.visits.length - 1]
      selectedJobVisit.value[job.id] = latestVisit.id
    }
  }
  
  loading.value = false
}

const getWorkerStatus = (jobId) => {
  return workerStatuses.value[jobId] || null
}

const handleStatusChanged = (jobId, { status }) => {
  workerStatuses.value[jobId] = status
}

const openAttestation = (jobId) => {
  attestationJob.value = jobId
  showAttestation.value = true
}

const closeAttestation = () => {
  showAttestation.value = false
  attestationJob.value = null
}

const handleAttestationComplete = () => {
  showAttestation.value = false
  attestationJob.value = null
  loadAssignedJobs() // Refresh
}

const formatScheduledTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
         ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getStatusBadgeClass = (status) => {
  if (status === 'Pending') return 'bg-amber-100 text-amber-700'
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700'
  if (status === 'Complete') return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-700'
}

onMounted(loadAssignedJobs)
</script>

<style scoped>
.worker-home {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
