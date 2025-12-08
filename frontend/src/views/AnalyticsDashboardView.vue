<template>
  <div class="analytics-dashboard p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
      <select v-model="periodDays" @change="loadAllData" class="px-4 py-2 border rounded-lg">
        <option :value="30">Last 30 days</option>
        <option :value="60">Last 60 days</option>
        <option :value="90">Last 90 days</option>
      </select>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-sm text-gray-500 mb-1">First Attempt Success</p>
        <p class="text-3xl font-bold text-emerald-600">{{ retryData?.first_attempt_success_rate || 0 }}%</p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-sm text-gray-500 mb-1">Correction Rate</p>
        <p class="text-3xl font-bold" :class="(correctionData?.correction_rate || 0) > 10 ? 'text-amber-600' : 'text-green-600'">
          {{ correctionData?.correction_rate || 0 }}%
        </p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-sm text-gray-500 mb-1">Total Jobs</p>
        <p class="text-3xl font-bold text-gray-900">{{ retryData?.total_jobs || 0 }}</p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-sm text-gray-500 mb-1">Avg Visits/Job</p>
        <p class="text-3xl font-bold text-blue-600">{{ retryData?.avg_visits_per_job || '1.0' }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Worker Leaderboard -->
      <div class="bg-white rounded-xl shadow">
        <div class="p-4 border-b">
          <h2 class="text-lg font-semibold">Worker Integrity Leaderboard</h2>
        </div>
        <div class="p-4">
          <div v-if="loadingLeaderboard" class="text-center py-8 text-gray-400">
            Loading...
          </div>
          <div v-else-if="leaderboard.length === 0" class="text-center py-8 text-gray-400">
            No worker data
          </div>
          <div v-else class="space-y-3">
            <div 
              v-for="(worker, idx) in leaderboard.slice(0, 10)" 
              :key="worker.person_id"
              class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50"
            >
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                   :class="idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'">
                {{ idx + 1 }}
              </div>
              <div class="flex-1">
                <p class="font-medium text-gray-900">{{ worker.person_name }}</p>
                <p class="text-xs text-gray-500">
                  {{ worker.completions }} completions · {{ worker.no_shows }} no-shows
                </p>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold" :class="getScoreColor(worker.integrity_score)">
                  {{ worker.integrity_score }}
                </p>
                <p class="text-xs text-gray-400">score</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Failure Patterns -->
      <div class="bg-white rounded-xl shadow">
        <div class="p-4 border-b">
          <h2 class="text-lg font-semibold">Failure Patterns</h2>
        </div>
        <div class="p-4">
          <div v-if="loadingFailures" class="text-center py-8 text-gray-400">
            Loading...
          </div>
          <div v-else-if="failurePatterns.length === 0" class="text-center py-8 text-gray-400">
            No failure patterns detected
          </div>
          <div v-else class="space-y-3">
            <div 
              v-for="pattern in failurePatterns" 
              :key="pattern.reason_code"
              class="p-3 border rounded-lg"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">{{ formatReasonCode(pattern.reason_code) }}</span>
                <span class="px-2 py-1 text-xs font-medium rounded-full" :class="getFailureTypeClass(pattern.failure_type)">
                  {{ pattern.failure_type }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span>{{ pattern.total_count }} occurrences</span>
                <span>{{ pattern.unique_workers }} workers</span>
                <span>{{ pattern.unique_properties }} properties</span>
              </div>
              <p class="mt-2 text-sm text-blue-600">{{ pattern.recommendation }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Retry Analysis by Job Type -->
    <div class="mt-6 bg-white rounded-xl shadow">
      <div class="p-4 border-b">
        <h2 class="text-lg font-semibold">Retry Rate by Job Type</h2>
      </div>
      <div class="p-4">
        <div v-if="!retryData?.by_job_type" class="text-center py-8 text-gray-400">
          No data
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            v-for="item in retryData.by_job_type" 
            :key="item.job_type"
            class="p-4 border rounded-lg text-center"
          >
            <p class="text-sm text-gray-500 mb-1">{{ item.job_type || 'Unknown' }}</p>
            <p class="text-2xl font-bold" :class="item.retry_rate > 20 ? 'text-red-600' : 'text-green-600'">
              {{ item.retry_rate }}%
            </p>
            <p class="text-xs text-gray-400">{{ item.multi_visit }}/{{ item.total }} need retry</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAnalytics } from '../composables/useAnalytics'

const { 
  analyzeFailurePatterns, 
  getRetryAnalysis, 
  getCorrectionAnalysis, 
  getWorkerLeaderboard,
  getScoreColor 
} = useAnalytics()

const periodDays = ref(90)
const loadingLeaderboard = ref(true)
const loadingFailures = ref(true)

const leaderboard = ref([])
const failurePatterns = ref([])
const retryData = ref(null)
const correctionData = ref(null)

const loadAllData = async () => {
  loadingLeaderboard.value = true
  loadingFailures.value = true

  const [lb, fp, ra, ca] = await Promise.all([
    getWorkerLeaderboard(periodDays.value),
    analyzeFailurePatterns(periodDays.value),
    getRetryAnalysis(periodDays.value),
    getCorrectionAnalysis(periodDays.value)
  ])

  if (lb.success) leaderboard.value = lb.data
  if (fp.success) failurePatterns.value = fp.data
  if (ra.success) retryData.value = ra.data
  if (ca.success) correctionData.value = ca.data

  loadingLeaderboard.value = false
  loadingFailures.value = false
}

const formatReasonCode = (code) => {
  if (!code) return 'Unknown'
  return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const getFailureTypeClass = (type) => {
  if (type === 'PROCESS') return 'bg-blue-100 text-blue-700'
  if (type === 'HUMAN') return 'bg-red-100 text-red-700'
  if (type === 'PROPERTY') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

onMounted(loadAllData)
</script>
