<script setup>
import ActivityFeed from '../components/ActivityFeed.vue'
</script>

<template>
  <div class="h-full flex flex-col p-6 bg-slate-50">
    <div class="max-w-4xl mx-auto w-full h-full flex flex-col">
        <div class="mb-6">
            <h1 class="text-2xl font-bold text-slate-900">Activity Feed</h1>
            <p class="text-gray-500 text-sm">Real-time log of system events and communications.</p>
        </div>
        
        <div class="flex-1 min-h-0 bg-gray-50 rounded-xl overflow-hidden">
             <ActivityFeed :limit="100" />
        </div>
    </div>
  </div>
</template>
