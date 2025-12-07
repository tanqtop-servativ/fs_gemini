<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  modelValue: Boolean, // controls visibility
  x: Number,
  y: Number,
  options: {
    type: Array,
    default: () => [] // { label, icon, action, class }
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const menuRef = ref(null)

const positionStyle = computed(() => {
    return {
        top: `${props.y}px`,
        left: `${props.x}px`
    }
})

const close = () => {
    emit('update:modelValue', false)
}

const handleClickOutside = (e) => {
    if (menuRef.value && !menuRef.value.contains(e.target)) {
        close()
    }
}

onMounted(() => {
    // Defer listener to avoid capturing the opening click/contextmenu event
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
        document.addEventListener('contextmenu', handleClickOutside) 
    }, 0)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('contextmenu', handleClickOutside)
})

const selectOption = (opt) => {
    opt.action()
    close()
}
</script>

<template>
  <div 
    v-if="modelValue" 
    ref="menuRef"
    class="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
    :style="positionStyle"
  >
      <button 
        v-for="(opt, idx) in options" 
        :key="idx"
        @click="selectOption(opt)"
        class="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
        :class="opt.class || 'text-slate-700'"
      >
          <component v-if="opt.icon" :is="opt.icon" size="14" />
          {{ opt.label }}
      </button>
  </div>
</template>
