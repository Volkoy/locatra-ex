import type { LayoutServerLoad } from './$types'
import { loadFlash } from 'sveltekit-flash-message/server';

export const load: LayoutServerLoad =loadFlash(async ({ locals: { safeGetSession }, cookies }) => {
  const { session, claims } = await safeGetSession()
  return {
    session,
    claims,
    cookies: cookies.getAll(),
  }
});