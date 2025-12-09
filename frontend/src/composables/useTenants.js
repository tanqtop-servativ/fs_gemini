/**
 * useTenants composable
 * Centralizes tenant/admin management - ALL business logic via database RPCs
 */
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export function useTenants() {

    /**
     * Get tenant users via RPC
     * @param {string} tenantId
     * @returns {Promise<{success: boolean, users?: Array, error?: string}>}
     */
    const getTenantUsers = async (tenantId) => {
        const { data, error } = await supabase.rpc('get_tenant_users', { p_tenant_id: tenantId })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, users: data || [] }
    }

    /**
     * Update tenant name via RPC
     * @param {string} tenantId
     * @param {string} name
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updateTenant = async (tenantId, name) => {
        const { error } = await supabase.rpc('update_tenant', {
            p_tenant_id: tenantId,
            p_name: name
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Delete (archive) tenant via RPC
     * @param {string} tenantId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deleteTenant = async (tenantId) => {
        const { error } = await supabase.rpc('delete_tenant', { p_tenant_id: tenantId })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Manage tenant user (create, update, delete) via RPC
     * @param {Object} options
     * @param {'CREATE'|'UPDATE'|'DELETE'} options.operation
     * @param {string} options.tenantId
     * @param {string} [options.userId] - Required for UPDATE/DELETE
     * @param {string} [options.email]
     * @param {string} [options.password]
     * @param {string} [options.firstName]
     * @param {string} [options.lastName]
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const manageTenantUser = async ({ operation, tenantId, userId = null, email = null, password = null, firstName = null, lastName = null }) => {
        const { error } = await supabase.rpc('manage_tenant_user', {
            p_operation: operation,
            p_tenant_id: tenantId,
            p_user_id: userId,
            p_email: email,
            p_password: password,
            p_first: firstName,
            p_last: lastName
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Create a new auth user via API server
     * @param {Object} options
     * @param {string} options.email
     * @param {string} options.password
     * @param {boolean} [options.invite=false]
     * @returns {Promise<{success: boolean, userId?: string, error?: string}>}
     */
    const createAuthUser = async ({ email, password, invite = false }) => {
        try {
            const res = await fetch(`${API_URL}/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, invite })
            })

            if (!res.ok) {
                const errText = await res.text()
                return { success: false, error: 'Failed to create user: ' + errText }
            }

            const data = await res.json()
            return { success: true, userId: data.user?.id }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Create tenant with admin user via RPC
     * @param {Object} options
     * @param {string} options.tenantName
     * @param {string} options.userId
     * @param {string} options.firstName
     * @param {string} options.lastName
     * @param {string} options.email
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const createTenantForUser = async ({ tenantName, userId, firstName, lastName, email }) => {
        const { error } = await supabase.rpc('create_tenant_for_user', {
            p_tenant_name: tenantName,
            p_user_id: userId,
            p_first_name: firstName,
            p_last_name: lastName,
            p_email: email
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Full tenant creation flow: create auth user + tenant + link
     * @param {Object} options
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const createTenantWithAdmin = async ({ tenantName, firstName, lastName, email, password }) => {
        // 1. Create auth user
        const userResult = await createAuthUser({ email, password, invite: false })
        if (!userResult.success) {
            return userResult
        }

        // 2. Create tenant and link user
        return createTenantForUser({
            tenantName,
            userId: userResult.userId,
            firstName,
            lastName,
            email
        })
    }

    return {
        getTenantUsers,
        updateTenant,
        deleteTenant,
        manageTenantUser,
        createAuthUser,
        createTenantForUser,
        createTenantWithAdmin
    }
}
