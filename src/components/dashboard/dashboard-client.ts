import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

// Reuse the session/client while opting these projections into generated types.
export const dashboardClient: SupabaseClient<Database> = supabase;
