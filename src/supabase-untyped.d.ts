// Temporary type relaxation for Supabase client while generated Database types are empty.
// This prevents TS errors like: Argument of type '"table"' is not assignable to parameter of type 'never'.
// Once Lovable Cloud types are populated, this file can be removed.

import "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SupabaseClient<Database = any, SchemaName extends string & keyof Database = any, Schema = any> {
    from(relation: string): any;
    rpc(fn: string, args?: any, options?: any): any;
    storage: any;
  }
}

export {};
