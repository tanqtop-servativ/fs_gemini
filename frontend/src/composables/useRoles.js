/**
 * useRoles composable
 * Centralizes role management via database RPCs
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
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('list_roles', {
            p_tenant_id: tenantId,
            p_include_archived: includeArchived
        })

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
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('create_role', {
            p_tenant_id: tenantId,
            p_name: name,
            p_description: description,
            p_sort_order: sort_order
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, role_id: data }
    }

    /**
     * Update an existing role
     * @param {Object} role
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updateRole = async ({ id, name, description }) => {
        const { error } = await supabase.rpc('update_role', {
            p_id: id,
            p_name: name,
            p_description: description
        })

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
        const { error } = await supabase.rpc('archive_role', {
            p_id: roleId,
            p_archive: archive
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Reorder roles (bulk update sort_order)
     * @param {Array<string>} ids - Ordered list of role IDs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const reorderRoles = async (ids) => {
        const { error } = await supabase.rpc('reorder_roles', {
            p_ids: ids
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    return {
        listRoles,
        createRole,
        updateRole,
        toggleRoleArchive,
        reorderRoles
    }
}

