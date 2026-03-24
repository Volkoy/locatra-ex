import type { LayoutServerLoad } from './$types'
import { loadFlash } from 'sveltekit-flash-message/server';

export const load: LayoutServerLoad =loadFlash(async ({ locals: { getSession }, cookies }) => {
  const session = await getSession()
  return {
    session,
    isAuthenticated: !!session && !session.user.is_anonymous,
    cookies: cookies.getAll(),
  }
});