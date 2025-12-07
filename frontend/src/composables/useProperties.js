/**
 * useProperties composable
 * Centralizes property management operations
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useProperties() {
    const { userProfile, effectiveTenantId } = useAuth()

    /**
     * Save (create or update) a property using existing RPCs
     * @param {Object} options - Property data matching RPC parameters
     * @param {string} [options.id] - Property ID (for updates)
     * @param {Object} options.details - Basic property details
     * @param {Array} [options.feeds] - iCal feeds
     * @param {Array} [options.inventory] - Property inventory items
     * @returns {Promise<{success: boolean, propertyId?: string, error?: string}>}
     */
    const saveProperty = async ({ id = null, details, feeds = [], inventory = [] }) => {
        const tenantId = userProfile.value?.tenant_id || effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Unable to determine tenant. Please log out and log back in.' }
        }

        const payload = {
            p_name: details.name,
            p_address: details.address,
            p_checkin: details.checkin,
            p_checkout: details.checkout,
            p_time_zone: details.timezone,
            p_is_dst: details.is_dst,
            p_hcp_cust: details.hcp_cust,
            p_hcp_addr: details.hcp_addr,
            p_wifi_network: details.wifi_network,
            p_wifi_password: details.wifi_password,
            p_door_code: details.door_code,
            p_garage_code: details.garage_code,
            p_gate_code: details.gate_code,
            p_closet_code: details.closet_code,
            p_bedrooms: details.bedrooms,
            p_bathrooms: details.bathrooms,
            p_max_guests: details.max_guests,
            p_square_footage: details.sq_ft,
            p_bathroom_sinks: details.sinks,
            p_bath_mats: details.baths_mats,
            p_has_pool: details.has_pool,
            p_has_bbq: details.has_bbq,
            p_allows_pets: details.allows_pets,
            p_has_casita: details.has_casita,
            p_casita_code: details.casita_code,
            p_parking_instructions: details.parking,
            p_photo_url: details.front_photo_url,
            p_owner_ids: details.owner_ids,
            p_manager_ids: details.manager_ids,
            p_feeds: feeds.map(f => ({ id: f.id, name: f.name, url: f.url })),
            p_inventory: inventory,
            p_tenant_id: tenantId
        }

        try {
            let error
            if (id) {
                // Update existing
                const res = await supabase.rpc('update_property_safe', { ...payload, p_id: id })
                error = res.error
            } else {
                // Create new
                const res = await supabase.rpc('create_property_safe', payload)
                error = res.error
            }

            if (error) throw error
            return { success: true, propertyId: id }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    /**
     * Delete (soft delete) a property
     * @param {string} propertyId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deleteProperty = async (propertyId) => {
        const { error } = await supabase
            .from('properties')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', propertyId)

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    }

    /**
     * Fetch all properties for current tenant
     * @returns {Promise<{success: boolean, properties?: Array, error?: string}>}
     */
    const listProperties = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('name')

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, properties: data }
    }

    return {
        saveProperty,
        deleteProperty,
        listProperties
    }
}
