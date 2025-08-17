import type { Session, SupabaseClient, Claims } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
declare global {
	namespace App {
        interface Platform {
            env: Env
            cf: CfProperties
            ctx: ExecutionContext
        }
        interface Locals {
            supabase: SupabaseClient<Database>
            safeGetSession: () => Promise<{ session: Session | null; claims: Claims | null }>
            session: Session | null
            claims: Claims | null
        }
        interface PageData {
            session: Session | null
        }
    }
}

export {};