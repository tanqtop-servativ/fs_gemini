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
                        status: 'Pending',
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

    return {
        saveOpportunity,
        deleteOpportunity,
        fetchFormOptions
    }
}
