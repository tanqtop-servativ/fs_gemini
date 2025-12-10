/**
 * useServiceOpportunities composable
 * Centralizes service opportunity management
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useServiceOpportunities() {
    const { effectiveTenantId } = useAuth()

    /**
     * Save (create or update) a service opportunity
     * @param {Object} options
     * @param {string} [options.id] - Opportunity ID (for updates)
     * @param {string} options.property_id
     * @param {string} [options.service_template_id]
     * @param {string} [options.trigger_source]
     * @param {string} [options.due_date]
     * @param {string} [options.title] - For new opportunities
     * @returns {Promise<{success: boolean, opportunityId?: string, error?: string}>}
     */
    const saveOpportunity = async ({
        id = null,
        property_id,
        service_template_id = null,
        trigger_source = 'Manual',
        due_date = null,
        title = 'New Service Opportunity'
    }) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        if (!property_id) {
            return { success: false, error: 'Property is required' }
        }

        try {
            const payload = {
                property_id,
                service_template_id,
                trigger_source,
                due_date
            }

            if (id) {
                // Update existing
                const { error } = await supabase
                    .from('service_opportunities')
                    .update(payload)
                    .eq('id', id)
                if (error) throw error
                return { success: true, opportunityId: id }
            } else {
                // Create new
                const { data, error } = await supabase
                    .from('service_opportunities')
                    .insert({
                        ...payload,
                        tenant_id: tenantId,
                        status: 'Open',
                        title
                    })
                    .select()
                    .single()
                if (error) throw error
                return { success: true, opportunityId: data?.id }
            }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Delete (soft delete) a service opportunity
     * @param {string} opportunityId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deleteOpportunity = async (opportunityId) => {
        const { error } = await supabase
            .from('service_opportunities')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', opportunityId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Fetch options for creating opportunities (properties and templates)
     * @returns {Promise<{success: boolean, properties?: Array, templates?: Array, error?: string}>}
     */
    const fetchFormOptions = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const [propsResult, templatesResult] = await Promise.all([
            supabase.from('properties')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .eq('status', 'active')
                .is('deleted_at', null)
                .order('name'),
            supabase.from('service_templates')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .order('name')
        ])

        if (propsResult.error) {
            return { success: false, error: propsResult.error.message }
        }
        if (templatesResult.error) {
            return { success: false, error: templatesResult.error.message }
        }

        return {
            success: true,
            properties: propsResult.data || [],
            templates: templatesResult.data || []
        }
    }

    /**
     * Snooze a service opportunity
     * @param {string} id 
     * @param {string} snoozeUntilDate ISO string
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const snoozeOpportunity = async (id, snoozeUntilDate) => {
        const { error } = await supabase
            .from('service_opportunities')
            .update({
                status: 'Snoozed',
                snooze_until: snoozeUntilDate,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    /**
     * Unsnooze a service opportunity (Set to Open)
     * @param {string} id 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const unsnoozeOpportunity = async (id) => {
        const { error } = await supabase
            .from('service_opportunities')
            .update({
                status: 'Open',
                snooze_until: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    /**
     * Dismiss a service opportunity
     * @param {string} id 
     * @param {string} reason
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const dismissOpportunity = async (id, reason) => {
        const { error } = await supabase
            .from('service_opportunities')
            .update({
                status: 'Dismissed',
                dismissal_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    /**
     * Undismiss a service opportunity (Set to Open)
     * @param {string} id 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const undismissOpportunity = async (id) => {
        const { error } = await supabase
            .from('service_opportunities')
            .update({
                status: 'Open',
                dismissal_reason: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    /**
     * Expire any snoozes that are past their snooze_until date
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const expireSnoozes = async () => {
        const { error } = await supabase.rpc('update_expired_snoozes')
        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    /**
     * Fetch service opportunities with filtering and related jobs
     * @param {Object} options
     * @param {Array<string>} [options.statusFilter] - Status values to include
     * @param {number} [options.limit] - Max records to fetch (default: 100)
     * @param {number} [options.offset] - Offset for pagination
     * @returns {Promise<{success: boolean, opportunities?: Array, jobsMap?: Object, error?: string}>}
     */
    const fetchOpportunities = async ({ statusFilter = [], limit = 100, offset = 0 } = {}) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        // Auto-expire snoozes first
        await expireSnoozes()

        // Base query
        let query = supabase
            .from('service_opportunities')
            .select(`
                *,
                properties (name),
                service_templates (name)
            `)
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)

        // Status filtering
        if (statusFilter.length > 0) {
            query = query.in('status', statusFilter)
        }

        // Apply pagination
        if (limit) {
            query = query.range(offset, offset + limit - 1)
        }

        const { data: opps, error } = await query.order('created_at', { ascending: false })

        if (error) {
            return { success: false, error: error.message }
        }

        const opportunities = opps || []

        // Fetch active jobs for workflow visualization
        let jobsMap = {}
        if (opportunities.length > 0) {
            const ids = opportunities.map(o => o.id).filter(id => !!id)
            if (ids.length > 0) {
                const { data: jobs } = await supabase
                    .from('jobs')
                    .select('id, service_opportunity_id, title, status')
                    .in('service_opportunity_id', ids)

                if (jobs) {
                    jobs.forEach(j => {
                        if (!jobsMap[j.service_opportunity_id]) jobsMap[j.service_opportunity_id] = []
                        jobsMap[j.service_opportunity_id].push(j)
                    })
                }
            }
        }

        return { success: true, opportunities, jobsMap }
    }

    /**
     * Fetch count of snoozed opportunities
     * @returns {Promise<{success: boolean, count?: number, error?: string}>}
     */
    const fetchSnoozedCount = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { count, error } = await supabase
            .from('service_opportunities')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'Snoozed')
            .is('deleted_at', null)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, count: count || 0 }
    }

    /**
     * Get color classes for workflow status display
     * @param {string} status
     * @returns {string} Tailwind classes
     */
    const getWorkflowColor = (status) => {
        if (status === 'Complete' || status === 'Captured') return 'bg-green-100 text-green-700'
        if (status === 'In Progress') return 'bg-blue-100 text-blue-700'
        if (status === 'Snoozed') return 'bg-amber-100 text-amber-800'
        if (status === 'Dismissed') return 'bg-red-50 text-red-600'
        return 'bg-gray-100 text-gray-600'
    }

    return {
        saveOpportunity,
        deleteOpportunity,
        fetchFormOptions,
        snoozeOpportunity,
        unsnoozeOpportunity,
        dismissOpportunity,
        undismissOpportunity,
        expireSnoozes,
        fetchOpportunities,
        fetchSnoozedCount,
        getWorkflowColor
    }
}
