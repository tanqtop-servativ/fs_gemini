<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import { Search, Loader2, MapPin, User, Briefcase, FileText, Zap } from 'lucide-vue-next'

const router = useRouter()
const { effectiveTenantId } = useAuth()

const query = ref('')
const results = ref([])
const loading = ref(false)
const showResults = ref(false)
const searchContainer = ref(null)
let debounceTimeout

// Debounced Search
watch(query, (newVal) => {
    clearTimeout(debounceTimeout)
    if (!newVal || newVal.length < 2) {
        results.value = []
        return
    }
    
    loading.value = true
    showResults.value = true
    
    debounceTimeout = setTimeout(async () => {
        try {
            const { data, error } = await supabase.rpc('search_global', {
                p_query_text: newVal,
                p_tenant_id: effectiveTenantId.value
            })
            if (error) throw error
            results.value = data || []
        } catch (e) {
            console.error(e)
        } finally {
            loading.value = false
        }
    }, 300)
})

const getIcon = (type) => {
    switch (type) {
        case 'property': return MapPin
        case 'person': return User
        case 'job': return Briefcase
        case 'service_template': return FileText
        case 'service_opportunity': return Zap
        default: return Search
    }
}

const handleSelect = (item) => {
    showResults.value = false
    query.value = ''
    
    if (item.link) {
        router.push(item.link)
    } else if (item.type === 'job') {
        router.push(`/jobs/${item.id}`)
    } else {
        // Fallback for types without direct links (like service opps for now)
        // Just log or maybe implement specific query param handling later
        console.log('Selected item without link:', item)
    }
}

// Close on click outside
const handleClickOutside = (event) => {
    if (searchContainer.value && !searchContainer.value.contains(event.target)) {
        showResults.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
    <div ref="searchContainer" class="relative w-full">
        <!-- Input -->
        <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size="18" />
            <input 
                v-model="query"
                type="text" 
                placeholder="Search for anything..." 
                class="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                @focus="showResults = true"
            />
            <div v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 class="animate-spin text-blue-500" size="16" />
            </div>
        </div>

        <!-- Dropdown -->
        <div 
            v-if="showResults && (results.length > 0 || (query.length >= 2 && !loading))"
            class="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 max-h-[60vh] overflow-y-auto z-50"
        >
            <div v-if="results.length === 0 && !loading" class="p-4 text-center text-sm text-gray-400 italic">
                No results found for "{{ query }}"
            </div>

            <div v-else class="py-2">
                <button 
                    v-for="item in results" 
                    :key="item.id + item.type"
                    @click="handleSelect(item)"
                    class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-start gap-3 transition-colors group"
                >
                    <div class="mt-0.5 p-1.5 bg-slate-100 rounded-md text-slate-500 group-hover:bg-white group-hover:text-blue-500 group-hover:shadow-sm transition-all">
                        <component :is="getIcon(item.type)" size="16" />
                    </div>
                    <div>
                        <div class="text-sm font-medium text-slate-800">{{ item.title }}</div>
                        <div class="text-xs text-gray-400">{{ item.subtitle }}</div>
                    </div>
                    <div v-if="item.rank" class="ml-auto text-[10px] text-gray-300 self-center">
                        {{ item.type.replace('_', ' ') }}
                    </div>
                </button>
            </div>
        </div>
    </div>
</template>
