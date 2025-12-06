<script setup>
import { useRoute } from 'vue-router'
import GlobalSearch from './GlobalSearch.vue'

const route = useRoute()

// Map route names to display titles
const getTitle = () => {
    if (!route.name) return ''
    const name = route.name.toString()
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')
}
</script>

<template>
  <header class="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10 h-16">
     <!-- Left: Page Title -->
     <div class="hidden md:block w-48">
         <h2 class="text-lg font-bold text-slate-800 capitalize">{{ getTitle() }}</h2>
     </div>

     <!-- Center: Search -->
     <div class="flex-1 max-w-xl mx-auto">
         <GlobalSearch />
     </div>

     <!-- Right: Spacer for now -->
     <div class="hidden md:block w-48"></div>
  </header>
</template>
