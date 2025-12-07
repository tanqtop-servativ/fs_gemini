<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { Camera, Image as ImageIcon, Trash2, UploadCloud } from 'lucide-vue-next'
import { uploadFile } from '../../lib/upload'

const props = defineProps({
  jobId: String
})

const photos = ref([])
const loading = ref(true)
const uploading = ref(false)
const fileInput = ref(null)

const fetchPhotos = async () => {
    loading.value = true
    // TODO: attachments table doesn't exist yet - skipping fetch
    // const { data } = await supabase
    //     .from('attachments')
    //     .select('*')
    //     .eq('record_id', props.jobId)
    //     .eq('status', 'active')
    //     .order('created_at', { ascending: false })
    
    photos.value = []  // Empty for now
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
        
        // Save to DB
        const { error } = await supabase.from('attachments').insert({
            record_id: props.jobId,
            file_name: file.name,
            file_type: file.type,
            file_path: publicUrl,
            status: 'active',
            file_size: file.size
        })

        if (error) throw error
        
        fetchPhotos()
    } catch (e) {
        alert("Upload failed: " + e.message)
    } finally {
        uploading.value = false
        if (fileInput.value) fileInput.value.value = ''
    }
}

const deletePhoto = async (id) => {
    if (!confirm("Delete this photo?")) return
    const { error } = await supabase
        .from('attachments')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', id)
    
    if (error) alert("Error deleting: " + error.message)
    else fetchPhotos()
}

onMounted(fetchPhotos)
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
      <div class="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
              <Camera class="text-indigo-600" size="18" /> Photos
          </h3>
          <button @click="fileInput.click()" :disabled="uploading" class="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline disabled:opacity-50">
              <UploadCloud size="14" /> {{ uploading ? 'Uploading...' : 'Upload Photo' }}
          </button>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileSelect">
      </div>
      
      <div class="p-4 bg-slate-50/50">
          <div v-if="loading" class="text-center text-gray-400 py-4">Loading photos...</div>
          <div v-else-if="photos.length === 0" class="text-center py-8 text-gray-400 italic text-sm">
              No photos attached.
          </div>
          
          <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div v-for="p in photos" :key="p.id" class="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <img :src="p.file_path" class="w-full h-full object-cover transition group-hover:scale-105 select-none" loading="lazy">
                  
                  <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2">
                      <div class="text-[10px] text-white truncate mb-1">{{ p.file_name }}</div>
                      <div class="flex justify-between items-center">
                          <a :href="p.file_path" target="_blank" class="text-xs text-white hover:underline">View</a>
                          <button @click="deletePhoto(p.id)" class="text-red-400 hover:text-red-200">
                              <Trash2 size="14" />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  </div>
</template>
