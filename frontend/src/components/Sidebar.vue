<script setup>
import { computed, ref } from 'vue'
import { Home, Calendar, Users, ClipboardList, LogOut, GitMerge, Package, Shield, Activity, Zap, X, LayoutDashboard, Briefcase, BarChart3, Terminal, Menu } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useDebugLifecycle } from '../composables/useDebugLifecycle'

useDebugLifecycle('Sidebar')

const router = useRouter()
const { 
    signOut, userProfile, user, 
    isImpersonating, effectiveTenantName,
    isImpersonatingUser, impersonatedUserName, stopImpersonatingUser
} = useAuth()

const isSuperuser = computed(() => userProfile.value?.is_superuser)
const isCollapsed = ref(false)

const menuItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Service Opps', path: '/service-opportunities', icon: Zap },
  { name: 'Calendar', path: '/calendar', icon: Calendar },
  { name: 'Jobs', path: '/jobs', icon: Briefcase },
  { name: 'Service Templates', path: '/service-templates', icon: GitMerge },
  { name: 'Job Templates', path: '/job-templates', icon: ClipboardList },
  { name: 'BOM Templates', path: '/bom-templates', icon: Package },
  { name: 'Properties', path: '/properties', icon: Home },
  { name: 'Staff & Users', path: '/people', icon: Users },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Activity Feed', path: '/activity', icon: Activity },
  { name: 'Power User', path: '/power-user', icon: Terminal },
]

const handleLogout = async () => {
    await signOut()
    router.push('/login')
}
</script>

<template>
  <aside 
    :class="isCollapsed ? 'w-16' : 'w-64'" 
    class="bg-white text-slate-900 flex flex-col h-full border-r border-gray-200 transition-all duration-200"
  >
    <div class="p-4 flex items-center gap-2" :class="isCollapsed ? 'justify-center' : 'justify-between'">
      <div class="flex items-center gap-2 overflow-hidden">
        <img src="/logo.png" alt="ServativPro" class="w-8 h-8 rounded flex-shrink-0" />
        <h1 v-if="!isCollapsed" class="text-xl font-bold text-slate-900 whitespace-nowrap">ServativPro</h1>
      </div>
      <button 
        @click="isCollapsed = !isCollapsed" 
        class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
        :title="isCollapsed ? 'Expand menu' : 'Collapse menu'"
      >
        <Menu size="18" />
      </button>
    </div>

    <nav class="flex-1 px-2 space-y-1">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="sidebar-link flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900 relative group"
        :class="isCollapsed ? 'justify-center' : ''"
        active-class="active"
        :title="isCollapsed ? item.name : ''"
      >
        <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
        <span v-if="!isCollapsed" class="font-medium whitespace-nowrap">{{ item.name }}</span>
        <!-- Tooltip for collapsed mode -->
        <div 
          v-if="isCollapsed" 
          class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
        >
          {{ item.name }}
        </div>
      </router-link>

      <div v-if="isSuperuser" class="border-t border-gray-100 mt-2 pt-2">
        <RouterLink 
          to="/admin" 
          class="sidebar-link flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-red-500 hover:bg-red-50 relative group" 
          :class="isCollapsed ? 'justify-center' : ''"
          active-class="active"
          :title="isCollapsed ? 'Admin' : ''"
        >
            <Shield class="w-5 h-5 flex-shrink-0" />
            <span v-if="!isCollapsed" class="font-medium">Admin</span>
            <div 
              v-if="isCollapsed" 
              class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
            >
              Admin
            </div>
        </RouterLink>
      </div>
    </nav>

    <div class="p-2 border-t border-gray-200">
      <!-- User Impersonation Banner -->
      <div v-if="isImpersonatingUser && !isCollapsed" class="mb-3 bg-teal-50 border border-teal-200 rounded-lg p-2 flex justify-between items-center">
        <div class="text-xs">
          <div class="font-bold text-teal-800">Viewing as:</div>
          <div class="text-teal-600 truncate">{{ impersonatedUserName }}</div>
        </div>
        <button @click="stopImpersonatingUser" class="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-100 rounded" title="Stop viewing as user">
          <X size="14" />
        </button>
      </div>

      <button
        @click="handleLogout"
        class="flex items-center gap-3 px-3 py-3 w-full text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors relative group"
        :class="isCollapsed ? 'justify-center' : ''"
        :title="isCollapsed ? 'Sign Out' : ''"
      >
        <LogOut size="20" class="flex-shrink-0" />
        <span v-if="!isCollapsed" class="font-medium">Sign Out</span>
        <div 
          v-if="isCollapsed" 
          class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
        >
          Sign Out
        </div>
      </button>
      
      <!-- User Info -->
      <div v-if="userProfile && !isCollapsed" class="mt-3 px-3 text-xs space-y-0.5">
        <div class="font-medium text-slate-600 truncate">{{ user?.email }}</div>
        <div :class="isImpersonating ? 'text-amber-600 font-bold' : 'text-slate-400'" class="truncate">
          {{ effectiveTenantName }}
          <span v-if="isImpersonating" class="text-[10px]">(impersonating)</span>
        </div>
      </div>
    </div>
  </aside>
</template>
