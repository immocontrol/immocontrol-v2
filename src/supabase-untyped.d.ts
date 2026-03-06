/**
 * IMP-5: Type augmentation for Supabase client.
 *
 * The generated Database types from Supabase codegen can be empty, so we need to
 * relax the SupabaseClient generic parameters. The `any` here is intentional
 * and unavoidable — replacing them with `unknown` would break every
 * `.from("table")` call because the PostgrestQueryBuilder would lose its
 * fluent chain types (.select, .eq, .single, etc.).
 *
 * Once Supabase types are generated (e.g. supabase gen types), this file can be removed
 * and all tables will automatically get proper types.
 *
 * The return types of from() / rpc() / storage are typed at the call-site
 * via our service layer (src/lib/supabaseService.ts) which wraps all
 * database operations behind typed helpers.
 */

import "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface SupabaseClient<Database = any, SchemaName extends string & keyof Database = any, Schema = any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from(relation: string): any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc(fn: string, args?: Record<string, unknown>, options?: Record<string, unknown>): any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage: any;
  }
}

export {};
