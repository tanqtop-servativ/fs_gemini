<template>
  <div class="visit-history">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Visit History</h3>
    
    <div v-if="loading" class="text-center py-8 text-gray-500">
      <div class="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
      <p class="mt-2">Loading visits...</p>
    </div>
    
    <div v-else-if="visits.length === 0" class="text-center py-8 text-gray-500">
      <Clock class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>No visits yet</p>
    </div>
    
    <div v-else class="space-y-4">
      <div
        v-for="visit in visits"
        :key="visit.id"
        class="border rounded-xl overflow-hidden"
        :class="getVisitBorderClass(visit.status)"
      >
        <!-- Visit Header -->
        <div class="p-4 flex items-center justify-between" :class="getVisitHeaderClass(visit.status)">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" :class="getVisitNumberClass(visit.status)">
              {{ visit.visit_number }}
            </div>
            <div>
              <p class="font-semibold">Visit {{ visit.visit_number }}</p>
              <p class="text-sm opacity-75">{{ formatDate(visit.scheduled_start || visit.created_at) }}</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-sm font-medium" :class="getStatusBadgeClass(visit.status)">
            {{ visit.status }}
          </span>
        </div>
        
        <!-- Visit Details (Expandable) -->
        <div v-if="expandedVisitId === visit.id" class="p-4 border-t bg-white">
          <!-- Worker Statuses -->
          <div v-if="visitDetails[visit.id]?.workers?.length" class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Workers</h4>
            <div class="space-y-2">
              <div
                v-for="worker in visitDetails[visit.id].workers"
                :key="worker.person_id"
                class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <span class="font-medium text-gray-900">{{ worker.person_name }}</span>
                <span class="text-sm" :class="getWorkerStatusClass(worker.status)">
                  {{ worker.status }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Artifacts -->
          <div v-if="visitArtifacts[visit.id]?.length" class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Artifacts</h4>
            <div class="space-y-2">
              <div
                v-for="artifact in visitArtifacts[visit.id]"
                :key="artifact.id"
                class="p-3 border rounded-lg"
                :class="artifact.is_invalidated ? 'bg-red-50 border-red-200' : 'bg-white'"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium" :class="getArtifactTypeClass(artifact.artifact_type)">
                    {{ formatArtifactType(artifact.artifact_type) }}
                  </span>
                  <span v-if="artifact.is_invalidated" class="text-xs text-red-600 font-medium">
                    INVALIDATED
                  </span>
                </div>
                <p class="text-sm text-gray-600">
                  {{ artifact.submitted_by_name }} ({{ artifact.role_name }})
                </p>
                <p class="text-xs text-gray-500">
                  {{ formatDate(artifact.submitted_at) }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Status History -->
          <div v-if="visitDetails[visit.id]?.status_history?.length">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Status Timeline</h4>
            <div class="relative pl-4 border-l-2 border-gray-200 space-y-3">
              <div
                v-for="(log, idx) in visitDetails[visit.id].status_history"
                :key="idx"
                class="relative"
              >
                <div class="absolute -left-[21px] w-3 h-3 rounded-full border-2 border-white" :class="getTimelineDotClass(log.status)"></div>
                <p class="text-sm">
                  <span class="font-medium">{{ log.person_name }}</span>
                  <span class="text-gray-600"> → {{ log.status }}</span>
                </p>
                <p class="text-xs text-gray-500">{{ formatTime(log.recorded_at) }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Expand/Collapse Button -->
        <button
          @click="toggleExpand(visit.id)"
          class="w-full p-2 text-sm text-gray-500 hover:bg-gray-50 border-t flex items-center justify-center gap-1"
        >
          <ChevronDown class="w-4 h-4 transition-transform" :class="expandedVisitId === visit.id ? 'rotate-180' : ''" />
          {{ expandedVisitId === visit.id ? 'Collapse' : 'View Details' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { Clock, ChevronDown } from 'lucide-vue-next'
import { useVisits } from '../../composables/useVisits'

const props = defineProps({
  jobId: { type: String, required: true }
})

const { fetchVisitsForJob, getVisitDetails, getArtifactsForVisit } = useVisits()

const loading = ref(true)
const visits = ref([])
const expandedVisitId = ref(null)
const visitDetails = ref({})
const visitArtifacts = ref({})

const loadVisits = async () => {
  loading.value = true
  const result = await fetchVisitsForJob(props.jobId)
  if (result.success) {
    visits.value = result.visits
  }
  loading.value = false
}

const toggleExpand = async (visitId) => {
  if (expandedVisitId.value === visitId) {
    expandedVisitId.value = null
    return
  }
  
  expandedVisitId.value = visitId
  
  // Load details if not cached
  if (!visitDetails.value[visitId]) {
    const result = await getVisitDetails(visitId)
    if (result.success) {
      visitDetails.value[visitId] = result.data
    }
  }
  
  if (!visitArtifacts.value[visitId]) {
    const result = await getArtifactsForVisit(visitId)
    if (result.success) {
      visitArtifacts.value[visitId] = result.artifacts
    }
  }
}

const formatDate = (iso) => {
  if (!iso) return 'Not scheduled'
  return new Date(iso).toLocaleDateString(undefined, { 
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const formatTime = (iso) => {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatArtifactType = (type) => {
  return type.replace('Artifact', '').replace(/([A-Z])/g, ' $1').trim()
}

const getVisitBorderClass = (status) => {
  if (status === 'Completed') return 'border-emerald-200'
  if (status === 'Incomplete') return 'border-amber-200'
  if (status === 'Aborted') return 'border-red-200'
  if (status === 'In Progress') return 'border-blue-200'
  return 'border-gray-200'
}

const getVisitHeaderClass = (status) => {
  if (status === 'Completed') return 'bg-emerald-50'
  if (status === 'Incomplete') return 'bg-amber-50'
  if (status === 'Aborted') return 'bg-red-50'
  if (status === 'In Progress') return 'bg-blue-50'
  return 'bg-gray-50'
}

const getVisitNumberClass = (status) => {
  if (status === 'Completed') return 'bg-emerald-600 text-white'
  if (status === 'Incomplete') return 'bg-amber-600 text-white'
  if (status === 'Aborted') return 'bg-red-600 text-white'
  if (status === 'In Progress') return 'bg-blue-600 text-white'
  return 'bg-gray-400 text-white'
}

const getStatusBadgeClass = (status) => {
  if (status === 'Completed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Incomplete') return 'bg-amber-100 text-amber-700'
  if (status === 'Aborted') return 'bg-red-100 text-red-700'
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

const getWorkerStatusClass = (status) => {
  if (status === 'Finished') return 'text-emerald-600'
  if (status === 'Started') return 'text-blue-600'
  if (status === 'Paused') return 'text-amber-600'
  if (status === 'No-show') return 'text-red-600'
  if (status === 'On My Way') return 'text-blue-500'
  return 'text-gray-600'
}

const getArtifactTypeClass = (type) => {
  if (type === 'CompletionArtifact') return 'text-emerald-700'
  if (type === 'IncompletionArtifact') return 'text-amber-700'
  if (type === 'CorrectionArtifact') return 'text-blue-700'
  return 'text-gray-700'
}

const getTimelineDotClass = (status) => {
  if (status === 'Finished') return 'bg-emerald-500'
  if (status === 'Started') return 'bg-blue-500'
  if (status === 'Paused') return 'bg-amber-500'
  if (status === 'No-show') return 'bg-red-500'
  if (status === 'On My Way') return 'bg-blue-400'
  return 'bg-gray-400'
}

onMounted(loadVisits)

watch(() => props.jobId, loadVisits)
</script>
