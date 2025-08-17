// filepath: src/routes/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ depends, locals: { session } }) => {
  depends('supabase:auth')
  if (!session) {
    throw redirect(303, '/auth')
  }
}