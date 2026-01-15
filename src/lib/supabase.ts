import { createClient } from "@supabase/supabase-js";

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env.local file."
  );
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
    storageKey: "future-transport-auth",
    // Official v2.90.0+ fix for Web Locks deadlock in Safari/Production
    // @ts-expect-error - lockAcquisitionTimeout is available in v2.90.0+ runtime but types lag
    lockAcquisitionTimeout: 3000,
  },
});

// Database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MembershipRole =
  | "owner"
  | "admin"
  | "dispatch"
  | "employee"
  | "driver";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          billing_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          billing_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          billing_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      org_invites: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: MembershipRole;
          invited_by: string | null;
          token: string;
          accepted_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role: MembershipRole;
          invited_by?: string | null;
          token?: string;
          accepted_at?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: MembershipRole;
          invited_by?: string | null;
          token?: string;
          accepted_at?: string | null;
          expires_at?: string;
          created_at?: string;
        };
      };
      org_uploads: {
        Row: {
          id: string;
          org_id: string;
          uploaded_by: string | null;
          file_path: string;
          file_type: string | null;
          original_filename: string | null;
          file_size: number | null;
          mime_type: string | null;
          source: "patients" | "drivers" | "employees" | "unknown";
          status:
            | "pending"
            | "processing"
            | "ready_for_review"
            | "committed"
            | "error";
          error_message: string | null;
          purpose: string | null;
          notes: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          uploaded_by?: string | null;
          file_path: string;
          file_type?: string | null;
          original_filename?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          source?: "patients" | "drivers" | "employees" | "unknown";
          status?:
            | "pending"
            | "processing"
            | "ready_for_review"
            | "committed"
            | "error";
          error_message?: string | null;
          purpose?: string | null;
          notes?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          uploaded_by?: string | null;
          file_path?: string;
          file_type?: string | null;
          original_filename?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          source?: "patients" | "drivers" | "employees" | "unknown";
          status?:
            | "pending"
            | "processing"
            | "ready_for_review"
            | "committed"
            | "error";
          error_message?: string | null;
          purpose?: string | null;
          notes?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      drivers: {
        Row: {
          id: string;
          org_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          license_number: string | null;
          vehicle_info: string | null;
          status: string;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          license_number?: string | null;
          vehicle_info?: string | null;
          status?: string;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          license_number?: string | null;
          vehicle_info?: string | null;
          status?: string;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          org_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: string | null;
          department: string | null;
          hire_date: string | null;
          status: string;
          notes: string | null;
          custom_fields: Json;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          role?: string | null;
          department?: string | null;
          hire_date?: string | null;
          status?: string;
          notes?: string | null;
          custom_fields?: Json;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          role?: string | null;
          department?: string | null;
          hire_date?: string | null;
          status?: string;
          notes?: string | null;
          custom_fields?: Json;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          org_id: string;
          full_name: string;
          date_of_birth: string | null;
          phone: string | null;
          email: string | null;
          primary_address: string | null;
          notes: string | null;
          monthly_credit: number | null;
          credit_used_for: string | null;
          referral_date: string | null;
          referral_expiration_date: string | null;
          status: string;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          full_name: string;
          date_of_birth?: string | null;
          phone?: string | null;
          email?: string | null;
          primary_address?: string | null;
          notes?: string | null;
          monthly_credit?: number | null;
          credit_used_for?: string | null;
          referral_date?: string | null;
          referral_expiration_date?: string | null;
          status?: string;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          full_name?: string;
          date_of_birth?: string | null;
          phone?: string | null;
          email?: string | null;
          primary_address?: string | null;
          notes?: string | null;
          monthly_credit?: number | null;
          credit_used_for?: string | null;
          referral_date?: string | null;
          referral_expiration_date?: string | null;
          status?: string;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      staging_records: {
        Row: {
          id: string;
          upload_id: string;
          org_id: string;
          record_type: "driver" | "patient" | "employee";
          row_index: number | null;
          status: "pending" | "valid" | "error" | "committed";
          validation_errors: Json | null;
          raw_data: Json | null;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          org_id: string;
          record_type: "driver" | "patient" | "employee";
          row_index?: number | null;
          status?: "pending" | "valid" | "error" | "committed";
          validation_errors?: Json | null;
          raw_data?: Json | null;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          upload_id?: string;
          org_id?: string;
          record_type?: "driver" | "patient" | "employee";
          row_index?: number | null;
          status?: "pending" | "valid" | "error" | "committed";
          validation_errors?: Json | null;
          raw_data?: Json | null;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      staging_employees: {
        Row: {
          id: string;
          upload_id: string;
          org_id: string;
          row_index: number | null;
          status: "pending" | "valid" | "error" | "committed";
          validation_errors: Json | null;
          raw_data: Json | null;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          role: string | null;
          department: string | null;
          hire_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          org_id: string;
          row_index?: number | null;
          status?: "pending" | "valid" | "error" | "committed";
          validation_errors?: Json | null;
          raw_data?: Json | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: string | null;
          department?: string | null;
          hire_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          upload_id?: string;
          org_id?: string;
          row_index?: number | null;
          status?: "pending" | "valid" | "error" | "committed";
          validation_errors?: Json | null;
          raw_data?: Json | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: string | null;
          department?: string | null;
          hire_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      organization_memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: MembershipRole;
          is_primary: boolean;
          presence_status: "online" | "away" | "offline";
          last_active_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role: MembershipRole;
          is_primary?: boolean;
          presence_status?: "online" | "away" | "offline";
          last_active_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          role?: MembershipRole;
          is_primary?: boolean;
          presence_status?: "online" | "away" | "offline";
          last_active_at?: string | null;
          created_at?: string;
        };
      };
      user_profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          phone: string | null;
          default_org_id: string | null;
          is_super_admin: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          phone?: string | null;
          default_org_id?: string | null;
          is_super_admin?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string | null;
          phone?: string | null;
          default_org_id?: string | null;
          is_super_admin?: boolean;
          created_at?: string;
        };
      };
    };
  };
}
