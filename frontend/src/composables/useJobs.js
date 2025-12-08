/**
 * useJobs composable
 * Centralizes job management and data fetching
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useJobs() {
    const { effectiveTenantId } = useAuth()

    /**
     * Fetch jobs with filtering and related data
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
     * Get color classes for job status display
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
        fetchJobs,
        getStatusColor
    }
}
