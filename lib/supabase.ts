import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;
let _client: BrowserClient | null = null;

export function createClient(): BrowserClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Persist in localStorage so a refresh/restart restores the session.
          persistSession: true,
          // Refresh the access token in the background before it expires —
          // a brief network blip should never log the user out.
          autoRefreshToken: true,
          // Pick up tokens from URL after OAuth/magic-link callbacks.
          detectSessionInUrl: true,
        },
      }
    );
  }
  return _client;
}

export type TabSession = {
  id: string;
  user_id: string;
  domain: string;
  page_title: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  visits: number;
  date: string;
  created_at: string;
  /** Daily planner task id (optional — add column in Supabase if missing) */
  planner_task_id?: string | null;
};
