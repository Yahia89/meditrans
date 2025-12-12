import { createClient } from '@supabase/supabase-js'

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist auth session in localStorage
    persistSession: true,
    // Auto refresh session before it expires
    autoRefreshToken: true,
    // Detect session from URL (for magic links, OAuth, etc.)
    detectSessionInUrl: true,
    // Storage key for the session
    storageKey: 'future-transport-auth',
  },
})

// Database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MembershipRole = 'owner' | 'admin' | 'employee' | 'driver' | 'patient'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string | null
          billing_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          billing_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          billing_email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      organization_memberships: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: MembershipRole
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role: MembershipRole
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: MembershipRole
          is_primary?: boolean
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          user_id: string
          full_name: string | null
          phone: string | null
          default_org_id: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          full_name?: string | null
          phone?: string | null
          default_org_id?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string | null
          phone?: string | null
          default_org_id?: string | null
          created_at?: string
        }
      }
    }
  }
}
