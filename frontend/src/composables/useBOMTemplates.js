/**
 * useBOMTemplates composable
 * Centralizes BOM (Bill of Materials) template management
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useBOMTemplates() {
    const { effectiveTenantId } = useAuth()

    /**
     * Fetch all BOM templates for current tenant via RPC
     * @param {boolean} includeArchived
     * @returns {Promise<{success: boolean, templates?: Array, error?: string}>}
     */
    const listTemplates = async (includeArchived = false) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('list_bom_templates', {
            p_tenant_id: tenantId,
            p_include_archived: includeArchived
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, templates: data || [] }
    }

    /**
     * Fetch a template with its items via RPC
     * @param {string} templateId
     * @returns {Promise<{success: boolean, template?: Object, error?: string}>}
     */
    const getTemplate = async (templateId) => {
        const { data, error } = await supabase.rpc('get_bom_template_detail', {
            p_template_id: templateId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, template: data }
    }

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
     * Archive (soft delete) a BOM template via RPC
     * @param {string} templateId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const archiveTemplate = async (templateId) => {
        const { data, error } = await supabase.rpc('archive_bom_template', {
            p_template_id: templateId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Reorder templates
     * @param {Array<string>} ids - Ordered list of IDs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const reorderTemplates = async (ids) => {
        const { error } = await supabase.rpc('reorder_bom_templates', { p_ids: ids })
        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    return {
        listTemplates,
        getTemplate,
        saveTemplate,
        archiveTemplate,
        reorderTemplates
    }
}

