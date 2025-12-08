import { ref, computed } from 'vue'

/**
 * Composable for sortable, searchable table functionality
 * @param {Ref} items - Reactive array of items to sort/filter
 * @param {Object} options - Configuration options
 * @param {string} options.defaultSortKey - Initial sort column
 * @param {string} options.defaultSortDir - Initial sort direction ('asc' or 'desc')
 * @param {string[]} options.searchableFields - Fields to search in
 */
export function useTableControls(items, options = {}) {
    const {
        defaultSortKey = null,
        defaultSortDir = 'asc',
        searchableFields = []
    } = options

    // Sort state
    const sortKey = ref(defaultSortKey)
    const sortDir = ref(defaultSortDir)

    // Search state
    const searchQuery = ref('')

    // Toggle sort on a column
    const toggleSort = (key) => {
        if (sortKey.value === key) {
            // Toggle direction
            sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
        } else {
            sortKey.value = key
            sortDir.value = 'asc'
        }
    }

    // Reset to defaults
    const resetControls = () => {
        sortKey.value = defaultSortKey
        sortDir.value = defaultSortDir
        searchQuery.value = ''
    }

    // Get nested value from object (e.g., 'property.name')
    const getNestedValue = (obj, path) => {
        if (!path) return obj
        return path.split('.').reduce((acc, part) => acc?.[part], obj)
    }

    // Filtered and sorted items
    const processedItems = computed(() => {
        let result = [...(items.value || [])]

        // Filter by search
        if (searchQuery.value.trim()) {
            const query = searchQuery.value.toLowerCase().trim()
            result = result.filter(item => {
                // Search in specified fields
                if (searchableFields.length > 0) {
                    return searchableFields.some(field => {
                        const val = getNestedValue(item, field)
                        return val && String(val).toLowerCase().includes(query)
                    })
                }
                // Fall back to searching all string values
                return Object.values(item).some(val =>
                    val && String(val).toLowerCase().includes(query)
                )
            })
        }

        // Sort
        if (sortKey.value) {
            result.sort((a, b) => {
                const aVal = getNestedValue(a, sortKey.value)
                const bVal = getNestedValue(b, sortKey.value)

                // Handle nulls
                if (aVal == null && bVal == null) return 0
                if (aVal == null) return 1
                if (bVal == null) return -1

                // Compare
                let cmp = 0
                if (typeof aVal === 'string') {
                    cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' })
                } else if (aVal instanceof Date || typeof aVal === 'number') {
                    cmp = aVal - bVal
                } else {
                    cmp = String(aVal).localeCompare(String(bVal))
                }

                return sortDir.value === 'asc' ? cmp : -cmp
            })
        }

        return result
    })

    // Check if any controls are active
    const hasActiveControls = computed(() => {
        return sortKey.value !== defaultSortKey ||
            sortDir.value !== defaultSortDir ||
            searchQuery.value.trim() !== ''
    })

    return {
        sortKey,
        sortDir,
        searchQuery,
        processedItems,
        toggleSort,
        resetControls,
        hasActiveControls
    }
}
