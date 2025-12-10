import { ref, computed, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)
const userProfile = ref(null)
const loading = ref(true)

// Tenant impersonation state (superuser only)
const impersonatedTenantId = ref(null)
const impersonatedTenantName = ref(null)

// User impersonation state (tenant admin only)
const impersonatedUserId = ref(null)
const impersonatedUserName = ref(null)

// Check localStorage for existing impersonation on module load
const storedTenantImpersonation = localStorage.getItem('impersonated_tenant_id')
if (storedTenantImpersonation) {
    impersonatedTenantId.value = storedTenantImpersonation
}

const storedUserImpersonation = localStorage.getItem('impersonated_user_id')
const storedUserName = localStorage.getItem('impersonated_user_name')
if (storedUserImpersonation) {
    impersonatedUserId.value = storedUserImpersonation
    impersonatedUserName.value = storedUserName
}

// Track auth subscription - MODULE SCOPE SINGLETON
let authSubscription = null
let isInitialized = false

// Cleanup function for HMR
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (authSubscription) {
            authSubscription.unsubscribe()
            authSubscription = null
            isInitialized = false
        }
    })
}

export function useAuth() {
    // === TENANT IMPERSONATION (Superuser) ===
    const isImpersonating = computed(() => {
        return !!impersonatedTenantId.value && userProfile.value?.is_superuser
    })

    const effectiveTenantId = computed(() => {
        if (isImpersonating.value) {
            return impersonatedTenantId.value
        }
        return userProfile.value?.tenant_id
    })

    const effectiveTenantName = computed(() => {
        if (isImpersonating.value && impersonatedTenantName.value) {
            return impersonatedTenantName.value
        }
        return userProfile.value?.tenants?.name || 'No Tenant'
    })

    // === USER IMPERSONATION (Tenant Admin) ===
    const isTenantAdmin = computed(() => userProfile.value?.is_tenant_admin)

    const isImpersonatingUser = computed(() => {
        return !!impersonatedUserId.value && isTenantAdmin.value
    })

    const effectiveUserId = computed(() => {
        if (isImpersonatingUser.value) {
            return impersonatedUserId.value
        }
        return user.value?.id
    })

    const initAuth = async () => {
        console.log('[AUTH] initAuth called, isInitialized:', isInitialized)
        // Prevent duplicate initialization
        if (isInitialized) {
            console.log('[AUTH] Already initialized, skipping')
            return
        }

        loading.value = true
        console.log('[AUTH] Getting session...')
        const { data } = await supabase.auth.getSession()
        user.value = data.session?.user ?? null
        console.log('[AUTH] Session user:', user.value?.id)

        if (user.value) {
            await fetchProfile(user.value.id)
        }

        loading.value = false

        // Only set up listener if not already subscribed
        if (!authSubscription) {
            console.log('[AUTH] Setting up auth state listener')
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                console.log('[AUTH] Auth state changed:', _event, session?.user?.id)

                // Defensive check: Ignore SIGNED_OUT if localStorage has valid session
                // This prevents Supabase's spurious SIGNED_OUT events from clearing valid auth
                if (!session || !session.user) {
                    // Check if we have a valid session in localStorage
                    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                    if (storageKey) {
                        try {
                            const data = JSON.parse(localStorage.getItem(storageKey))
                            if (data?.access_token && data?.expires_at) {
                                const expiresAtMs = data.expires_at * 1000
                                if (Date.now() < expiresAtMs) {
                                    console.log('[AUTH] Ignoring SIGNED_OUT - localStorage has valid session')
                                    return // Ignore this SIGNED_OUT event
                                }
                            }
                        } catch (e) {
                            // If parse fails, proceed with sign out
                        }
                    }

                    // Truly signed out - clear state
                    console.log('[AUTH] Clearing user state (genuine sign out)')
                    user.value = null
                    userProfile.value = null
                } else {
                    // Signed in - check if it's the same user before re-fetching
                    if (user.value?.id === session.user.id && userProfile.value?.id === session.user.id) {
                        console.log('[AUTH] Ignoring redundant SIGNED_IN for same user')
                        return // Skip redundant profile fetch
                    }

                    // Different user or first sign in - update state
                    user.value = session.user
                    await fetchProfile(session.user.id)
                }
            })
            authSubscription = subscription
        }

        isInitialized = true
        console.log('[AUTH] Initialization complete')
    }

    const fetchProfile = async (userId) => {
        console.log('[AUTH] fetchProfile called for userId:', userId)
        const { data, error } = await supabase
            .from('profiles')
            .select('*, tenants:tenant_id(name)')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('[AUTH] Error fetching profile:', error)
            return
        }

        console.log('[AUTH] Profile fetched successfully:', data)
        userProfile.value = data

        // If superuser and impersonating tenant, fetch the impersonated tenant name
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
        // Clear all impersonation on sign out
        stopImpersonating()
        stopImpersonatingUser()
    }

    // === TENANT IMPERSONATION FUNCTIONS ===
    const impersonateTenant = async (tenantId) => {
        if (!userProfile.value?.is_superuser) return

        localStorage.setItem('impersonated_tenant_id', tenantId)
        impersonatedTenantId.value = tenantId

        const { data: tenantData } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .single()
        impersonatedTenantName.value = tenantData?.name || 'Unknown Tenant'

        location.reload()
    }

    const stopImpersonating = () => {
        localStorage.removeItem('impersonated_tenant_id')
        impersonatedTenantId.value = null
        impersonatedTenantName.value = null

        if (userProfile.value?.is_superuser) {
            location.reload()
        }
    }

    // === USER IMPERSONATION FUNCTIONS ===
    const impersonateUser = async (userId, userName) => {
        if (!isTenantAdmin.value) return
        if (userId === user.value?.id) return // Can't impersonate yourself

        localStorage.setItem('impersonated_user_id', userId)
        localStorage.setItem('impersonated_user_name', userName)
        impersonatedUserId.value = userId
        impersonatedUserName.value = userName

        location.reload()
    }

    const stopImpersonatingUser = () => {
        const wasImpersonating = !!impersonatedUserId.value
        localStorage.removeItem('impersonated_user_id')
        localStorage.removeItem('impersonated_user_name')
        impersonatedUserId.value = null
        impersonatedUserName.value = null

        if (wasImpersonating) {
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
        // Tenant Impersonation (Superuser)
        isImpersonating,
        impersonatedTenantId,
        effectiveTenantId,
        effectiveTenantName,
        impersonateTenant,
        stopImpersonating,
        // User Impersonation (Tenant Admin)
        isTenantAdmin,
        isImpersonatingUser,
        impersonatedUserId,
        impersonatedUserName,
        effectiveUserId,
        impersonateUser,
        stopImpersonatingUser
    }
}
