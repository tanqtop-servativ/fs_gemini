<script setup>
import { computed } from 'vue'
import { Home, Calendar, Users, ClipboardList, LogOut, GitMerge, Package, Shield, Activity, Zap, X, LayoutDashboard } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { 
    signOut, userProfile, user, 
    isImpersonating, effectiveTenantName,
    isImpersonatingUser, impersonatedUserName, stopImpersonatingUser
} = useAuth()

const isSuperuser = computed(() => userProfile.value?.is_superuser)

const menuItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
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
      <!-- User Impersonation Banner -->
      <div v-if="isImpersonatingUser" class="mb-3 bg-teal-50 border border-teal-200 rounded-lg p-2 flex justify-between items-center">
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
        class="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <LogOut size="20" />
        <span class="font-medium">Sign Out</span>
      </button>
      
      <!-- User Info -->
      <div v-if="userProfile" class="mt-3 px-4 text-xs space-y-0.5">
        <div class="font-medium text-slate-600 truncate">{{ user?.email }}</div>
        <div :class="isImpersonating ? 'text-amber-600 font-bold' : 'text-slate-400'" class="truncate">
          {{ effectiveTenantName }}
          <span v-if="isImpersonating" class="text-[10px]">(impersonating)</span>
        </div>
      </div>
    </div>
  </aside>
</template>
