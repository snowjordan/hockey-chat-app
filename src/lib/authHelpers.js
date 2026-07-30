import { supabase } from './supabaseClient'

export async function loadAuthenticatedProfile(userId) {
    if (!userId) {
        return {
            profile: null,
            error: null,
        }
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()

    if (error) {
        console.error(
            "Unable to load authenticated profile:",
             error
        )

        return {
            profile: null,
            error,
        }
    }

    return {
        profile: data,
        error: null,
    }
} 