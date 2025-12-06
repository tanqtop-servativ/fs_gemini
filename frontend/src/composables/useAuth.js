import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)
const userProfile = ref(null)
const loading = ref(true)

export function useAuth() {
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
            .select('*')
            .eq('id', userId)
            .single()
        userProfile.value = data
    }

    const signIn = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        user.value = null
        userProfile.value = null
    }

    return {
        user,
        userProfile,
        loading,
        initAuth,
        signIn,
        signOut
    }
}
