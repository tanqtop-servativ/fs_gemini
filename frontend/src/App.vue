<script setup>
import { onMounted } from 'vue'
import { useAuth } from './composables/useAuth'
import Sidebar from './components/Sidebar.vue'

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
    <main class="flex-1 overflow-auto relative">
      <router-view />
    </main>
  </div>
</template>
