/**
 * useCalendar composable
 * Centralizes calendar data fetching
 */
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useCalendar() {
    const { effectiveTenantId } = useAuth()

    /**
     * Fetch properties for selector dropdown
     * @returns {Promise<{success: boolean, properties?: Array, error?: string}>}
     */
    const fetchProperties = async () => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        const { data, error } = await supabase
            .from('properties')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('name')

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, properties: data || [] }
    }

    /**
     * Fetch calendar events (from master_calendar view)
     * @param {Object} options
     * @param {string} [options.propertyId] - Filter by property, or 'all' for all properties
     * @returns {Promise<{success: boolean, events?: Array, error?: string}>}
     */
    const fetchEvents = async ({ propertyId = 'all' } = {}) => {
        const tenantId = effectiveTenantId.value
        if (!tenantId) {
            return { success: false, error: 'Tenant ID not found' }
        }

        let query = supabase.from('master_calendar').select('*')
            .eq('tenant_id', tenantId)

        if (propertyId !== 'all') {
            // Specific property: show ALL events (including iCal bookings)
            query = query.eq('property_id', propertyId)
        } else {
            // All Properties: show only Jobs/Services, exclude iCal bookings to keep view manageable
            query = query.neq('event_type', 'Booking')
        }

        const { data, error } = await query

        if (error) {
            return { success: false, error: error.message }
        }

        // Transform to FullCalendar format
        const fcEvents = (data || []).map(evt => ({
            id: evt.id,
            title: evt.title,
            start: evt.start_date,
            end: evt.end_date,
            color: evt.color,
            classNames: [evt.class_name],
            allDay: evt.all_day,
            extendedProps: {
                description: evt.description,
                property_name: evt.property_name,
                property_address: evt.property_address,
                event_type: evt.event_type,
                code: evt.code,
                job_id: evt.job_id  // For navigation to job detail
            }
        }))

        return { success: true, events: fcEvents }
    }

    return {
        fetchProperties,
        fetchEvents
    }
}
