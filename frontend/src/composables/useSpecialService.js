/**
 * useSpecialService composable
 * Special service job creation
 */
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export function useSpecialService() {
    const categories = ref([])
    const loadingCategories = ref(false)

    /**
     * Load available categories
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const loadCategories = async () => {
        loadingCategories.value = true

        const { data, error } = await supabase.rpc('get_special_service_categories')

        if (error) {
            loadingCategories.value = false
            return { success: false, error: error.message }
        }

        // Group by category
        const grouped = {}
        for (const row of data || []) {
            if (!grouped[row.category]) {
                grouped[row.category] = []
            }
            grouped[row.category].push({
                subcategory: row.subcategory,
                requires_photos: row.requires_photos
            })
        }

        categories.value = Object.entries(grouped).map(([category, subcategories]) => ({
            category,
            subcategories
        }))

        loadingCategories.value = false
        return { success: true }
    }

    /**
     * Create special service job
     * @param {Object} params
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    const createSpecialServiceJob = async ({
        serviceOpportunityId,
        category,
        subcategory,
        description,
        billable,
        billingType = null,
        billingAmount = null,
        estimatedDurationMinutes = null,
        requestor = null,
        assignedPersonIds = null
    }) => {
        const { data, error } = await supabase.rpc('create_special_service_job', {
            p_service_opportunity_id: serviceOpportunityId,
            p_category: category,
            p_subcategory: subcategory,
            p_description: description,
            p_billable: billable,
            p_billing_type: billingType,
            p_billing_amount: billingAmount,
            p_estimated_duration_minutes: estimatedDurationMinutes,
            p_requestor: requestor,
            p_assigned_person_ids: assignedPersonIds
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, data }
    }

    /**
     * Billing type options
     */
    const billingTypes = [
        { value: 'fixed', label: 'Fixed Price' },
        { value: 'hourly', label: 'Hourly Rate' },
        { value: 'materials', label: 'Materials Only' },
        { value: 'hourly_plus_materials', label: 'Hourly + Materials' }
    ]

    return {
        categories,
        loadingCategories,
        loadCategories,
        createSpecialServiceJob,
        billingTypes
    }
}
