/**
 * usePeople composable
 * Centralizes person/user management logic
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export function usePeople() {
    const { effectiveTenantId } = useAuth()

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
     * Create a new person (and optionally link to auth user)
     * @param {Object} person
     * @param {string} person.first_name
     * @param {string} person.last_name
     * @param {string} person.email
     * @param {string} [person.phone]
     * @param {string} [person.userId] - Optional auth user ID to link
     * @returns {Promise<{success: boolean, personId?: string, error?: string}>}
     */
    const createPerson = async ({ first_name, last_name, email, phone = null, userId = null }) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('create_full_person', {
            p_first_name: first_name,
            p_last_name: last_name,
            p_email: email,
            p_phone: phone,
            p_tenant_id: tenantId,
            p_user_id: userId
        })

        if (error) {
            return { success: false, error: error.message }
        }

        if (data && !data.success) {
            return { success: false, error: data.error }
        }

        return { success: true, personId: data.person_id }
    }

    /**
     * Update an existing person
     * @param {Object} person
     * @param {string} person.id - Person ID
     * @param {string} person.first_name
     * @param {string} person.last_name
     * @param {string} person.email
     * @param {string[]} [person.role_ids] - Array of role UUIDs
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const updatePerson = async ({ id, first_name, last_name, email, role_ids = [] }) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { error } = await supabase.rpc('save_person_safe', {
            p_id: id,
            p_tenant_id: tenantId,
            p_first: first_name,
            p_last: last_name,
            p_email: email,
            p_role_ids: role_ids
        })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    }

    /**
     * Assign roles to a person
     * @param {Object} options
     * @param {string} options.personId
     * @param {string[]} options.roleIds
     * @param {Object} options.personData - Required person data for save_person_safe
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const assignRoles = async ({ personId, roleIds, personData }) => {
        return updatePerson({
            id: personId,
            first_name: personData.first_name,
            last_name: personData.last_name,
            email: personData.email,
            role_ids: roleIds
        })
    }

    /**
     * Archive (soft delete) a person
     * @param {string} personId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const archivePerson = async (personId) => {
        const { error } = await supabase
            .from('people')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', personId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    return {
        createUserLogin,
        createPerson,
        updatePerson,
        assignRoles,
        archivePerson
    }
}
