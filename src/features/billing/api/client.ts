import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

// Apply the generated database contract at this boundary while reusing the
// existing authenticated client, fetch implementation, and session lifecycle.
export const billingDb = (supabase as SupabaseClient<Database>).schema("public");
