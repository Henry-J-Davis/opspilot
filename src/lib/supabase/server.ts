import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const store = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Some Next versions expose getAll; others don't in server components.
          // Middleware handles session refresh reliably.

          return [];
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await store;
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignore - middleware will set cookies when needed
          }
        },
      },
    }
  );
}
