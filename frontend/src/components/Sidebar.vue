<script setup>
import { computed } from 'vue'
import { Home, Calendar, Users, ClipboardList, LogOut, GitMerge, Package, Shield, Activity, Zap } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { signOut, userProfile } = useAuth()

const isSuperuser = computed(() => userProfile.value?.is_superuser)

const menuItems = [
  { name: 'Calendar', path: '/calendar', icon: Calendar },
  { name: 'Job Templates', path: '/job-templates', icon: ClipboardList },
  { name: 'Service Templates', path: '/service-templates', icon: GitMerge },
  { name: 'BOM Templates', path: '/bom-templates', icon: Package },
  { name: 'Properties', path: '/properties', icon: Home },
  { name: 'Service Opps', path: '/service-opportunities', icon: Zap },
  { name: 'Staff & Users', path: '/people', icon: Users },
  { name: 'Activity Feed', path: '/activity', icon: Activity },
]

const handleLogout = async () => {
    await signOut()
    router.push('/login')
}
</script>

<template>
  <aside class="w-64 bg-white text-slate-900 flex flex-col h-full border-r border-gray-200">
    <div class="p-6">
      <h1 class="text-xl font-bold flex items-center gap-2 text-slate-900">
        <Shield class="w-6 h-6 text-slate-900" />
        ServativPro
      </h1>
    </div>

    <nav class="flex-1 px-4 space-y-1">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        active-class="active"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="font-medium">{{ item.name }}</span>
      </router-link>

      <div v-if="isSuperuser" class="border-t border-gray-100 mt-2 pt-2">
        <RouterLink to="/admin" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-red-500 hover:bg-red-50" active-class="active">
            <Shield class="w-5 h-5" />
            <span class="font-medium">Admin</span>
        </RouterLink>
      </div>
    </nav>

    <div class="p-4 border-t border-gray-200">
      <button
        @click="handleLogout"
        class="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <LogOut size="20" />
        <span class="font-medium">Sign Out</span>
      </button>
      
      <!-- User Info -->
      <div v-if="userProfile" class="mt-3 px-4 text-xs text-slate-400 space-y-0.5">
        <div class="font-medium text-slate-600 truncate">{{ userProfile.email }}</div>
        <div class="truncate">{{ userProfile.tenants?.name || 'No Tenant' }}</div>
      </div>
    </div>
  </aside>
</template>
