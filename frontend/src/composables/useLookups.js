/**
 * useLookups composable
 * Provides lightweight lookup data for dropdowns across the app
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useLookups() {
    const { effectiveTenantId } = useAuth()

    /**
     * Get people for dropdown (id, name, roles)
     * @returns {Promise<{success: boolean, people?: Array, error?: string}>}
     */
    const lookupPeople = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('lookup_people', {
            p_tenant_id: tenantId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, people: data || [] }
    }

    /**
     * Get BOM templates for dropdown (id, name)
     * @returns {Promise<{success: boolean, templates?: Array, error?: string}>}
     */
    const lookupBOMTemplates = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('lookup_bom_templates', {
            p_tenant_id: tenantId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, templates: data || [] }
    }

    /**
     * Get items from a BOM template
     * @param {string} templateId
     * @returns {Promise<{success: boolean, items?: Array, error?: string}>}
     */
    const getBOMTemplateItems = async (templateId) => {
        const { data, error } = await supabase.rpc('get_bom_template_items', {
            p_template_id: templateId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, items: data || [] }
    }

    return {
        lookupPeople,
        lookupBOMTemplates,
        getBOMTemplateItems
    }
}
