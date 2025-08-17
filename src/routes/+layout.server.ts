import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
  const { session, claims } = await safeGetSession()
  return {
    session,
    claims,
    cookies: cookies.getAll(),
  }
}