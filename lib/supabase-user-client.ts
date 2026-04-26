import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Client scoped to a user's JWT so PostgREST / RLS see auth.uid() in API routes.
 */
export function createSupabaseForUserJwt(authToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${authToken}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
