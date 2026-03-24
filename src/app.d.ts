import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/database.types";
declare global {
    namespace App {
        interface Platform {
            env: Env;
            cf: CfProperties;
            ctx: ExecutionContext;
        }
        interface Locals {
            supabase: SupabaseClient<Database>;
            getSession(): Promise<Session | null>;
        }
        interface PageData {
            session: Session | null;
            flash?: { type: "success" | "error"; message: string };
        }
    }
}

export {};
