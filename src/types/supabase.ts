export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      billing_activity_logs: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          event_type: string
          id: string
          notes: string | null
          occurred_at: string
          org_id: string
          payload: Json | null
          record_id: string
          recorded_at: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          event_type: string
          id?: string
          notes?: string | null
          occurred_at: string
          org_id: string
          payload?: Json | null
          record_id: string
          recorded_at?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          org_id?: string
          payload?: Json | null
          record_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_activity_logs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          authorized_by: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          reason: string
          record_id: string
          record_line_id: string | null
        }
        Insert: {
          adjustment_type: string
          amount: number
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          reason: string
          record_id: string
          record_line_id?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          reason?: string
          record_id?: string
          record_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_adjustments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_adjustments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_adjustments_record_line_id_fkey"
            columns: ["record_line_id"]
            isOneToOne: false
            referencedRelation: "billing_record_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_claim_lines: {
        Row: {
          charge_amount: number
          claim_id: string
          created_at: string
          diagnosis_code: string
          driver_id: string | null
          dropoff_address: string
          hcpcs_code: string
          id: string
          modifier: string | null
          patient_id: string
          pickup_address: string
          rejection_reason: string | null
          service_date: string
          status: string
          trip_id: string
          units: number
        }
        Insert: {
          charge_amount: number
          claim_id: string
          created_at?: string
          diagnosis_code?: string
          driver_id?: string | null
          dropoff_address: string
          hcpcs_code: string
          id?: string
          modifier?: string | null
          patient_id: string
          pickup_address: string
          rejection_reason?: string | null
          service_date: string
          status?: string
          trip_id: string
          units: number
        }
        Update: {
          charge_amount?: number
          claim_id?: string
          created_at?: string
          diagnosis_code?: string
          driver_id?: string | null
          dropoff_address?: string
          hcpcs_code?: string
          id?: string
          modifier?: string | null
          patient_id?: string
          pickup_address?: string
          rejection_reason?: string | null
          service_date?: string
          status?: string
          trip_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_claim_lines_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "billing_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_claim_lines_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_claim_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_claim_lines_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_claims: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          claim_control_number: string
          created_at: string
          created_by: string | null
          generated_file_data: string | null
          generated_file_name: string | null
          id: string
          org_id: string
          response_data: Json | null
          response_status: string | null
          status: string
          submitted_at: string | null
          total_charge: number
          total_trips: number
          updated_at: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          claim_control_number: string
          created_at?: string
          created_by?: string | null
          generated_file_data?: string | null
          generated_file_name?: string | null
          id?: string
          org_id: string
          response_data?: Json | null
          response_status?: string | null
          status?: string
          submitted_at?: string | null
          total_charge?: number
          total_trips?: number
          updated_at?: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          claim_control_number?: string
          created_at?: string
          created_by?: string | null
          generated_file_data?: string | null
          generated_file_name?: string | null
          id?: string
          org_id?: string
          response_data?: Json | null
          response_status?: string | null
          status?: string
          submitted_at?: string | null
          total_charge?: number
          total_trips?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_claims_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_documents: {
        Row: {
          document_type: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          notes: string | null
          org_id: string
          payment_id: string | null
          record_id: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          document_type: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          notes?: string | null
          org_id: string
          payment_id?: string | null
          record_id?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          document_type?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          notes?: string | null
          org_id?: string
          payment_id?: string | null
          record_id?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payer_responses: {
        Row: {
          adjudication_status: string | null
          adjustment_group_code: string | null
          adjustment_reason_code: string | null
          category_code: string | null
          evidence_doc_name: string | null
          evidence_doc_reference: string | null
          id: string
          notes: string | null
          occurred_at: string
          org_id: string
          payer_claim_number: string | null
          payer_reported_amount: number | null
          raw_description: string | null
          record_id: string
          recorded_at: string
          recorded_by: string | null
          remark_code: string | null
          response_type: string
          status_code: string | null
          submission_attempt_id: string | null
        }
        Insert: {
          adjudication_status?: string | null
          adjustment_group_code?: string | null
          adjustment_reason_code?: string | null
          category_code?: string | null
          evidence_doc_name?: string | null
          evidence_doc_reference?: string | null
          id?: string
          notes?: string | null
          occurred_at: string
          org_id: string
          payer_claim_number?: string | null
          payer_reported_amount?: number | null
          raw_description?: string | null
          record_id: string
          recorded_at?: string
          recorded_by?: string | null
          remark_code?: string | null
          response_type: string
          status_code?: string | null
          submission_attempt_id?: string | null
        }
        Update: {
          adjudication_status?: string | null
          adjustment_group_code?: string | null
          adjustment_reason_code?: string | null
          category_code?: string | null
          evidence_doc_name?: string | null
          evidence_doc_reference?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          org_id?: string
          payer_claim_number?: string | null
          payer_reported_amount?: number | null
          raw_description?: string | null
          record_id?: string
          recorded_at?: string
          recorded_by?: string | null
          remark_code?: string | null
          response_type?: string
          status_code?: string | null
          submission_attempt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payer_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payer_responses_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payer_responses_submission_attempt_id_fkey"
            columns: ["submission_attempt_id"]
            isOneToOne: false
            referencedRelation: "billing_submission_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payers: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          payer_type: string
          payment_terms: string | null
          submission_channel: string
          typical_follow_up_days: number | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          payer_type: string
          payment_terms?: string | null
          submission_channel?: string
          typical_follow_up_days?: number | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          payer_type?: string
          payment_terms?: string | null
          submission_channel?: string
          typical_follow_up_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payment_allocations: {
        Row: {
          allocated_at: string
          allocated_by: string | null
          amount: number
          id: string
          notes: string | null
          org_id: string
          payment_id: string
          record_id: string
          record_line_id: string | null
        }
        Insert: {
          allocated_at?: string
          allocated_by?: string | null
          amount: number
          id?: string
          notes?: string | null
          org_id: string
          payment_id: string
          record_id: string
          record_line_id?: string | null
        }
        Update: {
          allocated_at?: string
          allocated_by?: string | null
          amount?: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_id?: string
          record_id?: string
          record_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_record_line_id_fkey"
            columns: ["record_line_id"]
            isOneToOne: false
            referencedRelation: "billing_record_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          org_id: string
          payer_id: string
          payer_reported_date: string | null
          payment_method: string
          received_date: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_status: string
          reference_number: string
          unapplied_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          org_id: string
          payer_id: string
          payer_reported_date?: string | null
          payment_method: string
          received_date?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_status?: string
          reference_number: string
          unapplied_amount: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          org_id?: string
          payer_id?: string
          payer_reported_date?: string | null
          payment_method?: string
          received_date?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_status?: string
          reference_number?: string
          unapplied_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "billing_payers"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_record_lines: {
        Row: {
          adjusted_amount: number
          allowed_amount: number | null
          billed_amount: number
          client_id: string
          created_at: string
          denial_reason: string | null
          description: string
          hcpcs_code: string | null
          id: string
          line_status: string
          modifiers: string[] | null
          notes: string | null
          org_id: string
          paid_amount: number
          quantity: number
          record_id: string
          service_agreement_id: string | null
          service_agreement_line_id: string | null
          service_date: string
          trip_component: string | null
          trip_id: string | null
          unit_rate: number | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          adjusted_amount?: number
          allowed_amount?: number | null
          billed_amount: number
          client_id: string
          created_at?: string
          denial_reason?: string | null
          description: string
          hcpcs_code?: string | null
          id?: string
          line_status?: string
          modifiers?: string[] | null
          notes?: string | null
          org_id: string
          paid_amount?: number
          quantity?: number
          record_id: string
          service_agreement_id?: string | null
          service_agreement_line_id?: string | null
          service_date: string
          trip_component?: string | null
          trip_id?: string | null
          unit_rate?: number | null
          unit_type?: string
          updated_at?: string
        }
        Update: {
          adjusted_amount?: number
          allowed_amount?: number | null
          billed_amount?: number
          client_id?: string
          created_at?: string
          denial_reason?: string | null
          description?: string
          hcpcs_code?: string | null
          id?: string
          line_status?: string
          modifiers?: string[] | null
          notes?: string | null
          org_id?: string
          paid_amount?: number
          quantity?: number
          record_id?: string
          service_agreement_id?: string | null
          service_agreement_line_id?: string | null
          service_date?: string
          trip_component?: string | null
          trip_id?: string | null
          unit_rate?: number | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_record_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_record_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_record_lines_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_record_lines_service_agreement_id_fkey"
            columns: ["service_agreement_id"]
            isOneToOne: false
            referencedRelation: "billing_service_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_record_lines_service_agreement_line_id_fkey"
            columns: ["service_agreement_line_id"]
            isOneToOne: false
            referencedRelation: "billing_service_agreement_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_record_lines_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_records: {
        Row: {
          adjudication_status: string
          billing_period_end: string
          billing_period_start: string
          client_id: string | null
          created_at: string
          created_by: string | null
          current_submission_attempt: number
          due_date: string | null
          external_submitted_at: string | null
          follow_up_notes: string | null
          follow_up_owner_id: string | null
          id: string
          internal_reference: string
          is_historical: boolean
          is_summary_only: boolean
          next_follow_up_date: string | null
          notes: string | null
          org_id: string
          original_external_reference: string | null
          outstanding_balance: number
          payer_acknowledged_at: string | null
          payer_id: string
          provenance: string
          record_type: string
          replaces_record_id: string | null
          settlement_status: string
          submission_channel: string | null
          submission_status: string
          submitted_by_name: string | null
          superseded_by_record_id: string | null
          total_adjusted_amount: number
          total_allowed_amount: number | null
          total_billed_amount: number
          total_paid_amount: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          adjudication_status?: string
          billing_period_end: string
          billing_period_start: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_submission_attempt?: number
          due_date?: string | null
          external_submitted_at?: string | null
          follow_up_notes?: string | null
          follow_up_owner_id?: string | null
          id?: string
          internal_reference: string
          is_historical?: boolean
          is_summary_only?: boolean
          next_follow_up_date?: string | null
          notes?: string | null
          org_id: string
          original_external_reference?: string | null
          outstanding_balance?: number
          payer_acknowledged_at?: string | null
          payer_id: string
          provenance?: string
          record_type: string
          replaces_record_id?: string | null
          settlement_status?: string
          submission_channel?: string | null
          submission_status?: string
          submitted_by_name?: string | null
          superseded_by_record_id?: string | null
          total_adjusted_amount?: number
          total_allowed_amount?: number | null
          total_billed_amount?: number
          total_paid_amount?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          adjudication_status?: string
          billing_period_end?: string
          billing_period_start?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_submission_attempt?: number
          due_date?: string | null
          external_submitted_at?: string | null
          follow_up_notes?: string | null
          follow_up_owner_id?: string | null
          id?: string
          internal_reference?: string
          is_historical?: boolean
          is_summary_only?: boolean
          next_follow_up_date?: string | null
          notes?: string | null
          org_id?: string
          original_external_reference?: string | null
          outstanding_balance?: number
          payer_acknowledged_at?: string | null
          payer_id?: string
          provenance?: string
          record_type?: string
          replaces_record_id?: string | null
          settlement_status?: string
          submission_channel?: string | null
          submission_status?: string
          submitted_by_name?: string | null
          superseded_by_record_id?: string | null
          total_adjusted_amount?: number
          total_allowed_amount?: number | null
          total_billed_amount?: number
          total_paid_amount?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "billing_payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_replaces_record_id_fkey"
            columns: ["replaces_record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_superseded_by_record_id_fkey"
            columns: ["superseded_by_record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_response_logs: {
        Row: {
          file_name: string
          file_type: string
          id: string
          metadata: Json | null
          org_id: string
          processed_at: string | null
          raw_content: string | null
          status: string | null
        }
        Insert: {
          file_name: string
          file_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          processed_at?: string | null
          raw_content?: string | null
          status?: string | null
        }
        Update: {
          file_name?: string
          file_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          processed_at?: string | null
          raw_content?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_response_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_service_agreement_lines: {
        Row: {
          agreement_id: string
          created_at: string | null
          hcpcs_code: string
          id: string
          modifier: string | null
          unit_rate: number | null
          units_authorized: number | null
          units_used: number | null
        }
        Insert: {
          agreement_id: string
          created_at?: string | null
          hcpcs_code: string
          id?: string
          modifier?: string | null
          unit_rate?: number | null
          units_authorized?: number | null
          units_used?: number | null
        }
        Update: {
          agreement_id?: string
          created_at?: string | null
          hcpcs_code?: string
          id?: string
          modifier?: string | null
          unit_rate?: number | null
          units_authorized?: number | null
          units_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_service_agreement_lines_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "billing_service_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_service_agreements: {
        Row: {
          agreement_number: string
          created_at: string | null
          diagnosis_code: string | null
          effective_date: string
          expiration_date: string
          id: string
          org_id: string
          patient_id: string
          status: string
          total_amount_authorized: number | null
          total_units_authorized: number | null
          updated_at: string | null
        }
        Insert: {
          agreement_number: string
          created_at?: string | null
          diagnosis_code?: string | null
          effective_date: string
          expiration_date: string
          id?: string
          org_id: string
          patient_id: string
          status?: string
          total_amount_authorized?: number | null
          total_units_authorized?: number | null
          updated_at?: string | null
        }
        Update: {
          agreement_number?: string
          created_at?: string | null
          diagnosis_code?: string | null
          effective_date?: string
          expiration_date?: string
          id?: string
          org_id?: string
          patient_id?: string
          status?: string
          total_amount_authorized?: number | null
          total_units_authorized?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_service_agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_service_agreements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_submission_attempts: {
        Row: {
          attempt_number: number
          external_reference: string | null
          id: string
          notes: string | null
          occurred_at: string
          org_id: string
          purpose: string
          record_id: string
          recorded_at: string
          recorded_by: string | null
          snapshot_billed_amount: number
          submission_channel: string
          submitted_by_name: string | null
        }
        Insert: {
          attempt_number: number
          external_reference?: string | null
          id?: string
          notes?: string | null
          occurred_at: string
          org_id: string
          purpose: string
          record_id: string
          recorded_at?: string
          recorded_by?: string | null
          snapshot_billed_amount: number
          submission_channel: string
          submitted_by_name?: string | null
        }
        Update: {
          attempt_number?: number
          external_reference?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          org_id?: string
          purpose?: string
          record_id?: string
          recorded_at?: string
          recorded_by?: string | null
          snapshot_billed_amount?: number
          submission_channel?: string
          submitted_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_submission_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_submission_attempts_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connection_secrets: {
        Row: {
          broker_connection_id: string
          credential_fingerprint: string | null
          encrypted_credentials: string
          org_id: string
          updated_at: string
        }
        Insert: {
          broker_connection_id: string
          credential_fingerprint?: string | null
          encrypted_credentials: string
          org_id: string
          updated_at?: string
        }
        Update: {
          broker_connection_id?: string
          credential_fingerprint?: string | null
          encrypted_credentials?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connection_secrets_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: true
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_connection_secrets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          auto_sync_enabled: boolean
          broker_type: string
          created_at: string
          created_by: string | null
          environment: string
          id: string
          last_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          last_tested_at: string | null
          name: string
          org_id: string
          public_config: Json
          status: string
          sync_window_days_ahead: number
          sync_window_days_back: number
          updated_at: string
          webhook_enabled: boolean
        }
        Insert: {
          auto_sync_enabled?: boolean
          broker_type: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          last_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          last_tested_at?: string | null
          name: string
          org_id: string
          public_config?: Json
          status?: string
          sync_window_days_ahead?: number
          sync_window_days_back?: number
          updated_at?: string
          webhook_enabled?: boolean
        }
        Update: {
          auto_sync_enabled?: boolean
          broker_type?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          last_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          last_tested_at?: string | null
          name?: string
          org_id?: string
          public_config?: Json
          status?: string
          sync_window_days_ahead?: number
          sync_window_days_back?: number
          updated_at?: string
          webhook_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_event_queue: {
        Row: {
          attempts: number
          broker_connection_id: string | null
          broker_name: string
          broker_trip_id: string | null
          created_at: string
          direction: string
          error_message: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          locked_at: string | null
          next_attempt_at: string | null
          org_id: string
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          broker_connection_id?: string | null
          broker_name: string
          broker_trip_id?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          org_id: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          broker_connection_id?: string | null
          broker_name?: string
          broker_trip_id?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          org_id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_event_queue_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_event_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_sync_runs: {
        Row: {
          broker_connection_id: string
          completed_at: string | null
          details: Json
          error_message: string | null
          failed_count: number
          fetched_count: number
          id: string
          imported_count: number
          org_id: string
          requested_by: string | null
          run_type: string
          skipped_count: number
          started_at: string
          status: string
          updated_count: number
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          broker_connection_id: string
          completed_at?: string | null
          details?: Json
          error_message?: string | null
          failed_count?: number
          fetched_count?: number
          id?: string
          imported_count?: number
          org_id: string
          requested_by?: string | null
          run_type?: string
          skipped_count?: number
          started_at?: string
          status?: string
          updated_count?: number
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          broker_connection_id?: string
          completed_at?: string | null
          details?: Json
          error_message?: string | null
          failed_count?: number
          fetched_count?: number
          id?: string
          imported_count?: number
          org_id?: string
          requested_by?: string | null
          run_type?: string
          skipped_count?: number
          started_at?: string
          status?: string
          updated_count?: number
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_sync_runs_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_sync_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_trip_imports: {
        Row: {
          broker_connection_id: string
          broker_name: string
          broker_reference_number: string | null
          broker_sync_run_id: string | null
          broker_trip_id: string | null
          created_at: string
          error_message: string | null
          external_status: string | null
          id: string
          normalized_payload: Json
          operation: string
          org_id: string
          raw_payload: Json
          trip_id: string | null
        }
        Insert: {
          broker_connection_id: string
          broker_name: string
          broker_reference_number?: string | null
          broker_sync_run_id?: string | null
          broker_trip_id?: string | null
          created_at?: string
          error_message?: string | null
          external_status?: string | null
          id?: string
          normalized_payload?: Json
          operation: string
          org_id: string
          raw_payload?: Json
          trip_id?: string | null
        }
        Update: {
          broker_connection_id?: string
          broker_name?: string
          broker_reference_number?: string | null
          broker_sync_run_id?: string | null
          broker_trip_id?: string | null
          created_at?: string
          error_message?: string | null
          external_status?: string | null
          id?: string
          normalized_payload?: Json
          operation?: string
          org_id?: string
          raw_payload?: Json
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_trip_imports_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_trip_imports_broker_sync_run_id_fkey"
            columns: ["broker_sync_run_id"]
            isOneToOne: false
            referencedRelation: "broker_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_trip_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_trip_imports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_trip_links: {
        Row: {
          broker_connection_id: string
          broker_name: string
          broker_reference_number: string | null
          broker_trip_id: string
          external_payload_snapshot: Json
          external_status: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          last_synced_at: string
          metadata: Json
          org_id: string
          trip_id: string
        }
        Insert: {
          broker_connection_id: string
          broker_name: string
          broker_reference_number?: string | null
          broker_trip_id: string
          external_payload_snapshot?: Json
          external_status?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          last_synced_at?: string
          metadata?: Json
          org_id: string
          trip_id: string
        }
        Update: {
          broker_connection_id?: string
          broker_name?: string
          broker_reference_number?: string | null
          broker_trip_id?: string
          external_payload_snapshot?: Json
          external_status?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          last_synced_at?: string
          metadata?: Json
          org_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_trip_links_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_trip_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_trip_links_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          address: string | null
          county: string | null
          created_at: string
          created_by: string | null
          current_lat: number | null
          current_lng: number | null
          custom_fields: Json | null
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          dot_medical_expiration: string | null
          dot_medical_number: string | null
          driver_record_expiration: string | null
          driver_record_issue_date: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          inspection_date: string | null
          insurance_company: string | null
          insurance_expiration_date: string | null
          insurance_policy_number: string | null
          insurance_start_date: string | null
          last_location_update: string | null
          license_number: string | null
          license_plate: string | null
          location_geog: unknown
          notes: string | null
          npi: string | null
          org_id: string
          phone: string | null
          status: string | null
          umpi: string | null
          updated_at: string | null
          user_id: string | null
          vehicle_color: string | null
          vehicle_info: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          current_lat?: number | null
          current_lng?: number | null
          custom_fields?: Json | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          dot_medical_expiration?: string | null
          dot_medical_number?: string | null
          driver_record_expiration?: string | null
          driver_record_issue_date?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          inspection_date?: string | null
          insurance_company?: string | null
          insurance_expiration_date?: string | null
          insurance_policy_number?: string | null
          insurance_start_date?: string | null
          last_location_update?: string | null
          license_number?: string | null
          license_plate?: string | null
          location_geog?: unknown
          notes?: string | null
          npi?: string | null
          org_id: string
          phone?: string | null
          status?: string | null
          umpi?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_color?: string | null
          vehicle_info?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          current_lat?: number | null
          current_lng?: number | null
          custom_fields?: Json | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          dot_medical_expiration?: string | null
          dot_medical_number?: string | null
          driver_record_expiration?: string | null
          driver_record_issue_date?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          inspection_date?: string | null
          insurance_company?: string | null
          insurance_expiration_date?: string | null
          insurance_policy_number?: string | null
          insurance_start_date?: string | null
          last_location_update?: string | null
          license_number?: string | null
          license_plate?: string | null
          location_geog?: unknown
          notes?: string | null
          npi?: string | null
          org_id?: string
          phone?: string | null
          status?: string | null
          umpi?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_color?: string | null
          vehicle_info?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          created_at: string | null
          custom_fields: Json | null
          department: string | null
          disabled: boolean
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          notes: string | null
          org_id: string
          phone: string | null
          role: string | null
          status: string | null
          system_role: Database["public"]["Enums"]["membership_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          department?: string | null
          disabled?: boolean
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          phone?: string | null
          role?: string | null
          status?: string | null
          system_role?: Database["public"]["Enums"]["membership_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          department?: string | null
          disabled?: boolean
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          role?: string | null
          status?: string | null
          system_role?: Database["public"]["Enums"]["membership_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_sms_check_logs: {
        Row: {
          check_status: string
          created_at: string
          driver_id: string | null
          eta_minutes: number | null
          id: string
          org_id: string | null
          patient_id: string | null
          reason: string | null
          request_context: Json
          trip_id: string | null
        }
        Insert: {
          check_status: string
          created_at?: string
          driver_id?: string | null
          eta_minutes?: number | null
          id?: string
          org_id?: string | null
          patient_id?: string | null
          reason?: string | null
          request_context?: Json
          trip_id?: string | null
        }
        Update: {
          check_status?: string
          created_at?: string
          driver_id?: string | null
          eta_minutes?: number | null
          id?: string
          org_id?: string | null
          patient_id?: string | null
          reason?: string | null
          request_context?: Json
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eta_sms_check_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eta_sms_check_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eta_sms_check_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eta_sms_check_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_states: {
        Row: {
          acted_by: string | null
          alert_id: string
          created_at: string
          id: string
          org_id: string
          status: string
        }
        Insert: {
          acted_by?: string | null
          alert_id: string
          created_at?: string
          id?: string
          org_id: string
          status: string
        }
        Update: {
          acted_by?: string | null
          alert_id?: string
          created_at?: string
          id?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          org_id: string | null
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          org_id?: string | null
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          org_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["membership_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          org_id: string
          role: Database["public"]["Enums"]["membership_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_uploads: {
        Row: {
          committed_by: string | null
          created_at: string
          discovery_meta: Json | null
          document_label: string | null
          error_message: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          mime_type: string | null
          notes: string | null
          org_id: string
          original_filename: string | null
          processed_at: string | null
          purpose: string | null
          source: Database["public"]["Enums"]["upload_source"] | null
          status: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by: string | null
        }
        Insert: {
          committed_by?: string | null
          created_at?: string
          discovery_meta?: Json | null
          document_label?: string | null
          error_message?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          org_id: string
          original_filename?: string | null
          processed_at?: string | null
          purpose?: string | null
          source?: Database["public"]["Enums"]["upload_source"] | null
          status?: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by?: string | null
        }
        Update: {
          committed_by?: string | null
          created_at?: string
          discovery_meta?: Json | null
          document_label?: string | null
          error_message?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          org_id?: string
          original_filename?: string | null
          processed_at?: string | null
          purpose?: string | null
          source?: Database["public"]["Enums"]["upload_source"] | null
          status?: Database["public"]["Enums"]["upload_status"] | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_uploads_committed_by_profile_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_uploads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_uploads_uploaded_by_profile_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_fees: {
        Row: {
          base_fee: number | null
          created_at: string
          custom_charges: Json | null
          deadhead_per_mile_ambulatory: number | null
          deadhead_per_mile_wheelchair: number | null
          foldable_wheelchair_base_fee: number | null
          foldable_wheelchair_deadhead_fee: number | null
          foldable_wheelchair_per_mile_fee: number | null
          id: string
          org_id: string
          per_mile_fee: number | null
          per_minute_wait_fee: number | null
          ramp_van_base_fee: number | null
          ramp_van_deadhead_fee: number | null
          ramp_van_per_mile_fee: number | null
          updated_at: string
          updated_by_id: string | null
          wait_time_free_minutes: number | null
          wait_time_hourly_rate: number | null
          wheelchair_base_fee: number | null
          wheelchair_deadhead_fee: number | null
          wheelchair_per_mile_fee: number | null
        }
        Insert: {
          base_fee?: number | null
          created_at?: string
          custom_charges?: Json | null
          deadhead_per_mile_ambulatory?: number | null
          deadhead_per_mile_wheelchair?: number | null
          foldable_wheelchair_base_fee?: number | null
          foldable_wheelchair_deadhead_fee?: number | null
          foldable_wheelchair_per_mile_fee?: number | null
          id?: string
          org_id: string
          per_mile_fee?: number | null
          per_minute_wait_fee?: number | null
          ramp_van_base_fee?: number | null
          ramp_van_deadhead_fee?: number | null
          ramp_van_per_mile_fee?: number | null
          updated_at?: string
          updated_by_id?: string | null
          wait_time_free_minutes?: number | null
          wait_time_hourly_rate?: number | null
          wheelchair_base_fee?: number | null
          wheelchair_deadhead_fee?: number | null
          wheelchair_per_mile_fee?: number | null
        }
        Update: {
          base_fee?: number | null
          created_at?: string
          custom_charges?: Json | null
          deadhead_per_mile_ambulatory?: number | null
          deadhead_per_mile_wheelchair?: number | null
          foldable_wheelchair_base_fee?: number | null
          foldable_wheelchair_deadhead_fee?: number | null
          foldable_wheelchair_per_mile_fee?: number | null
          id?: string
          org_id?: string
          per_mile_fee?: number | null
          per_minute_wait_fee?: number | null
          ramp_van_base_fee?: number | null
          ramp_van_deadhead_fee?: number | null
          ramp_van_per_mile_fee?: number | null
          updated_at?: string
          updated_by_id?: string | null
          wait_time_free_minutes?: number | null
          wait_time_hourly_rate?: number | null
          wheelchair_base_fee?: number | null
          wheelchair_deadhead_fee?: number | null
          wheelchair_per_mile_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_fees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_fees_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          last_active_at: string | null
          org_id: string
          presence_status: string | null
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          last_active_at?: string | null
          org_id: string
          presence_status?: string | null
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          last_active_at?: string | null
          org_id?: string
          presence_status?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accepted_at: string | null
          billing_email: string | null
          billing_enabled: boolean | null
          billing_state: string | null
          brokers_enabled: boolean | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          mn_its_submitter_id: string | null
          name: string
          npi: string | null
          onboarding_status: string | null
          operating_state: string | null
          sftp_enabled: boolean | null
          sftp_host: string | null
          sftp_password_enc: string | null
          sftp_port: number | null
          sftp_username: string | null
          slug: string | null
          sms_notifications_enabled: boolean | null
          tax_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          billing_email?: string | null
          billing_enabled?: boolean | null
          billing_state?: string | null
          brokers_enabled?: boolean | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          mn_its_submitter_id?: string | null
          name: string
          npi?: string | null
          onboarding_status?: string | null
          operating_state?: string | null
          sftp_enabled?: boolean | null
          sftp_host?: string | null
          sftp_password_enc?: string | null
          sftp_port?: number | null
          sftp_username?: string | null
          slug?: string | null
          sms_notifications_enabled?: boolean | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          billing_email?: string | null
          billing_enabled?: boolean | null
          billing_state?: string | null
          brokers_enabled?: boolean | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          mn_its_submitter_id?: string | null
          name?: string
          npi?: string | null
          onboarding_status?: string | null
          operating_state?: string | null
          sftp_enabled?: boolean | null
          sftp_host?: string | null
          sftp_password_enc?: string | null
          sftp_port?: number | null
          sftp_username?: string | null
          slug?: string | null
          sms_notifications_enabled?: boolean | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_sal_history: {
        Row: {
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          effective_date: string | null
          id: string
          notes: string | null
          org_id: string
          patient_id: string
          pending_reason: string | null
          status: string
          through_date: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          patient_id: string
          pending_reason?: string | null
          status: string
          through_date?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          patient_id?: string
          pending_reason?: string | null
          status?: string
          through_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_sal_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_sal_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          case_manager: string | null
          case_manager_email: string | null
          case_manager_phone: string | null
          county: string | null
          created_at: string
          created_by: string | null
          credit_used_for: string | null
          custom_fields: Json | null
          date_of_birth: string | null
          disabled: boolean
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          dob: string | null
          email: string | null
          full_name: string
          id: string
          medicaid_id: string | null
          monthly_credit: number | null
          notes: string | null
          org_id: string
          phone: string | null
          primary_address: string | null
          referral_by: string | null
          referral_date: string | null
          referral_expiration_date: string | null
          sal_effective_date: string | null
          sal_pending_reason: string | null
          sal_status: string | null
          sal_through_date: string | null
          service_type: string | null
          sms_opt_out: boolean | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          vehicle_type_need: string | null
          waiver_type: string | null
        }
        Insert: {
          case_manager?: string | null
          case_manager_email?: string | null
          case_manager_phone?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          credit_used_for?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          disabled?: boolean
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          dob?: string | null
          email?: string | null
          full_name: string
          id?: string
          medicaid_id?: string | null
          monthly_credit?: number | null
          notes?: string | null
          org_id: string
          phone?: string | null
          primary_address?: string | null
          referral_by?: string | null
          referral_date?: string | null
          referral_expiration_date?: string | null
          sal_effective_date?: string | null
          sal_pending_reason?: string | null
          sal_status?: string | null
          sal_through_date?: string | null
          service_type?: string | null
          sms_opt_out?: boolean | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_type_need?: string | null
          waiver_type?: string | null
        }
        Update: {
          case_manager?: string | null
          case_manager_email?: string | null
          case_manager_phone?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          credit_used_for?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          disabled?: boolean
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          dob?: string | null
          email?: string | null
          full_name?: string
          id?: string
          medicaid_id?: string | null
          monthly_credit?: number | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          primary_address?: string | null
          referral_by?: string | null
          referral_date?: string | null
          referral_expiration_date?: string | null
          sal_effective_date?: string | null
          sal_pending_reason?: string | null
          sal_status?: string | null
          sal_through_date?: string | null
          service_type?: string | null
          sms_opt_out?: boolean | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_type_need?: string | null
          waiver_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          token: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          token: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          token?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          error_message: string | null
          id: string
          message_type: string
          org_id: string | null
          patient_id: string | null
          phone_number: string
          provider_id: string | null
          sent_at: string | null
          status: string
          trip_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          message_type: string
          org_id?: string | null
          patient_id?: string | null
          phone_number: string
          provider_id?: string | null
          sent_at?: string | null
          status: string
          trip_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          message_type?: string
          org_id?: string | null
          patient_id?: string | null
          phone_number?: string
          provider_id?: string | null
          sent_at?: string | null
          status?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      staging_records: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          metadata: Json | null
          org_id: string
          phone: string | null
          raw_data: Json | null
          record_type: string
          row_index: number | null
          status: string | null
          upload_id: string
          validation_errors: Json | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          phone?: string | null
          raw_data?: Json | null
          record_type: string
          row_index?: number | null
          status?: string | null
          upload_id: string
          validation_errors?: Json | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          phone?: string | null
          raw_data?: Json | null
          record_type?: string
          row_index?: number | null
          status?: string | null
          upload_id?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staging_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_records_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "org_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cancellation_audits: {
        Row: {
          created_at: string | null
          device_metadata: Json | null
          driver_id: string | null
          explanation: string | null
          id: string
          location_accuracy: number | null
          location_lat: number | null
          location_lng: number | null
          location_metadata: Json | null
          location_timestamp: string | null
          org_id: string | null
          reason: string
          trip_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_metadata?: Json | null
          driver_id?: string | null
          explanation?: string | null
          id?: string
          location_accuracy?: number | null
          location_lat?: number | null
          location_lng?: number | null
          location_metadata?: Json | null
          location_timestamp?: string | null
          org_id?: string | null
          reason: string
          trip_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_metadata?: Json | null
          driver_id?: string | null
          explanation?: string | null
          id?: string
          location_accuracy?: number | null
          location_lat?: number | null
          location_lng?: number | null
          location_metadata?: Json | null
          location_timestamp?: string | null
          org_id?: string | null
          reason?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_cancellation_audits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cancellation_audits_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_status_history: {
        Row: {
          actor_id: string | null
          actor_name: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          status: string
          trip_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          status: string
          trip_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          status?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_status_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_distance_miles: number | null
          actual_duration_minutes: number | null
          billing_details: Json | null
          broker_connection_id: string | null
          broker_name: string | null
          broker_reference_number: string | null
          broker_trip_id: string | null
          cancel_explanation: string | null
          cancel_reason: string | null
          created_at: string | null
          destination: string | null
          distance_miles: number | null
          driver_id: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_location: string | null
          duration_minutes: number | null
          entry_date: string | null
          eta_sms_sent_at: string | null
          external_payload_snapshot: Json | null
          external_status: string | null
          id: string
          notes: string | null
          org_id: string
          patient_id: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string | null
          pickup_time: string | null
          requester_first_name: string | null
          requester_last_name: string | null
          requester_title: string | null
          scheduled_time: string | null
          signature_captured_at: string | null
          signature_data: string | null
          signature_declined: boolean | null
          signature_declined_reason: string | null
          signed_by_name: string | null
          status: string | null
          status_requested: string | null
          status_requested_at: string | null
          synced_at: string | null
          total_waiting_minutes: number | null
          trip_type: string | null
          updated_at: string | null
          waiting_start_time: string | null
        }
        Insert: {
          actual_distance_miles?: number | null
          actual_duration_minutes?: number | null
          billing_details?: Json | null
          broker_connection_id?: string | null
          broker_name?: string | null
          broker_reference_number?: string | null
          broker_trip_id?: string | null
          cancel_explanation?: string | null
          cancel_reason?: string | null
          created_at?: string | null
          destination?: string | null
          distance_miles?: number | null
          driver_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location?: string | null
          duration_minutes?: number | null
          entry_date?: string | null
          eta_sms_sent_at?: string | null
          external_payload_snapshot?: Json | null
          external_status?: string | null
          id?: string
          notes?: string | null
          org_id: string
          patient_id?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string | null
          pickup_time?: string | null
          requester_first_name?: string | null
          requester_last_name?: string | null
          requester_title?: string | null
          scheduled_time?: string | null
          signature_captured_at?: string | null
          signature_data?: string | null
          signature_declined?: boolean | null
          signature_declined_reason?: string | null
          signed_by_name?: string | null
          status?: string | null
          status_requested?: string | null
          status_requested_at?: string | null
          synced_at?: string | null
          total_waiting_minutes?: number | null
          trip_type?: string | null
          updated_at?: string | null
          waiting_start_time?: string | null
        }
        Update: {
          actual_distance_miles?: number | null
          actual_duration_minutes?: number | null
          billing_details?: Json | null
          broker_connection_id?: string | null
          broker_name?: string | null
          broker_reference_number?: string | null
          broker_trip_id?: string | null
          cancel_explanation?: string | null
          cancel_reason?: string | null
          created_at?: string | null
          destination?: string | null
          distance_miles?: number | null
          driver_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location?: string | null
          duration_minutes?: number | null
          entry_date?: string | null
          eta_sms_sent_at?: string | null
          external_payload_snapshot?: Json | null
          external_status?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          patient_id?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string | null
          pickup_time?: string | null
          requester_first_name?: string | null
          requester_last_name?: string | null
          requester_title?: string | null
          scheduled_time?: string | null
          signature_captured_at?: string | null
          signature_data?: string | null
          signature_declined?: boolean | null
          signature_declined_reason?: string | null
          signed_by_name?: string | null
          status?: string | null
          status_requested?: string | null
          status_requested_at?: string | null
          synced_at?: string | null
          total_waiting_minutes?: number | null
          trip_type?: string | null
          updated_at?: string | null
          waiting_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          default_org_id: string | null
          full_name: string | null
          is_super_admin: boolean | null
          phone: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          default_org_id?: string | null
          full_name?: string | null
          is_super_admin?: boolean | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          default_org_id?: string | null
          full_name?: string | null
          is_super_admin?: boolean | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_org_id_fkey"
            columns: ["default_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      auto_mark_users_away: { Args: never; Returns: undefined }
      cleanup_stale_presence: { Args: never; Returns: undefined }
      create_billing_record: {
        Args: { p_lines: Json[]; p_record: Json }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      has_billing_permission: {
        Args: { _action?: string; _org_id: string }
        Returns: boolean
      }
      is_member_of: { Args: { _org_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      record_adjustment: {
        Args: { p_adjustment: Json; p_record_id: string }
        Returns: Json
      }
      record_external_submission: {
        Args: { p_record_id: string; p_submission: Json }
        Returns: Json
      }
      record_payer_response: {
        Args: { p_record_id: string; p_response: Json }
        Returns: Json
      }
      record_payment_and_allocations: {
        Args: { p_allocations: Json[]; p_payment: Json }
        Returns: Json
      }
      record_resubmission: {
        Args: {
          p_lines: Json[]
          p_new_record: Json
          p_original_record_id: string
        }
        Returns: Json
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sync_billing_record_financials: {
        Args: { _record_id: string }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_user_presence: {
        Args: { p_org_id: string; p_status?: string; p_user_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      membership_role:
        | "owner"
        | "admin"
        | "employee"
        | "driver"
        | "patient"
        | "dispatch"
      staging_row_status: "pending" | "valid" | "error" | "committed"
      upload_source: "patients" | "drivers" | "employees" | "unknown" | "trips"
      upload_status:
        | "pending"
        | "processing"
        | "ready_for_review"
        | "committed"
        | "error"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      membership_role: [
        "owner",
        "admin",
        "employee",
        "driver",
        "patient",
        "dispatch",
      ],
      staging_row_status: ["pending", "valid", "error", "committed"],
      upload_source: ["patients", "drivers", "employees", "unknown", "trips"],
      upload_status: [
        "pending",
        "processing",
        "ready_for_review",
        "committed",
        "error",
      ],
    },
  },
} as const

