/**
 * useVisits composable
 * Centralizes visit operations
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useVisits() {
    const { effectiveTenantId } = useAuth()

    /**
     * Create a new visit for a job
     * @param {string} jobId
     * @param {string} [scheduledStart] - ISO timestamp
     * @param {string} [scheduledEnd] - ISO timestamp
     * @returns {Promise<{success: boolean, visitId?: string, error?: string}>}
     */
    const createVisit = async (jobId, scheduledStart = null, scheduledEnd = null) => {
        const { data, error } = await supabase.rpc('create_visit', {
            p_job_id: jobId,
            p_scheduled_start: scheduledStart,
            p_scheduled_end: scheduledEnd
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, visitId: data }
    }

    /**
     * Update visit schedule
     * @param {string} visitId
     * @param {string} scheduledStart - ISO timestamp
     * @param {string} [scheduledEnd] - ISO timestamp
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updateVisit = async (visitId, scheduledStart, scheduledEnd = null) => {
        const { data, error } = await supabase.rpc('update_visit_schedule', {
            p_visit_id: visitId,
            p_scheduled_start: scheduledStart,
            p_scheduled_end: scheduledEnd
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Get visit details including worker statuses
     * @param {string} visitId
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    const getVisitDetails = async (visitId) => {
        const { data, error } = await supabase.rpc('get_visit_details', {
            p_visit_id: visitId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, data }
    }

    /**
     * Fetch visits for a job
     * @param {string} jobId
     * @returns {Promise<{success: boolean, visits?: Array, error?: string}>}
     */
    const fetchVisitsForJob = async (jobId) => {
        const { data, error } = await supabase
            .from('visits')
            .select('*')
            .eq('job_id', jobId)
            .order('visit_number', { ascending: true })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, visits: data || [] }
    }

    /**
     * Get artifacts for a visit
     * @param {string} visitId
     * @returns {Promise<{success: boolean, artifacts?: Array, error?: string}>}
     */
    const getArtifactsForVisit = async (visitId) => {
        const { data, error } = await supabase.rpc('get_artifacts_for_visit', {
            p_visit_id: visitId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, artifacts: data || [] }
    }

    return {
        createVisit,
        updateVisit,
        getVisitDetails,
        fetchVisitsForJob,
        getArtifactsForVisit
    }
}
