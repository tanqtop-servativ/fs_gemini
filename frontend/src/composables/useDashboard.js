/**
 * useDashboard composable
 * Centralizes dashboard/horizon board data fetching
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDashboard() {
    const { effectiveTenantId } = useAuth()

    /**
     * Fetch horizon data for dashboard board view
     * @returns {Promise<{success: boolean, horizon?: Object, counts?: Object, error?: string}>}
     */
    const fetchHorizon = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data: jobs, error } = await supabase.rpc('get_dashboard_horizon', {
            p_tenant_id: tenantId
        })

        if (error) {
            return { success: false, error: error.message }
        }

        // Organize into buckets
        const buckets = {
            overdue: [],
            today: [],
            tomorrow: [],
            this_week: [],
            next_week: [],
            future: []
        }
        const counts = {
            overdue: 0,
            today: 0,
            tomorrow: 0,
            this_week: 0,
            next_week: 0,
            future: 0
        }

        if (jobs) {
            jobs.forEach(j => {
                if (buckets[j.bucket]) {
                    buckets[j.bucket].push(j)
                    counts[j.bucket]++
                }
            })
        }

        return { success: true, horizon: buckets, counts }
    }

    /**
     * Get color classes for job type display
     * @param {string} type
     * @returns {string} Tailwind classes
     */
    const getTypeColor = (type) => {
        if (type === 'Cleaning') return 'bg-blue-100 text-blue-700'
        if (type === 'Inspection') return 'bg-purple-100 text-purple-700'
        if (type === 'Kitting') return 'bg-yellow-100 text-yellow-700'
        return 'bg-gray-100 text-gray-600'
    }

    /**
     * Format ISO date to time string
     * @param {string} iso
     * @returns {string}
     */
    const formatTime = (iso) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return {
        fetchHorizon,
        getTypeColor,
        formatTime
    }
}
