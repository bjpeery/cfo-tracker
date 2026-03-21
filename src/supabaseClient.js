import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing Supabase credentials.\n" +
    "Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n" +
    "See SETUP.md for instructions."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
