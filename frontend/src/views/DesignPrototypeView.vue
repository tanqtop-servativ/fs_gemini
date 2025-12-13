<script setup>
import { ref } from 'vue'
import { Filter, Search, User, Bell, Sparkles } from 'lucide-vue-next'

const jobs = ref([
    {
        id: 1,
        address: '7508 E Laredo Ln, Lot 3, Scottsdale',
        type: 'Turnover',
        status: 'Scheduled for 02/02/2025',
        statusColor: 'text-indigo-600',
        borderColor: 'border-l-4 border-indigo-600'
    },
    {
        id: 2,
        address: '7508 E Laredo Ln, Lot 3, Scottsdale',
        type: 'Inspection',
        status: 'En route. 02/02/2025',
        statusColor: 'text-orange-500',
        borderColor: 'border-l-4 border-orange-500'
    },
    {
        id: 3,
        address: '7508 E Laredo Ln, Lot 3, Scottsdale',
        type: 'Return laundry',
        status: 'Start on 02/02/2025',
        statusColor: 'text-green-600',
        borderColor: 'border-l-4 border-green-600'
    },
    {
        id: 4,
        address: '7508 E Laredo Ln, Lot 3, Scottsdale',
        type: 'STR Warranty',
        status: 'Finished on 02/02/2025',
        statusColor: 'text-gray-400',
        borderColor: 'border-l-4 border-gray-300'
    }
])
</script>

<template>
    <div class="prototype-container min-h-screen bg-slate-50 font-outfit flex">
        
        <!-- Desktop Sidebar (Hidden on mobile) -->
        <aside class="hidden md:flex flex-col w-64 bg-navy-900 text-white shrink-0 h-screen sticky top-0">
            <div class="p-6">
                <div class="text-2xl font-bold tracking-tight mb-10 flex items-center gap-2">
                    <!-- Logo Icon -->
                    <div class="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                        <Sparkles class="w-5 h-5 text-white" />
                    </div>
                    SERVATIV
                </div>
                
                <nav class="space-y-2">
                    <a href="#" class="flex items-center gap-3 px-4 py-3 bg-navy-800 text-white rounded-xl shadow-lg shadow-navy-900/50 font-medium">
                        <Sparkles class="w-5 h-5 text-orange-400" />
                        Jobs
                    </a>
                    <a href="#" class="flex items-center gap-3 px-4 py-3 text-navy-200 hover:text-white hover:bg-navy-800 visited:text-navy-200 rounded-xl transition-colors font-medium">
                        <User class="w-5 h-5" />
                        Technicians
                    </a>
                    <a href="#" class="flex items-center gap-3 px-4 py-3 text-navy-200 hover:text-white hover:bg-navy-800 visited:text-navy-200 rounded-xl transition-colors font-medium">
                        <Bell class="w-5 h-5" />
                         Alerts
                         <span class="ml-auto bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
                    </a>
                </nav>
            </div>
            
            <div class="mt-auto p-6 border-t border-navy-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-navy-700 flex items-center justify-center font-bold text-orange-400 border-2 border-navy-600">Admin</div>
                    <div>
                        <div class="text-sm font-bold">Admin User</div>
                        <div class="text-xs text-navy-300">Servativ Pro</div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 flex flex-col items-center w-full"> 
            <!-- Header -->
            <header class="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center w-full sticky top-0 z-10 backdrop-blur-md bg-white/90">
                <div class="flex items-center gap-4">
                     <!-- Mobile Menu Button Mockup -->
                     <button class="md:hidden p-2 -ml-2 text-navy-900">
                        <Filter class="w-6 h-6" /> <!-- Hamburger placeholder -->
                     </button>
                    <h1 class="text-2xl font-bold text-navy-900">Active Jobs</h1>
                </div>

                <!-- Desktop Search & Actions -->
                <div class="hidden md:flex items-center gap-4">
                     <div class="relative w-96">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search properties, jobs, or people..." 
                            class="w-full pl-10 pr-4 py-2.5 rounded-xg border border-gray-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-navy-500 transition-all font-outfit"
                        >
                    </div>
                    <button class="bg-navy-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-navy-900/20 hover:bg-navy-800 transition-transform active:scale-95 flex items-center gap-2">
                        <Filter class="w-4 h-4" />
                        Filter View
                    </button>
                    <button class="bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-transform active:scale-95">
                        New Job
                    </button>
                </div>
            </header>

            <div class="w-full max-w-7xl p-6 md:p-8 space-y-8">
                
                <!-- Web-Scale: Stats Row -> Utilizing width -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-navy-100 transition-colors">
                        <div>
                            <div class="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Active</div>
                            <div class="text-3xl font-extrabold text-navy-900">24</div>
                        </div>
                        <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                            <Sparkles class="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-orange-100 transition-colors">
                        <div>
                            <div class="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Needs Attention</div>
                            <div class="text-3xl font-extrabold text-orange-600">3</div>
                        </div>
                        <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                            <Bell class="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                     <!-- More stats... -->
                </div>


                <!-- Web-Scale: Grid Layout -->
                <div>
                     <div class="flex justify-between items-end mb-4">
                        <h2 class="text-lg font-bold text-navy-900">Priority Queue</h2>
                        <div class="text-sm text-slate-500 font-medium">Sorted by: <span class="text-navy-900 font-bold">Urgency</span></div>
                     </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div 
                            v-for="job in jobs" 
                            :key="job.id" 
                            class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5 hover:shadow-xl hover:shadow-navy-900/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                        >
                             <!-- Colored Top Bar for rapid scanning -->
                             <div :class="['absolute top-0 left-0 right-0 h-1.5', job.borderColor.replace('border-l-4', 'bg-')]"></div>

                            <!-- Header -->
                            <div class="flex justify-between items-start pt-2">
                                <div :class="['text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-50', job.statusColor]">{{ job.type }}</div>
                                <div class="text-slate-400 hover:text-navy-900 transition-colors"><Filter class="w-4 h-4 rotate-90" /></div>
                            </div>

                            <!-- Content -->
                            <div>
                                <div class="text-navy-900 font-bold text-lg leading-tight mb-1">7508 E Laredo Ln</div>
                                <div class="text-slate-500 text-sm font-medium">Lot 3, Scottsdale</div>
                            </div>

                            <!-- Rich Metadata (Web has space for this) -->
                            <div class="flex items-center gap-4 py-3 border-t border-b border-gray-50">
                                <div class="flex -space-x-2">
                                     <div class="w-8 h-8 rounded-full bg-gray-200 border-2 border-white"></div>
                                     <div class="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">+2</div>
                                </div>
                                <div class="text-sm text-slate-500 font-medium">Assigned Team</div>
                            </div>

                            <!-- Footer -->
                            <div class="flex justify-between items-center mt-auto">
                                <span :class="['text-sm font-bold flex items-center gap-2', job.statusColor]">
                                    <span class="w-2 h-2 rounded-full bg-current"></span>
                                    {{ job.status }}
                                </span>
                                <span class="text-xs text-slate-400 font-bold">#{{ 2400 + job.id }}</span>
                            </div>
                            
                        </div>
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

/* Custom Palette */
.bg-navy-900 { background-color: #010C40; }
.bg-navy-800 { background-color: #0a1652; }
.bg-navy-700 { background-color: #17246b; }
.text-navy-900 { color: #010C40; }
.text-navy-300 { color: #8DA2FB; }
.text-navy-200 { color: #B4C4FF; }
.border-navy-800 { border-color: #0a1652; }

/* Status Colors override for bg- construction */
.bg-text-indigo-600 { background-color: #4F46E5; }
.bg-text-orange-500 { background-color: #F97316; }
.bg-text-green-600 { background-color: #16A34A; }
.bg-text-gray-400 { background-color: #9CA3AF; }

/* Grid Gap fix */
.gap-6 { gap: 1.5rem; }
</style>
