import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export async function getAuthUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getAuthSession(): Promise<{
  user: User | null;
  accessToken: string | null;
}> {
  const supabase = createClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  return { user, accessToken: session?.access_token ?? null };
}

export async function updateDisplayName(name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): { unsubscribe: () => void } {
  const supabase = createClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event: string, session: { user: User } | null) => { callback(session?.user ?? null); }
  );
  return { unsubscribe: () => subscription.unsubscribe() };
}
