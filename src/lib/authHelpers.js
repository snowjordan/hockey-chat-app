import { supabase } from './supabaseClient'

export async function loadAuthenticatedProfile(userId) {
    if (!userId) {
        return {
            profile: null,
            error: null,
        }
    }

    console.log("Looking for profile with auth_user_id:", userId)

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()

    console.log("Profile query returned:", {
        data,
        error,
    })

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