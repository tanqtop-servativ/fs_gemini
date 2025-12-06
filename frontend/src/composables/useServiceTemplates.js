/**
 * useServiceTemplates composable
 * Centralizes service template management with workflow steps
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useServiceTemplates() {
    const { effectiveTenantId } = useAuth()

    /**
     * Save a service template with its workflow steps
     * This is an atomic operation - template and steps saved together
     * @param {Object} options
     * @param {string} [options.id] - Template ID (for updates)
     * @param {string} options.name
     * @param {string} [options.description]
     * @param {Array} options.steps - Array of workflow steps
     * @returns {Promise<{success: boolean, templateId?: string, error?: string}>}
     */
    const saveTemplate = async ({ id = null, name, description = '', steps = [] }) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        try {
            let templateId = id

            // 1. Upsert Template
            const payload = {
                name,
                description,
                tenant_id: tenantId
            }

            if (templateId) {
                const { error } = await supabase
                    .from('service_templates')
                    .update(payload)
                    .eq('id', templateId)
                if (error) throw error
            } else {
                const { data, error } = await supabase
                    .from('service_templates')
                    .insert(payload)
                    .select()
                    .single()
                if (error) throw error
                templateId = data.id
            }

            // 2. Sync Steps: Delete all and re-insert
            const { error: deleteError } = await supabase
                .from('service_workflow_steps')
                .delete()
                .eq('service_template_id', templateId)
            if (deleteError) throw deleteError

            // 3. Insert new steps
            if (steps.length > 0) {
                const stepRows = steps.map((s, idx) => ({
                    tenant_id: tenantId,
                    service_template_id: templateId,
                    job_template_id: s.job_template_id,
                    sort_order: idx,
                    is_optional: s.is_optional || false,
                    is_billing: s.is_billing || false,
                    delay_hours: s.delay_hours || 0
                }))

                const { error: stepError } = await supabase
                    .from('service_workflow_steps')
                    .insert(stepRows)
                if (stepError) throw stepError
            }

            return { success: true, templateId }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Delete (soft delete) a service template
     * @param {string} templateId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deleteTemplate = async (templateId) => {
        const { error } = await supabase
            .from('service_templates')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', templateId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Fetch a template with its workflow steps
     * @param {string} templateId
     * @returns {Promise<{success: boolean, template?: Object, error?: string}>}
     */
    const getTemplate = async (templateId) => {
        const { data, error } = await supabase
            .from('service_templates')
            .select('*, service_workflow_steps(*, job_templates(name))')
            .eq('id', templateId)
            .is('deleted_at', null)
            .single()

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, template: data }
    }

    /**
     * Fetch all templates for the current tenant
     * @returns {Promise<{success: boolean, templates?: Array, error?: string}>}
     */
    const listTemplates = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase
            .from('service_templates')
            .select('*, service_workflow_steps(*, job_templates(name))')
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
