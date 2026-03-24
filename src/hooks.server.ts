import { createServerClient } from "@supabase/ssr";
import { type Handle, redirect } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from "$lib/paraglide/server";
import {
  PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
  PUBLIC_SUPABASE_URL,
} from "$env/static/public";
import type { Session } from "@supabase/supabase-js";
import { getValidatedSession } from "$lib/utils.js";

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace("%paraglide.lang%", locale),
    });
  });

const supabase: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: "/" });
          });
        },
      },
    },
  );

  /**
   * We use getSession, as a function, rather than a static object
   * like `session`, in order to make reactivity work for some
   * features of our pages. For example, if this wasn't a function,
   * things like the `update_nickname` form action in /self
   * wouldn't correctly update data on its page.
   */
  event.locals.getSession = async (): Promise<Session | null> => {
    return await getValidatedSession(event.locals.supabase);
  };

  const session = await event.locals.getSession();

  /**
   * Only authenticated users can access these paths and their sub-paths.
   *
   * If you'd rather do this in your routes, see (authenticated)/app/+page.server.ts
   * for an example.
   *
   * If you don't use a layout group for auth-protected paths, then you can use
   * new Set(['app', 'self']) or whatever your top-level path segments are, and
   * .has(event.url.pathname.split('/')[1])
   */
  const auth_protected_paths = new Set(["(dashboard)"]);
  const isRealUser = !!session && !session.user.is_anonymous;
  if (
    !isRealUser && auth_protected_paths.has(event.route.id?.split("/")[1] || "")
  ) {
    redirect(307, "/auth");
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });
};

export const handle: Handle = sequence(handleParaglide, supabase);
