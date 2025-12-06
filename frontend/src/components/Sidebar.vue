<script setup>
import { computed, ref } from 'vue'
import { Home, Calendar, Users, ClipboardList, LogOut, CheckSquare, GitMerge, Package, Shield, Activity, Zap } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { signOut, userProfile } = useAuth()

const isSuperuser = computed(() => userProfile.value?.is_superuser)

const menuItems = ref([
  { name: 'Calendar', path: '/calendar', icon: Calendar },
])

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
        <component :is="item.icon" size="20" />
        <span class="font-medium">{{ item.name }}</span>
      </router-link>

      <RouterLink to="/job-templates" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <ClipboardList class="w-5 h-5" />
        <span class="font-medium">Job Templates</span>
      </RouterLink>

      <RouterLink to="/service-templates" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <GitMerge class="w-5 h-5" />
        <span class="font-medium">Service Templates</span>
      </RouterLink>

      <RouterLink to="/bom-templates" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <Package class="w-5 h-5" />
        <span class="font-medium">BOM Templates</span>
      </RouterLink>

      <RouterLink to="/properties" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <Home class="w-5 h-5" />
        <span class="font-medium">Properties</span>
      </RouterLink>

      <RouterLink to="/service-opportunities" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <Zap class="w-5 h-5" />
        <span class="font-medium">Service Opps</span>
      </RouterLink>

      <RouterLink to="/people" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <Users class="w-5 h-5" />
        <span class="font-medium">Staff & Users</span>
      </RouterLink>

      <RouterLink to="/activity" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-l-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-900" active-class="active">
        <Activity class="w-5 h-5" />
        <span class="font-medium">Activity Feed</span>
      </RouterLink>

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
    </div>
  </aside>
</template>
