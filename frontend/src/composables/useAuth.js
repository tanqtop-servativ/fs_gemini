import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)
const userProfile = ref(null)
const loading = ref(true)
const impersonatedTenantId = ref(null)
const impersonatedTenantName = ref(null)

// Check localStorage for existing impersonation on module load
const storedImpersonation = localStorage.getItem('impersonated_tenant_id')
if (storedImpersonation) {
    impersonatedTenantId.value = storedImpersonation
}

export function useAuth() {
    // Computed: are we impersonating?
    const isImpersonating = computed(() => {
        return !!impersonatedTenantId.value && userProfile.value?.is_superuser
    })

    // Computed: effective tenant ID (impersonated or real)
    const effectiveTenantId = computed(() => {
        if (isImpersonating.value) {
            return impersonatedTenantId.value
        }
        return userProfile.value?.tenant_id
    })

    // Computed: effective tenant name
    const effectiveTenantName = computed(() => {
        if (isImpersonating.value && impersonatedTenantName.value) {
            return impersonatedTenantName.value
        }
        return userProfile.value?.tenants?.name || 'No Tenant'
    })

    const initAuth = async () => {
        loading.value = true
        const { data } = await supabase.auth.getSession()
        user.value = data.session?.user ?? null

        if (user.value) {
            await fetchProfile(user.value.id)
        }

        loading.value = false

        supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                user.value = session.user
                await fetchProfile(session.user.id)
            } else {
                user.value = null
                userProfile.value = null
            }
        })
    }

    const fetchProfile = async (userId) => {
        const { data } = await supabase
            .from('profiles')
            .select('*, tenants:tenant_id(name)')
            .eq('id', userId)
            .single()
        userProfile.value = data

        // If superuser and impersonating, fetch the impersonated tenant name
        if (data?.is_superuser && impersonatedTenantId.value) {
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('name')
                .eq('id', impersonatedTenantId.value)
                .single()
            impersonatedTenantName.value = tenantData?.name || 'Unknown Tenant'
        }
    }

    const signIn = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        user.value = null
        userProfile.value = null
        // Clear impersonation on sign out
        stopImpersonating()
    }

    // Impersonation functions
    const impersonateTenant = async (tenantId) => {
        if (!userProfile.value?.is_superuser) return

        localStorage.setItem('impersonated_tenant_id', tenantId)
        impersonatedTenantId.value = tenantId

        // Fetch tenant name
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .single()
        impersonatedTenantName.value = tenantData?.name || 'Unknown Tenant'

        // Reload the page to refresh all data with new tenant context
        location.reload()
    }

    const stopImpersonating = () => {
        localStorage.removeItem('impersonated_tenant_id')
        impersonatedTenantId.value = null
        impersonatedTenantName.value = null

        // Reload if we were impersonating
        if (userProfile.value?.is_superuser) {
            location.reload()
        }
    }

    return {
        user,
        userProfile,
        loading,
        initAuth,
        signIn,
        signOut,
        // Impersonation
        isImpersonating,
        impersonatedTenantId,
        effectiveTenantId,
        effectiveTenantName,
        impersonateTenant,
        stopImpersonating
    }
}
