<script setup>
import { ref, onMounted, watch } from 'vue'
import { Camera, Trash2, UploadCloud } from 'lucide-vue-next'
import { uploadFile } from '../../lib/upload'
import { useJobs } from '../../composables/useJobs'

const props = defineProps({
  jobId: String
})

const { listPhotos, addPhoto, deletePhoto: deletePhotoRpc } = useJobs()

const photos = ref([])
const loading = ref(true)
const uploading = ref(false)
const fileInput = ref(null)

const fetchPhotos = async () => {
    if (!props.jobId) return
    loading.value = true
    
    const result = await listPhotos(props.jobId)
    photos.value = result.success ? result.photos : []
    loading.value = false
}

const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    uploading.value = true
    try {
        const ext = file.name.split('.').pop()
        const filename = `jobs/${props.jobId}/${Date.now()}.${ext}`
        
        const publicUrl = await uploadFile(file, filename)
        
        const result = await addPhoto(props.jobId, publicUrl, file.name)
        
        if (!result.success) throw new Error(result.error)
        
        fetchPhotos()
    } catch (e) {
        alert("Upload failed: " + e.message)
    } finally {
        uploading.value = false
        if (fileInput.value) fileInput.value.value = ''
    }
}

const handleDelete = async (photoId) => {
    if (!confirm("Delete this photo?")) return
    
    const result = await deletePhotoRpc(photoId)
    if (result.success) {
        fetchPhotos()
    } else {
        alert("Error deleting: " + result.error)
    }
}

watch(() => props.jobId, fetchPhotos, { immediate: true })
</script>

<template>
  <div>
      <div class="flex justify-between items-center mb-4">
          <span class="text-sm text-gray-500">{{ photos.length }} photo(s)</span>
          <button @click="fileInput.click()" :disabled="uploading" class="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline disabled:opacity-50">
              <UploadCloud size="14" /> {{ uploading ? 'Uploading...' : 'Upload Photo' }}
          </button>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileSelect">
      </div>
      
      <div v-if="loading" class="text-center text-gray-400 py-4 text-sm">Loading photos...</div>
      <div v-else-if="photos.length === 0" class="text-center py-8 text-gray-400 italic text-sm">
          No photos attached.
      </div>
      
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div v-for="p in photos" :key="p.id" class="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <img :src="p.photo_url" class="w-full h-full object-cover transition group-hover:scale-105" loading="lazy">
              
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2">
                  <div class="text-[10px] text-white truncate mb-1">{{ p.caption || 'Photo' }}</div>
                  <div class="flex justify-between items-center">
                      <a :href="p.photo_url" target="_blank" class="text-xs text-white hover:underline">View</a>
                      <button @click="handleDelete(p.id)" class="text-red-400 hover:text-red-200">
                          <Trash2 size="14" />
                      </button>
                  </div>
              </div>
          </div>
      </div>
  </div>
</template>
