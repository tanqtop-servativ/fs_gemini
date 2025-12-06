<script setup>
import { onMounted } from 'vue'
import { useAuth } from './composables/useAuth'
import Sidebar from './components/Sidebar.vue'
import AppHeader from './components/AppHeader.vue'

const { initAuth, user, loading } = useAuth()

onMounted(() => {
  initAuth()
})
</script>

<template>
  <div v-if="loading" class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
    Loading...
  </div>
  
  <div v-else-if="!user" class="min-h-screen bg-slate-50 text-slate-900">
    <router-view />
  </div>

  <div v-else class="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
    <Sidebar />
    <main class="flex-1 flex flex-col overflow-hidden relative">
      <AppHeader />
      <div class="flex-1 overflow-auto p-0">
          <router-view />
      </div>
    </main>
  </div>
</template>
