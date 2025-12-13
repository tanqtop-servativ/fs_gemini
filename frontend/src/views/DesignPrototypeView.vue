<script setup>
import { ref, computed } from 'vue'
import { 
    LayoutGrid, Columns, Calendar, Clock, MapPin, ArrowRight, 
    ChevronDown, Search, Plus, Filter, Eye, Moon, CheckCircle2,
    AlertCircle, Sparkles, Building, User
} from 'lucide-vue-next'

// View mode toggle
const viewMode = ref('cards') // 'cards', 'kanban', 'timeline'

// Mock data - Service Opportunities
const opportunities = ref([
    {
        id: 1,
        property: '8117 Castle Wynd Dr, Antelope, CA 95843',
        propertyShort: '8117 Castle Wynd Dr',
        city: 'Antelope',
        service: 'Kitting → STR Turnover → Inspection',
        serviceName: 'Full Turnover Package',
        status: 'In Progress',
        source: 'Manual',
        jobs: [
            { id: 1, title: 'Kitting', status: 'Completed', scheduled: true },
            { id: 2, title: 'Airbnb turnaround', status: 'In Progress', scheduled: true, scheduledTime: 'Today, 2:00 PM' },
            { id: 3, title: 'Inspection', status: 'Pending', scheduled: false }
        ],
        dueDate: 'Dec 14, 2025',
        priority: 'high'
    },
    {
        id: 2,
        property: '725 N Mallard St, Chandler, AZ 85226',
        propertyShort: '725 N Mallard St',
        city: 'Chandler',
        service: 'One-off Service',
        serviceName: 'One-off Service',
        status: 'Open',
        source: 'Phone',
        jobs: [
            { id: 4, title: 'Deep Clean', status: 'Pending', scheduled: true, scheduledTime: 'Tomorrow, 9:00 AM' }
        ],
        dueDate: 'Dec 15, 2025',
        priority: 'medium'
    },
    {
        id: 3,
        property: '7751 S Alder Dr, Tempe, AZ 85284',
        propertyShort: '7751 S Alder Dr',
        city: 'Tempe',
        service: 'Kitting → STR Turnover → Inspection',
        serviceName: 'Full Turnover Package',
        status: 'Open',
        source: 'Manual',
        jobs: [
            { id: 5, title: 'Kitting', status: 'Pending', scheduled: false },
            { id: 6, title: 'STR Turnover', status: 'Pending', scheduled: false },
            { id: 7, title: 'Inspection', status: 'Pending', scheduled: false }
        ],
        dueDate: 'Dec 16, 2025',
        priority: 'low'
    },
    {
        id: 4,
        property: '1234 Palm Beach Rd, Phoenix, AZ 85001',
        propertyShort: '1234 Palm Beach Rd',
        city: 'Phoenix',
        service: 'Quarterly Maintenance',
        serviceName: 'Quarterly Maintenance',
        status: 'Pending',
        source: 'Scheduled',
        jobs: [
            { id: 8, title: 'HVAC Check', status: 'Pending', scheduled: true, scheduledTime: 'Dec 20, 10:00 AM' },
            { id: 9, title: 'Pool Service', status: 'Pending', scheduled: true, scheduledTime: 'Dec 20, 11:00 AM' }
        ],
        dueDate: 'Dec 20, 2025',
        priority: 'low'
    },
    {
        id: 5,
        property: '5555 Desert View Ln, Scottsdale, AZ 85250',
        propertyShort: '5555 Desert View Ln',
        city: 'Scottsdale',
        service: 'Emergency Repair',
        serviceName: 'Emergency Repair',
        status: 'In Progress',
        source: 'Phone',
        jobs: [
            { id: 10, title: 'Plumbing Fix', status: 'In Progress', scheduled: true, scheduledTime: 'Now' }
        ],
        dueDate: 'Today',
        priority: 'urgent'
    }
])

// Computed: group by status for Kanban
const kanbanColumns = computed(() => ({
    'Open': opportunities.value.filter(o => o.status === 'Open'),
    'Pending': opportunities.value.filter(o => o.status === 'Pending'),
    'In Progress': opportunities.value.filter(o => o.status === 'In Progress'),
    'Completed': opportunities.value.filter(o => o.status === 'Completed')
}))

// Computed: group by time for Timeline
const timelineGroups = computed(() => ({
    'Today': opportunities.value.filter(o => o.dueDate === 'Today'),
    'Tomorrow': opportunities.value.filter(o => o.dueDate.includes('Dec 15')),
    'This Week': opportunities.value.filter(o => !['Today'].includes(o.dueDate) && !o.dueDate.includes('Dec 15')),
}))

// Helper functions
const getStatusColor = (status) => {
    const map = {
        'Open': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Pending': 'bg-amber-100 text-amber-700 border-amber-200',
        'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
        'Completed': 'bg-slate-100 text-slate-600 border-slate-200'
    }
    return map[status] || 'bg-gray-100 text-gray-600'
}

const getPriorityIndicator = (priority) => {
    const map = {
        'urgent': 'bg-red-500',
        'high': 'bg-orange-500',
        'medium': 'bg-yellow-400',
        'low': 'bg-slate-300'
    }
    return map[priority] || 'bg-slate-300'
}

const getJobStatusColor = (status) => {
    const map = {
        'Completed': 'bg-emerald-500',
        'In Progress': 'bg-blue-500',
        'Pending': 'bg-slate-300'
    }
    return map[status] || 'bg-slate-300'
}

const hasUnscheduledJobs = (opp) => {
    return opp.jobs.some(j => !j.scheduled && j.status !== 'Completed')
}

const getCompletionPercent = (opp) => {
    const completed = opp.jobs.filter(j => j.status === 'Completed').length
    return Math.round((completed / opp.jobs.length) * 100)
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-outfit">
        
        <!-- Header -->
        <header class="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-6 py-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold text-slate-900">Service Opportunities</h1>
                        <p class="text-sm text-slate-500">5 active opportunities</p>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <!-- Search -->
                        <div class="relative hidden md:block">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search opportunities..." 
                                class="pl-10 pr-4 py-2 w-72 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            >
                        </div>
                        
                        <!-- View Toggle -->
                        <div class="flex bg-slate-100 rounded-xl p-1 gap-1">
                            <button 
                                @click="viewMode = 'cards'" 
                                :class="['p-2 rounded-lg transition-all', viewMode === 'cards' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700']"
                                title="Card Grid"
                            >
                                <LayoutGrid class="w-5 h-5" />
                            </button>
                            <button 
                                @click="viewMode = 'kanban'" 
                                :class="['p-2 rounded-lg transition-all', viewMode === 'kanban' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700']"
                                title="Kanban Board"
                            >
                                <Columns class="w-5 h-5" />
                            </button>
                            <button 
                                @click="viewMode = 'timeline'" 
                                :class="['p-2 rounded-lg transition-all', viewMode === 'timeline' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700']"
                                title="Timeline"
                            >
                                <Calendar class="w-5 h-5" />
                            </button>
                        </div>
                        
                        <!-- New Button -->
                        <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 active:scale-95">
                            <Plus class="w-4 h-4" />
                            New Opportunity
                        </button>
                    </div>
                </div>
            </div>
        </header>
        
        <main class="max-w-7xl mx-auto px-6 py-8">
            
            <!-- ===================== CARD GRID VIEW ===================== -->
            <div v-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                    v-for="opp in opportunities" 
                    :key="opp.id"
                    class="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer group overflow-hidden"
                >
                    <!-- Priority stripe -->
                    <div :class="['h-1', getPriorityIndicator(opp.priority)]"></div>
                    
                    <div class="p-5">
                        <!-- Header -->
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span :class="['text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', getStatusColor(opp.status)]">
                                        {{ opp.status }}
                                    </span>
                                    <span v-if="hasUnscheduledJobs(opp)" class="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                        <Clock class="w-3 h-3" />
                                        Unscheduled
                                    </span>
                                </div>
                                <h3 class="font-bold text-slate-900 text-lg leading-tight">{{ opp.propertyShort }}</h3>
                                <p class="text-sm text-slate-500 flex items-center gap-1">
                                    <MapPin class="w-3 h-3" />
                                    {{ opp.city }}
                                </p>
                            </div>
                        </div>
                        
                        <!-- Service -->
                        <div class="bg-slate-50 rounded-xl p-3 mb-4">
                            <p class="text-xs font-bold text-slate-500 uppercase mb-1">Service</p>
                            <p class="text-sm font-semibold text-slate-800">{{ opp.serviceName }}</p>
                        </div>
                        
                        <!-- Workflow Progress -->
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-500 uppercase">Workflow</span>
                                <span class="text-xs font-bold text-slate-600">{{ getCompletionPercent(opp) }}%</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <div 
                                    v-for="(job, idx) in opp.jobs" 
                                    :key="job.id" 
                                    class="flex items-center flex-1"
                                >
                                    <div 
                                        :class="['h-2 rounded-full flex-1 transition-all', getJobStatusColor(job.status)]"
                                        :title="job.title + ' - ' + job.status"
                                    ></div>
                                    <ArrowRight v-if="idx < opp.jobs.length - 1" class="w-3 h-3 text-slate-300 mx-0.5 shrink-0" />
                                </div>
                            </div>
                            <div class="flex items-center gap-1 mt-2">
                                <div 
                                    v-for="job in opp.jobs" 
                                    :key="'label-' + job.id" 
                                    class="flex-1 text-center"
                                >
                                    <span class="text-[9px] font-medium text-slate-500 truncate block">{{ job.title }}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div class="flex items-center justify-between pt-4 border-t border-slate-100">
                            <div class="flex items-center gap-2">
                                <Calendar class="w-4 h-4 text-slate-400" />
                                <span class="text-sm text-slate-600 font-medium">{{ opp.dueDate }}</span>
                            </div>
                            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button class="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Snooze">
                                    <Moon class="w-4 h-4 text-slate-400" />
                                </button>
                                <button class="p-2 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                                    <Eye class="w-4 h-4 text-blue-500" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ===================== KANBAN VIEW ===================== -->
            <div v-else-if="viewMode === 'kanban'" class="flex gap-6 overflow-x-auto pb-4">
                <div 
                    v-for="(items, status) in kanbanColumns" 
                    :key="status"
                    class="flex-shrink-0 w-80"
                >
                    <!-- Column Header -->
                    <div class="flex items-center justify-between mb-4 px-1">
                        <div class="flex items-center gap-2">
                            <span :class="['w-3 h-3 rounded-full', 
                                status === 'Open' ? 'bg-emerald-500' :
                                status === 'Pending' ? 'bg-amber-500' :
                                status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-400'
                            ]"></span>
                            <h3 class="font-bold text-slate-700">{{ status }}</h3>
                        </div>
                        <span class="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{{ items.length }}</span>
                    </div>
                    
                    <!-- Column Cards -->
                    <div class="space-y-3 bg-slate-100/50 rounded-2xl p-3 min-h-[400px]">
                        <div 
                            v-for="opp in items" 
                            :key="opp.id"
                            class="bg-white rounded-xl p-4 shadow-sm border border-slate-200/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                        >
                            <div class="flex items-start justify-between mb-2">
                                <h4 class="font-semibold text-slate-900 text-sm">{{ opp.propertyShort }}</h4>
                                <span v-if="hasUnscheduledJobs(opp)" class="text-red-500">
                                    <Clock class="w-4 h-4" />
                                </span>
                            </div>
                            <p class="text-xs text-slate-500 mb-3">{{ opp.serviceName }}</p>
                            
                            <!-- Mini progress -->
                            <div class="flex gap-1 mb-3">
                                <div 
                                    v-for="job in opp.jobs" 
                                    :key="job.id"
                                    :class="['h-1.5 flex-1 rounded-full', getJobStatusColor(job.status)]"
                                ></div>
                            </div>
                            
                            <div class="flex items-center justify-between text-xs text-slate-500">
                                <span class="flex items-center gap-1">
                                    <MapPin class="w-3 h-3" />
                                    {{ opp.city }}
                                </span>
                                <span>{{ opp.dueDate }}</span>
                            </div>
                        </div>
                        
                        <!-- Empty state -->
                        <div v-if="items.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400">
                            <CheckCircle2 class="w-8 h-8 mb-2" />
                            <p class="text-sm">No items</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ===================== TIMELINE VIEW ===================== -->
            <div v-else-if="viewMode === 'timeline'" class="space-y-8">
                <div v-for="(items, group) in timelineGroups" :key="group" class="space-y-4">
                    <!-- Group Header -->
                    <div class="flex items-center gap-3">
                        <h2 :class="['text-lg font-bold', group === 'Today' ? 'text-blue-600' : 'text-slate-700']">{{ group }}</h2>
                        <span class="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{{ items.length }}</span>
                        <div class="flex-1 h-px bg-slate-200"></div>
                    </div>
                    
                    <!-- Timeline Items -->
                    <div class="space-y-3 pl-6 border-l-2 border-slate-200">
                        <div 
                            v-for="opp in items" 
                            :key="opp.id"
                            class="relative bg-white rounded-xl p-4 shadow-sm border border-slate-200/50 hover:shadow-md transition-all ml-4"
                        >
                            <!-- Timeline dot -->
                            <div :class="['absolute -left-[25px] top-5 w-3 h-3 rounded-full border-2 border-white', getPriorityIndicator(opp.priority)]"></div>
                            
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h4 class="font-bold text-slate-900">{{ opp.propertyShort }}</h4>
                                        <span :class="['text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', getStatusColor(opp.status)]">
                                            {{ opp.status }}
                                        </span>
                                        <span v-if="hasUnscheduledJobs(opp)" class="text-red-500" title="Has unscheduled jobs">
                                            <AlertCircle class="w-4 h-4" />
                                        </span>
                                    </div>
                                    <p class="text-sm text-slate-500">{{ opp.serviceName }}</p>
                                </div>
                                
                                <!-- Next scheduled job -->
                                <div class="text-right">
                                    <p class="text-xs text-slate-400 mb-1">Next Job</p>
                                    <p class="text-sm font-semibold text-slate-700">
                                        {{ opp.jobs.find(j => j.scheduled)?.scheduledTime || 'Unscheduled' }}
                                    </p>
                                </div>
                            </div>
                            
                            <!-- Workflow inline -->
                            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                                <div 
                                    v-for="(job, idx) in opp.jobs" 
                                    :key="job.id"
                                    class="flex items-center gap-2"
                                >
                                    <span :class="['text-xs font-medium px-2 py-1 rounded-lg', 
                                        job.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                        job.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                    ]">
                                        {{ job.title }}
                                    </span>
                                    <ArrowRight v-if="idx < opp.jobs.length - 1" class="w-3 h-3 text-slate-300" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Empty state -->
                    <div v-if="items.length === 0" class="pl-10 text-slate-400 text-sm italic">
                        Nothing scheduled
                    </div>
                </div>
            </div>
            
        </main>
    </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

.font-outfit {
    font-family: 'Outfit', sans-serif;
}
</style>
