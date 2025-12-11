/**
 * usePeople composable
 * Centralizes person/user management - ALL business logic via database RPCs
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export function usePeople() {
    const { effectiveTenantId } = useAuth()

    /**
     * List all people for tenant via RPC
     * @returns {Promise<{success: boolean, people?: Array, error?: string}>}
     */
    const listPeople = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('list_people', { p_tenant_id: tenantId })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, people: data || [] }
    }

    /**
     * Get person detail via RPC
     * @param {string} personId
     * @returns {Promise<{success: boolean, person?: Object, error?: string}>}
     */
    const getPersonDetail = async (personId) => {
        const { data, error } = await supabase.rpc('get_person_detail', { p_person_id: personId })

        if (error) {
            return { success: false, error: error.message }
        }
        if (data?.error) {
            return { success: false, error: data.error }
        }
        return { success: true, person: data }
    }

    /**
     * Create a Supabase Auth user (via API server)
     * @param {Object} options
     * @param {string} options.email - User email
     * @param {string} options.password - Password (for manual method)
     * @param {boolean} options.invite - If true, sends invite email instead of setting password
     * @returns {Promise<{success: boolean, userId?: string, error?: string}>}
     */
    const createUserLogin = async ({ email, password = '', invite = true }) => {
        try {
            const res = await fetch(`${API_URL}/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, invite })
            })
            const result = await res.json()

            if (!result.success) {
                return { success: false, error: result.error || 'Failed to create user' }
            }

            const userId = result.user?.id || result.user?.user?.id
            return { success: true, userId }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Create a new person via RPC
     * @param {Object} person
     * @param {string} person.first_name
     * @param {string} person.last_name
     * @param {string} [person.email]
     * @param {string} [person.phone]
     * @param {string} [person.color] - Hex color for visual identification
     * @param {string[]} [person.role_ids] - Array of role UUIDs
     * @returns {Promise<{success: boolean, person_id?: string, error?: string}>}
     */
    const createPerson = async ({ first_name, last_name, email = null, phone = null, color = '#3B82F6', role_ids = [] }) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('create_person', {
            p_tenant_id: tenantId,
            p_first_name: first_name,
            p_last_name: last_name,
            p_email: email,
            p_phone: phone,
            p_color: color,
            p_role_ids: role_ids
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Update an existing person via RPC
     * @param {Object} person
     * @param {string} person.id - Person ID
     * @param {string} person.first_name
     * @param {string} person.last_name
     * @param {string} [person.email]
     * @param {string} [person.phone]
     * @param {string} [person.color] - Hex color for visual identification
     * @param {string[]} [person.role_ids] - Array of role UUIDs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updatePerson = async ({ id, first_name, last_name, email = null, phone = null, color = '#3B82F6', role_ids = [] }) => {
        const { data, error } = await supabase.rpc('update_person', {
            p_person_id: id,
            p_first_name: first_name,
            p_last_name: last_name,
            p_email: email,
            p_phone: phone,
            p_color: color,
            p_role_ids: role_ids
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * Delete a person via RPC
     * @param {string} personId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deletePerson = async (personId) => {
        const { data, error } = await supabase.rpc('delete_person', { p_person_id: personId })

        if (error) {
            return { success: false, error: error.message }
        }
        return data
    }

    /**
     * List all roles via RPC
     * @returns {Promise<{success: boolean, roles?: Array, error?: string}>}
     */
    const listRoles = async () => {
        const { data, error } = await supabase.rpc('list_roles')

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, roles: data || [] }
    }

    return {
        listPeople,
        getPersonDetail,
        createUserLogin,
        createPerson,
        updatePerson,
        deletePerson,
        listRoles
    }
}
