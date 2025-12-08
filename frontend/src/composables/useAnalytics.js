/**
 * useAnalytics composable
 * Analytics and reporting functions
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useAnalytics() {
    const { effectiveTenantId } = useAuth()

    /**
     * Get worker integrity score
     * @param {string} personId
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    const getWorkerIntegrityScore = async (personId) => {
        const { data, error } = await supabase.rpc('calculate_worker_integrity_score', {
            p_person_id: personId
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data }
    }

    /**
     * Analyze failure patterns
     * @param {number} [days=90]
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    const analyzeFailurePatterns = async (days = 90) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) return { success: false, error: 'No tenant' }

        const { data, error } = await supabase.rpc('analyze_failure_patterns', {
            p_tenant_id: tenantId,
            p_days: days
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data || [] }
    }

    /**
     * Get retry analysis
     * @param {number} [days=90]
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    const getRetryAnalysis = async (days = 90) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) return { success: false, error: 'No tenant' }

        const { data, error } = await supabase.rpc('get_retry_analysis', {
            p_tenant_id: tenantId,
            p_days: days
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data }
    }

    /**
     * Get correction analysis
     * @param {number} [days=90]
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    const getCorrectionAnalysis = async (days = 90) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) return { success: false, error: 'No tenant' }

        const { data, error } = await supabase.rpc('get_correction_analysis', {
            p_tenant_id: tenantId,
            p_days: days
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data }
    }

    /**
     * Get worker leaderboard
     * @param {number} [days=90]
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    const getWorkerLeaderboard = async (days = 90) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) return { success: false, error: 'No tenant' }

        const { data, error } = await supabase.rpc('get_worker_leaderboard', {
            p_tenant_id: tenantId,
            p_days: days
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: data || [] }
    }

    /**
     * Get integrity score color
     * @param {number} score
     * @returns {string}
     */
    const getScoreColor = (score) => {
        if (score >= 90) return 'text-emerald-600'
        if (score >= 75) return 'text-green-600'
        if (score >= 60) return 'text-amber-600'
        if (score >= 40) return 'text-orange-600'
        return 'text-red-600'
    }

    /**
     * Get integrity score background
     * @param {number} score
     * @returns {string}
     */
    const getScoreBg = (score) => {
        if (score >= 90) return 'bg-emerald-100'
        if (score >= 75) return 'bg-green-100'
        if (score >= 60) return 'bg-amber-100'
        if (score >= 40) return 'bg-orange-100'
        return 'bg-red-100'
    }

    return {
        getWorkerIntegrityScore,
        analyzeFailurePatterns,
        getRetryAnalysis,
        getCorrectionAnalysis,
        getWorkerLeaderboard,
        getScoreColor,
        getScoreBg
    }
}
