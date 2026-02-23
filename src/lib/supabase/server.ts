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
// @ts-expect-error - Supabase cookie typing mismatch in Next runtimel();
          return [];
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set(name, value, options);
            });
          } catch {
            // Ignore - middleware will set cookies when needed
          }
        },
      },
    }
  );
}
