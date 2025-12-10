/**
 * useProperties composable
 * Centralizes property management operations
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useProperties() {
    const { userProfile, effectiveTenantId } = useAuth()

    /**
     * Get property detail via RPC (with codes, feeds, inventory, photos, people)
     * @param {string} propertyId
     * @returns {Promise<{success: boolean, property?: Object, error?: string}>}
     */
    const getPropertyDetail = async (propertyId) => {
        const { data, error } = await supabase.rpc('get_property_detail', { p_property_id: propertyId })

        if (error) {
            return { success: false, error: error.message }
        }
        if (data?.error) {
            return { success: false, error: data.error }
        }
        return { success: true, property: data }
    }


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
            p_street_address: details.street_address || '',
            p_city: details.city || '',
            p_state: details.state || '',
            p_zip: details.zip || '',
            p_check_in_time: details.check_in_time || null,
            p_check_out_time: details.check_out_time || null,
            p_time_zone: details.time_zone || 'US/Mountain',
            p_is_dst: !!details.is_dst,
            p_hcp_customer_id: details.hcp_customer_id || null,
            p_hcp_address_id: details.hcp_address_id || null,
            p_wifi_network: details.wifi_network || '',
            p_wifi_password: details.wifi_password || '',
            p_door_code: details.door_code || '',
            p_garage_code: details.garage_code || '',
            p_gate_code: details.gate_code || '',
            p_closet_code: details.closet_code || '',
            p_casita_code: details.casita_code || '',
            p_bedrooms: Number(details.bedrooms) || 0,
            p_bathrooms: Number(details.bathrooms) || 0,
            p_max_guests: Number(details.max_guests) || 0,
            p_square_footage: Number(details.square_footage) || 0,
            p_bathroom_sinks: Number(details.bathroom_sinks) || 0,
            p_bath_mats: Number(details.bath_mats) || 0,
            p_has_pool: !!details.has_pool,
            p_has_bbq: !!details.has_bbq,
            p_allows_pets: !!details.allows_pets,
            p_has_casita: !!details.has_casita,
            p_parking_instructions: details.parking_instructions || '',
            p_front_photo_url: details.front_photo_url || null,
            p_owner_ids: details.owner_ids || [],
            p_manager_ids: details.manager_ids || [],
            p_feeds: feeds.map(f => ({ id: f.id, name: f.name, url: f.url })),
            p_inventory: inventory,
            p_attachments: [],
            p_tenant_id: tenantId
        }

        console.log('[useProperties] Payload to RPC:', payload)

        try {
            let error
            if (id) {
                // Update existing
                console.log('[useProperties] Calling update_property_safe with:', { ...payload, p_id: id })
                const res = await supabase.rpc('update_property_safe', { ...payload, p_id: id })
                error = res.error
            } else {
                // Create new
                console.log('[useProperties] Calling create_property_safe with:', payload)
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
    /**
     * Fetch all properties for current tenant via RPC
     * @returns {Promise<{success: boolean, properties?: Array, error?: string}>}
     */
    const listProperties = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase.rpc('list_properties', {
            p_tenant_id: tenantId,
            p_include_archived: false
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, properties: data || [] }
    }

    /**
     * Fetch enriched properties from the properties_enriched view
     * @param {Object} options
     * @param {boolean} [options.showArchived] - Whether to show archived properties
     * @returns {Promise<{success: boolean, properties?: Array, error?: string}>}
     */
    const fetchPropertiesEnriched = async ({ showArchived = false } = {}) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        let query = supabase.from('properties_enriched').select('*')
            .eq('tenant_id', tenantId)

        if (showArchived) {
            query = query.eq('status', 'archived')
        } else {
            query = query.eq('status', 'active')
        }

        const { data, error } = await query.order('name')

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, properties: data || [] }
    }

    return {
        getPropertyDetail,
        saveProperty,
        deleteProperty,
        listProperties,
        fetchPropertiesEnriched
    }
}
