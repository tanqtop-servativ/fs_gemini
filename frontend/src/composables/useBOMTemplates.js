/**
 * useBOMTemplates composable
 * Centralizes BOM (Bill of Materials) template management
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useBOMTemplates() {
    const { effectiveTenantId } = useAuth()

    /**
     * Save (create or update) a BOM template with items
     * Uses existing RPCs for atomic operations
     * @param {Object} options
     * @param {string} [options.id] - Template ID (for updates)
     * @param {string} options.name
     * @param {string} [options.description]
     * @param {Array} options.items - Array of BOM items
     * @returns {Promise<{success: boolean, templateId?: string, error?: string}>}
     */
    const saveTemplate = async ({ id = null, name, description = '', items = [] }) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        if (!name) {
            return { success: false, error: 'Template name required' }
        }

        try {
            const payload = {
                p_name: name,
                p_description: description,
                p_items: items.map((item, idx) => ({
                    item_name: item.item_name,
                    quantity: item.quantity || 1,
                    price: item.price || 0,
                    category: item.category || 'Linens',
                    notes: item.notes || '',
                    sort_order: idx
                }))
            }

            if (id) {
                // Update existing
                const { error } = await supabase.rpc('update_bom_template', { ...payload, p_id: id })
                if (error) throw error
                return { success: true, templateId: id }
            } else {
                // Create new
                const { data, error } = await supabase.rpc('create_bom_template', { ...payload, p_tenant_id: tenantId })
                if (error) throw error
                return { success: true, templateId: data }
            }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Delete (soft delete) a BOM template
     * @param {string} templateId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deleteTemplate = async (templateId) => {
        const { error } = await supabase
            .from('bom_templates')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', templateId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Fetch a template with its items
     * @param {string} templateId
     * @returns {Promise<{success: boolean, template?: Object, error?: string}>}
     */
    const getTemplate = async (templateId) => {
        const { data, error } = await supabase
            .from('bom_templates')
            .select('*, bom_template_items(*)')
            .eq('id', templateId)
            .is('deleted_at', null)
            .single()

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, template: data }
    }

    /**
     * Fetch all BOM templates for current tenant
     * @returns {Promise<{success: boolean, templates?: Array, error?: string}>}
     */
    const listTemplates = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase
            .from('bom_templates')
            .select('*, bom_template_items(*)')
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)
            .order('name')

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, templates: data }
    }

    return {
        saveTemplate,
        deleteTemplate,
        getTemplate,
        listTemplates
    }
}
