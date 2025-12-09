/**
 * useJobs composable
 * Centralizes job management - ALL business logic via database RPCs
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useJobs() {
    const { effectiveTenantId } = useAuth()

    /**
     * Fetch jobs list with filtering
     * @param {Object} options
     * @param {Array<string>} [options.statusFilter] - Status values to include
     * @returns {Promise<{success: boolean, jobs?: Array, error?: string}>}
     */
    const fetchJobs = async ({ statusFilter = [] } = {}) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        let query = supabase
            .from('jobs')
            .select(`
                *,
                properties (name),
                service_opportunities (title, due_date)
            `)
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)

        if (statusFilter.length > 0) {
            query = query.in('status', statusFilter)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, jobs: data || [] }
    }

    /**
     * Get full job detail via RPC
     * @param {string} jobId
     * @returns {Promise<{success: boolean, job?: Object, error?: string}>}
     */
    const getJobDetail = async (jobId) => {
        const { data, error } = await supabase.rpc('get_job_detail', { p_job_id: jobId })

        if (error) {
            return { success: false, error: error.message }
        }
        if (data?.error) {
            return { success: false, error: data.error }
        }
        return { success: true, job: data }
    }

    /**
     * Update job status via RPC
     * @param {string} jobId
     * @param {string} newStatus - Pending, In Progress, Complete, Cancelled
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updateJobStatus = async (jobId, newStatus) => {
        const { data, error } = await supabase.rpc('update_job_status', {
            p_job_id: jobId,
            p_new_status: newStatus
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Toggle task completion via RPC
     * @param {string} taskId
     * @returns {Promise<{success: boolean, is_completed?: boolean, error?: string}>}
     */
    const toggleTask = async (taskId) => {
        const { data, error } = await supabase.rpc('toggle_job_task', { p_task_id: taskId })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Add comment to job via RPC
     * @param {string} jobId
     * @param {string} authorId
     * @param {string} content
     * @returns {Promise<{success: boolean, comment_id?: string, error?: string}>}
     */
    const addComment = async (jobId, authorId, content) => {
        const { data, error } = await supabase.rpc('add_job_comment', {
            p_job_id: jobId,
            p_author_id: authorId,
            p_content: content
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * List job comments via RPC
     * @param {string} jobId
     * @returns {Promise<{success: boolean, comments?: Array, error?: string}>}
     */
    const listComments = async (jobId) => {
        const { data, error } = await supabase.rpc('list_job_comments', { p_job_id: jobId })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, comments: data || [] }
    }

    /**
     * Add photo to job via RPC
     * @param {string} jobId
     * @param {string} photoUrl
     * @param {string} [caption]
     * @returns {Promise<{success: boolean, photo_id?: string, error?: string}>}
     */
    const addPhoto = async (jobId, photoUrl, caption = null) => {
        const { data, error } = await supabase.rpc('add_job_photo', {
            p_job_id: jobId,
            p_photo_url: photoUrl,
            p_caption: caption
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * List job photos via RPC
     * @param {string} jobId
     * @returns {Promise<{success: boolean, photos?: Array, error?: string}>}
     */
    const listPhotos = async (jobId) => {
        const { data, error } = await supabase.rpc('list_job_photos', { p_job_id: jobId })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, photos: data || [] }
    }

    /**
     * Delete job photo via RPC
     * @param {string} photoId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deletePhoto = async (photoId) => {
        const { data, error } = await supabase.rpc('delete_job_photo', { p_photo_id: photoId })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Assign worker to job via RPC
     * @param {string} jobId
     * @param {string} personId
     * @returns {Promise<{success: boolean, assignment_id?: string, error?: string}>}
     */
    const assignWorker = async (jobId, personId) => {
        const { data, error } = await supabase.rpc('assign_worker_to_job', {
            p_job_id: jobId,
            p_person_id: personId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Unassign worker from job via RPC
     * @param {string} jobId
     * @param {string} personId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const unassignWorker = async (jobId, personId) => {
        const { data, error } = await supabase.rpc('unassign_worker_from_job', {
            p_job_id: jobId,
            p_person_id: personId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Get color classes for job status display (UI helper)
     * @param {string} status
     * @returns {string} Tailwind classes
     */
    const getStatusColor = (status) => {
        if (status === 'Complete') return 'bg-green-100 text-green-700'
        if (status === 'In Progress') return 'bg-blue-100 text-blue-700'
        if (status === 'Cancelled') return 'bg-red-100 text-red-700'
        return 'bg-gray-100 text-gray-600'
    }

    return {
        // List
        fetchJobs,
        // Detail
        getJobDetail,
        updateJobStatus,
        toggleTask,
        // Comments
        addComment,
        listComments,
        // Photos
        addPhoto,
        listPhotos,
        deletePhoto,
        // Assignments
        assignWorker,
        unassignWorker,
        // UI Helpers
        getStatusColor
    }
}
