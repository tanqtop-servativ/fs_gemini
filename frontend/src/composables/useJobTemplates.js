/**
 * useJobTemplates composable
 * Centralizes job template management with tasks and checklists
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useJobTemplates() {
    const { effectiveTenantId } = useAuth()

    /**
     * Save a job template with its tasks (uses existing RPCs)
     * @param {Object} options
     * @param {string} [options.id] - Template ID (for updates)
     * @param {string} options.name
     * @param {string} options.name_es
     * @param {string} [options.description]
     * @param {string} [options.description_es]
     * @param {Array} options.tasks - Array of tasks with checklists
     * @returns {Promise<{success: boolean, templateId?: string, error?: string}>}
     */
    const saveTemplate = async ({
        id = null,
        name,
        name_es,
        description = '',
        description_es = '',
        tasks = []
    }) => {
        // Validate required fields
        if (!name || !name_es) {
            return { success: false, error: 'Template names (EN/ES) required' }
        }

        if (tasks.some(t => !t.title || !t.title_es)) {
            return { success: false, error: 'All tasks must have titles (EN/ES)' }
        }

        try {
            const payload = {
                p_name: name,
                p_description: description,
                p_name_es: name_es,
                p_description_es: description_es,
                p_tasks: tasks.map((t, idx) => ({
                    ...t,
                    sort_order: idx,
                    checklist: (t.checklist || []).map((c, cIdx) => ({
                        ...c,
                        sort_order: cIdx
                    }))
                }))
            }

            let error
            if (id) {
                const { error: err } = await supabase.rpc('update_job_template', { ...payload, p_id: id })
                error = err
            } else {
                const { error: err } = await supabase.rpc('create_job_template', payload)
                error = err
            }

            if (error) throw error

            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Archive (soft delete) a job template
     * @param {string} templateId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const archiveTemplate = async (templateId) => {
        const { error } = await supabase
            .from('job_templates')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', templateId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Restore a previously archived job template
     * @param {string} templateId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const restoreTemplate = async (templateId) => {
        const { error } = await supabase
            .from('job_templates')
            .update({ deleted_at: null })
            .eq('id', templateId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Reorder templates
     * @param {Array<string>} ids - Ordered list of IDs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const reorderTemplates = async (ids) => {
        const { error } = await supabase.rpc('reorder_job_templates', { p_ids: ids })
        if (error) return { success: false, error: error.message }
        return { success: true }
    }

    /**
     * Fetch all job templates for the current tenant
     * @param {boolean} [includeArchived=false]
     * @returns {Promise<{success: boolean, templates?: Array, error?: string}>}
     */
    const listTemplates = async (includeArchived = false) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        let query = supabase
            .from('job_templates')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true })

        if (!includeArchived) {
            query = query.is('deleted_at', null)
        }

        const { data, error } = await query

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, templates: data }
    }

    return {
        saveTemplate,
        archiveTemplate,
        restoreTemplate,
        listTemplates,
        reorderTemplates
    }
}
