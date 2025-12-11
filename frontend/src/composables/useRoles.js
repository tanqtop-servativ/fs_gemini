/**
 * useRoles composable
 * Centralizes role management
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRoles() {
    const { effectiveTenantId } = useAuth()

    /**
     * List all roles
     * @param {boolean} includeArchived
     * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
     */
    const listRoles = async (includeArchived = false) => {
        let query = supabase.from('roles').select('*').order('sort_order')
        if (!includeArchived) {
            query = query.is('deleted_at', null)
        }

        const { data, error } = await query

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, roles: data || [] }
    }

    /**
     * Create a new role
     * @param {Object} role
     * @returns {Promise<{success: boolean, role_id?: string, error?: string}>}
     */
    const createRole = async ({ name, description = '', sort_order = 0 }) => {
        const tenantId = effectiveTenantId.value

        const { data, error } = await supabase
            .from('roles')
            .insert({ name, description, tenant_id: tenantId, sort_order })
            .select('id')
            .single()

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, role_id: data.id }
    }

    /**
     * Update an existing role
     * @param {Object} role
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updateRole = async ({ id, name, description }) => {
        const { error } = await supabase
            .from('roles')
            .update({ name, description })
            .eq('id', id)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Archive/restore a role
     * @param {string} roleId
     * @param {boolean} archive - true to archive, false to restore
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const toggleRoleArchive = async (roleId, archive = true) => {
        const { error } = await supabase
            .from('roles')
            .update({ deleted_at: archive ? new Date().toISOString() : null })
            .eq('id', roleId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Update sort order for roles
     * @param {Array<{id: string, sort_order: number}>} updates
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updateRoleOrder = async (updates) => {
        for (const update of updates) {
            const { error } = await supabase
                .from('roles')
                .update({ sort_order: update.sort_order })
                .eq('id', update.id)

            if (error) {
                return { success: false, error: error.message }
            }
        }
        return { success: true }
    }

    return {
        listRoles,
        createRole,
        updateRole,
        toggleRoleArchive,
        updateRoleOrder
    }
}
