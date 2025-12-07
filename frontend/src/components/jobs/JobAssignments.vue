<script setup>
import { ref, watch, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { UserPlus, X, Clock, Navigation, Play, Pause, CheckCircle2, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  jobId: String,
  jobTitle: String,
  jobTemplateId: String
})

const assignments = ref([])
const loading = ref(false)
const availablePeople = ref([])
const showAddModal = ref(false)
const requiredRoleIds = ref([])

// Fetch required roles for this job's template
const fetchRequiredRoles = async () => {
    if (!props.jobTemplateId) {
        requiredRoleIds.value = []
        return
    }
    
    const { data } = await supabase
        .from('job_template_roles')
        .select('role_id')
        .eq('job_template_id', props.jobTemplateId)
    
    requiredRoleIds.value = (data || []).map(r => r.role_id)
}

// Fetch assignments via RPC
const fetchAssignments = async () => {
  if (!props.jobId) return
  loading.value = true
  
  await fetchRequiredRoles()
  
  const { data, error } = await supabase.rpc('get_job_with_assignments', {
    p_job_id: props.jobId
  })
  
  if (data) {
    // Filter out rows where assignment_id is null (job with no assignments)
    assignments.value = data.filter(row => row.assignment_id)
  }
  loading.value = false
}

const fetchAvailablePeople = async () => {
  const { data } = await supabase
    .from('people')
    .select('id, first_name, last_name, person_roles(role_id, roles(name))')
    .is('deleted_at', null)
    .order('first_name')
  
  availablePeople.value = data || []
}

const filteredPeople = computed(() => {
    // If no required roles, anyone can be assigned
    if (requiredRoleIds.value.length === 0) return availablePeople.value
    
    // Filter to people who have at least one of the required roles
    return availablePeople.value.filter(p => {
        const personRoleIds = (p.person_roles || []).map(pr => pr.role_id)
        return requiredRoleIds.value.some(reqId => personRoleIds.includes(reqId))
    })
})

const addPerson = async (personId) => {
  const { error } = await supabase.rpc('assign_person_to_job', {
    p_job_id: props.jobId,
    p_person_id: personId
  })
  
  if (error) {
    alert('Error: ' + error.message)
  } else {
    showAddModal.value = false
    fetchAssignments()
  }
}

const removeAssignment = async (assignmentId) => {
  if (!confirm('Remove this person from the job?')) return
  
  const { error } = await supabase.rpc('remove_assignment', {
    p_assignment_id: assignmentId
  })
  
  if (error) alert('Error: ' + error.message)
  else fetchAssignments()
}

const markNoShow = async (assignmentId) => {
  if (!confirm('Mark this person as no-show?')) return
  
  const { error } = await supabase.rpc('mark_assignment_no_show', {
    p_assignment_id: assignmentId
  })
  
  if (error) alert('Error: ' + error.message)
  else fetchAssignments()
}

// Format time duration
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '-'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// Calculate work time for an assignment
const getWorkTime = (assignment) => {
  if (!assignment.started_at) return 0
  const end = assignment.finished_at ? new Date(assignment.finished_at) : new Date()
  const start = new Date(assignment.started_at)
  return Math.floor((end - start) / 1000) - (assignment.cumulative_paused_seconds || 0)
}

// Status icon and color mapping
const statusConfig = {
  assigned: { icon: Clock, color: 'text-gray-500 bg-gray-100', label: 'Assigned' },
  en_route: { icon: Navigation, color: 'text-blue-600 bg-blue-50', label: 'On My Way' },
  started: { icon: Play, color: 'text-green-600 bg-green-50', label: 'Working' },
  paused: { icon: Pause, color: 'text-yellow-600 bg-yellow-50', label: 'Paused' },
  finished: { icon: CheckCircle2, color: 'text-green-700 bg-green-100', label: 'Finished' },
  no_show: { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: 'No-Show' }
}

watch(() => props.jobId, fetchAssignments, { immediate: true })
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
    <div class="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
      <h3 class="font-bold text-slate-800 flex items-center gap-2">
        <UserPlus size="18" class="text-blue-600" /> Assigned Workers
      </h3>
      <button 
        @click="showAddModal = true; fetchAvailablePeople()" 
        class="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        <UserPlus size="14" /> Add
      </button>
    </div>
    
    <!-- Loading -->
    <div v-if="loading" class="p-8 text-center text-gray-400">Loading...</div>
    
    <!-- Empty State -->
    <div v-else-if="assignments.length === 0" class="p-8 text-center text-gray-400 italic">
      No one assigned yet.
    </div>
    
    <!-- Assignments List -->
    <div v-else class="divide-y divide-gray-100">
      <div 
        v-for="a in assignments" 
        :key="a.assignment_id" 
        class="p-4 flex items-center gap-4 hover:bg-slate-50"
      >
        <!-- Avatar -->
        <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
          {{ a.person_name?.split(' ').map(n => n[0]).join('').toUpperCase() }}
        </div>
        
        <!-- Info -->
        <div class="flex-1">
          <div class="font-medium text-slate-900">{{ a.person_name }}</div>
          <div class="flex items-center gap-3 mt-1">
            <!-- Status Badge -->
            <span 
              class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"
              :class="statusConfig[a.assignment_status]?.color"
            >
              <component :is="statusConfig[a.assignment_status]?.icon" :size="10" />
              {{ statusConfig[a.assignment_status]?.label }}
            </span>
            
            <!-- Work Time -->
            <span v-if="a.started_at" class="text-xs text-gray-500">
              ⏱️ {{ formatDuration(getWorkTime(a)) }}
            </span>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex gap-2">
          <button 
            v-if="a.assignment_status !== 'finished' && a.assignment_status !== 'no_show'"
            @click="markNoShow(a.assignment_id)" 
            class="text-xs text-red-500 hover:text-red-700"
            title="Mark No-Show"
          >
            No-Show
          </button>
          <button 
            @click="removeAssignment(a.assignment_id)" 
            class="text-gray-400 hover:text-red-500"
            title="Remove"
          >
            <X size="16" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Add Person Modal -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="showAddModal = false"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="p-4 border-b border-gray-100 flex justify-between items-center">
          <h4 class="font-bold">Add Person to Job</h4>
          <button @click="showAddModal = false" class="text-gray-400 hover:text-black"><X size="18" /></button>
        </div>
        <div class="p-4 max-h-64 overflow-y-auto">
          <div 
            v-for="p in filteredPeople" 
            :key="p.id" 
            class="p-3 hover:bg-blue-50 rounded cursor-pointer flex justify-between items-center"
            @click="addPerson(p.id)"
          >
            <span>{{ p.first_name }} {{ p.last_name }}</span>
            <UserPlus size="16" class="text-blue-500" />
          </div>
          <div v-if="filteredPeople.length === 0" class="text-gray-400 text-center py-4">
            No people available
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
