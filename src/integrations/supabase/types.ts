export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          bank_name: string | null
          bic: string | null
          created_at: string
          iban: string | null
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_matching_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_type: string
          match_value: string
          name: string
          property_id: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: string
          match_value?: string
          name?: string
          property_id?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: string
          match_value?: string
          name?: string
          property_id?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_matching_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_matching_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bic: string | null
          booking_date: string
          booking_text: string | null
          created_at: string
          currency: string
          iban: string | null
          id: string
          match_confidence: string | null
          matched_payment_id: string | null
          reference: string | null
          sender_receiver: string | null
          user_id: string
          value_date: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          bic?: string | null
          booking_date: string
          booking_text?: string | null
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          match_confidence?: string | null
          matched_payment_id?: string | null
          reference?: string | null
          sender_receiver?: string | null
          user_id: string
          value_date?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          bic?: string | null
          booking_date?: string
          booking_text?: string | null
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          match_confidence?: string | null
          matched_payment_id?: string | null
          reference?: string | null
          sender_receiver?: string | null
          user_id?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          category: string
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          category?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          base_rent: number
          cold_rent: number
          contract_type: string
          created_at: string
          deposit_amount: number
          end_date: string | null
          id: string
          is_indefinite: boolean
          last_rent_increase: string | null
          next_rent_increase: string | null
          notes: string | null
          notice_period_months: number
          property_id: string
          rent_increase_index: string | null
          start_date: string
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
          warm_rent: number
        }
        Insert: {
          base_rent?: number
          cold_rent?: number
          contract_type?: string
          created_at?: string
          deposit_amount?: number
          end_date?: string | null
          id?: string
          is_indefinite?: boolean
          last_rent_increase?: string | null
          next_rent_increase?: string | null
          notes?: string | null
          notice_period_months?: number
          property_id: string
          rent_increase_index?: string | null
          start_date: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          warm_rent?: number
        }
        Update: {
          base_rent?: number
          cold_rent?: number
          contract_type?: string
          created_at?: string
          deposit_amount?: number
          end_date?: string | null
          id?: string
          is_indefinite?: boolean
          last_rent_increase?: string | null
          next_rent_increase?: string | null
          notes?: string | null
          notice_period_months?: number
          property_id?: string
          rent_increase_index?: string | null
          start_date?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          warm_rent?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_call_logs: {
        Row: {
          call_date: string
          created_at: string
          duration_minutes: number | null
          id: string
          lead_id: string
          notes: string | null
          outcome: string
          recording_url: string | null
          transcript: string | null
          transcript_summary: string | null
          user_id: string
        }
        Insert: {
          call_date?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          outcome?: string
          recording_url?: string | null
          transcript?: string | null
          transcript_summary?: string | null
          user_id: string
        }
        Update: {
          call_date?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          outcome?: string
          recording_url?: string | null
          transcript?: string | null
          transcript_summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          address: string | null
          category: string
          company: string | null
          created_at: string
          email: string | null
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: string
          company?: string | null
          created_at?: string
          email?: string | null
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          category?: string
          company?: string | null
          created_at?: string
          email?: string | null
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          expected_rent: number | null
          expected_yield: number | null
          id: string
          lost_reason: string | null
          notes: string | null
          property_type: string | null
          purchase_price: number | null
          source: string | null
          sqm: number | null
          stage: string
          title: string
          units: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          expected_rent?: number | null
          expected_yield?: number | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          property_type?: string | null
          purchase_price?: number | null
          source?: string | null
          sqm?: number | null
          stage?: string
          title: string
          units?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          expected_rent?: number | null
          expected_yield?: number | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          property_type?: string | null
          purchase_price?: number | null
          source?: string | null
          sqm?: number | null
          stage?: string
          title?: string
          units?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_expiries: {
        Row: {
          created_at: string | null
          expiry_date: string
          id: string
          name: string
          notes: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expiry_date: string
          id?: string
          name: string
          notes?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expiry_date?: string
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_expiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      energy_certificates: {
        Row: {
          certificate_type: string
          created_at: string
          energy_class: string | null
          energy_value: number | null
          expiry_date: string
          id: string
          issue_date: string
          issuer: string | null
          notes: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          certificate_type?: string
          created_at?: string
          energy_class?: string | null
          energy_value?: number | null
          expiry_date: string
          id?: string
          issue_date: string
          issuer?: string | null
          notes?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          certificate_type?: string
          created_at?: string
          energy_class?: string | null
          energy_value?: number | null
          expiry_date?: string
          id?: string
          issue_date?: string
          issuer?: string | null
          notes?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "energy_certificates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          category: string
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          is_recurring: boolean
          notes: string | null
          payment_date: string | null
          property_id: string | null
          recurrence_interval: string | null
          status: string
          tax_amount: number
          updated_at: string
          user_id: string
          vendor_name: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          is_recurring?: boolean
          notes?: string | null
          payment_date?: string | null
          property_id?: string | null
          recurrence_interval?: string | null
          status?: string
          tax_amount?: number
          updated_at?: string
          user_id: string
          vendor_name: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          is_recurring?: boolean
          notes?: string | null
          payment_date?: string | null
          property_id?: string | null
          recurrence_interval?: string | null
          status?: string
          tax_amount?: number
          updated_at?: string
          user_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          bank_name: string
          created_at: string
          end_date: string | null
          fixed_interest_until: string | null
          id: string
          interest_rate: number
          loan_amount: number
          loan_type: string
          monthly_payment: number
          notes: string | null
          property_id: string
          remaining_balance: number
          repayment_rate: number
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name?: string
          created_at?: string
          end_date?: string | null
          fixed_interest_until?: string | null
          id?: string
          interest_rate?: number
          loan_amount?: number
          loan_type?: string
          monthly_payment?: number
          notes?: string | null
          property_id: string
          remaining_balance?: number
          repayment_rate?: number
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string
          created_at?: string
          end_date?: string | null
          fixed_interest_until?: string | null
          id?: string
          interest_rate?: number
          loan_amount?: number
          loan_type?: string
          monthly_payment?: number
          notes?: string | null
          property_id?: string
          remaining_balance?: number
          repayment_rate?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          category: string
          completed: boolean
          created_at: string | null
          estimated_cost: number
          id: string
          notes: string | null
          planned_date: string | null
          priority: string
          property_id: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          completed?: boolean
          created_at?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          planned_date?: string | null
          priority?: string
          property_id: string
          title?: string
          user_id: string
        }
        Update: {
          category?: string
          completed?: boolean
          created_at?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          planned_date?: string | null
          priority?: string
          property_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_resolutions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          meeting_id: string
          resolution_number: number
          result: string
          title: string
          user_id: string
          votes_abstain: number
          votes_against: number
          votes_for: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          meeting_id: string
          resolution_number?: number
          result?: string
          title: string
          user_id: string
          votes_abstain?: number
          votes_against?: number
          votes_for?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          meeting_id?: string
          resolution_number?: number
          result?: string
          title?: string
          user_id?: string
          votes_abstain?: number
          votes_against?: number
          votes_for?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_resolutions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "owner_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          property_id: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          property_id: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          property_id?: string
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          created_at: string
          id: string
          meter_id: string
          note: string | null
          reading_date: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          meter_id: string
          note?: string | null
          reading_date?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          meter_id?: string
          note?: string | null
          reading_date?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
        ]
      }
      meters: {
        Row: {
          created_at: string
          id: string
          location_note: string | null
          meter_number: string
          meter_type: string
          property_id: string
          unit_label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_note?: string | null
          meter_number?: string
          meter_type?: string
          property_id: string
          unit_label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_note?: string | null
          meter_number?: string
          meter_type?: string
          property_id?: string
          unit_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_meetings: {
        Row: {
          attendee_count: number | null
          created_at: string
          id: string
          is_virtual: boolean
          location: string | null
          meeting_date: string
          meeting_link: string | null
          minutes: string | null
          property_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendee_count?: number | null
          created_at?: string
          id?: string
          is_virtual?: boolean
          location?: string | null
          meeting_date: string
          meeting_link?: string | null
          minutes?: string | null
          property_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendee_count?: number | null
          created_at?: string
          id?: string
          is_virtual?: boolean
          location?: string | null
          meeting_date?: string
          meeting_link?: string | null
          minutes?: string | null
          property_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_meetings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_goals: {
        Row: {
          created_at: string | null
          current_value: number
          deadline: string | null
          id: string
          reason: string | null
          target: number
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number
          deadline?: string | null
          id?: string
          reason?: string | null
          target?: number
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number
          deadline?: string | null
          id?: string
          reason?: string | null
          target?: number
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats_snapshots: {
        Row: {
          id: string
          user_id: string
          snapshot_date: string
          total_units: number
          property_count: number
          equity: number
          total_cashflow: number
          total_value: number
          total_rent: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          snapshot_date: string
          total_units?: number
          property_count?: number
          equity?: number
          total_cashflow?: number
          total_value?: number
          total_rent?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          snapshot_date?: string
          total_units?: number
          property_count?: number
          equity?: number
          total_cashflow?: number
          total_value?: number
          total_rent?: number
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          experience_level: string | null
          id: string
          investor_type: string | null
          onboarding_completed: boolean
          property_count_goal: number | null
          strategy: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          id?: string
          investor_type?: string | null
          onboarding_completed?: boolean
          property_count_goal?: number | null
          strategy?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          id?: string
          investor_type?: string | null
          onboarding_completed?: boolean
          property_count_goal?: number | null
          strategy?: string | null
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string
          current_value: number
          id: string
          interest_rate: number
          location: string
          monthly_cashflow: number
          monthly_credit_rate: number
          monthly_expenses: number
          monthly_rent: number
          name: string
          ownership: string
          purchase_date: string
          purchase_price: number
          remaining_debt: number
          sqm: number
          type: string
          units: number
          updated_at: string
          user_id: string
          year_built: number
        }
        Insert: {
          address: string
          created_at?: string
          current_value: number
          id?: string
          interest_rate?: number
          location: string
          monthly_cashflow?: number
          monthly_credit_rate?: number
          monthly_expenses?: number
          monthly_rent?: number
          name: string
          ownership?: string
          purchase_date: string
          purchase_price: number
          remaining_debt?: number
          sqm?: number
          type?: string
          units?: number
          updated_at?: string
          user_id: string
          year_built?: number
        }
        Update: {
          address?: string
          created_at?: string
          current_value?: number
          id?: string
          interest_rate?: number
          location?: string
          monthly_cashflow?: number
          monthly_credit_rate?: number
          monthly_expenses?: number
          monthly_rent?: number
          name?: string
          ownership?: string
          purchase_date?: string
          purchase_price?: number
          remaining_debt?: number
          sqm?: number
          type?: string
          units?: number
          updated_at?: string
          user_id?: string
          year_built?: number
        }
        Relationships: []
      }
      property_documents: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string | null
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string | null
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string | null
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_insurances: {
        Row: {
          annual_premium: number
          created_at: string | null
          id: string
          notes: string | null
          policy_number: string | null
          property_id: string
          provider: string
          renewal_date: string | null
          type: string
          user_id: string
        }
        Insert: {
          annual_premium?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          policy_number?: string | null
          property_id: string
          provider?: string
          renewal_date?: string | null
          type?: string
          user_id: string
        }
        Update: {
          annual_premium?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          policy_number?: string | null
          property_id?: string
          provider?: string
          renewal_date?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_insurances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_value_history: {
        Row: {
          created_at: string | null
          date: string
          id: string
          note: string | null
          property_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          property_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          property_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_value_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          landlord_id: string
          note: string | null
          paid_date: string | null
          property_id: string
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          landlord_id: string
          note?: string | null
          paid_date?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          landlord_id?: string
          note?: string | null
          paid_date?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          annual_cost: number
          contact_id: string | null
          contract_number: string | null
          created_at: string
          end_date: string | null
          id: string
          is_auto_renew: boolean
          notes: string | null
          notice_period_months: number
          payment_interval: string
          property_id: string
          provider_name: string
          service_type: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_cost?: number
          contact_id?: string | null
          contract_number?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_auto_renew?: boolean
          notes?: string | null
          notice_period_months?: number
          payment_interval?: string
          property_id: string
          provider_name: string
          service_type?: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_cost?: number
          contact_id?: string | null
          contract_number?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_auto_renew?: boolean
          notes?: string | null
          notice_period_months?: number
          payment_interval?: string
          property_id?: string
          provider_name?: string
          service_type?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          invitation_token: string | null
          member_email: string
          member_user_id: string | null
          owner_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_token?: string | null
          member_email: string
          member_user_id?: string | null
          owner_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitation_token?: string | null
          member_email?: string
          member_user_id?: string | null
          owner_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          deposit: number | null
          email: string | null
          first_name: string
          id: string
          invitation_sent_at: string | null
          invitation_token: string | null
          is_active: boolean | null
          landlord_id: string
          last_name: string
          monthly_rent: number | null
          move_in_date: string | null
          move_out_date: string | null
          phone: string | null
          property_id: string
          unit_label: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deposit?: number | null
          email?: string | null
          first_name: string
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          is_active?: boolean | null
          landlord_id: string
          last_name: string
          monthly_rent?: number | null
          move_in_date?: string | null
          move_out_date?: string | null
          phone?: string | null
          property_id: string
          unit_label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deposit?: number | null
          email?: string | null
          first_name?: string
          id?: string
          invitation_sent_at?: string | null
          invitation_token?: string | null
          is_active?: boolean | null
          landlord_id?: string
          last_name?: string
          monthly_rent?: number | null
          move_in_date?: string | null
          move_out_date?: string | null
          phone?: string | null
          property_id?: string
          unit_label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          actual_cost: number | null
          assigned_to_contact_id: string | null
          assigned_to_user_id: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          cost_note: string | null
          created_at: string
          description: string
          estimated_cost: number | null
          handworker_note: string | null
          id: string
          landlord_id: string
          landlord_note: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          property_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_to_contact_id?: string | null
          assigned_to_user_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          cost_note?: string | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          handworker_note?: string | null
          id?: string
          landlord_id: string
          landlord_note?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          property_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          assigned_to_contact_id?: string | null
          assigned_to_user_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          cost_note?: string | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          handworker_note?: string | null
          id?: string
          landlord_id?: string
          landlord_note?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          property_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_contact_id_fkey"
            columns: ["assigned_to_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string | null
          description: string
          due_date: string | null
          due_time: string | null
          id: string
          labels: string[]
          priority: number
          project: string
          sort_order: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          labels?: string[]
          priority?: number
          project?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          labels?: string[]
          priority?: number
          project?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_banks: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      utility_billing_items: {
        Row: {
          billing_id: string
          category: string
          created_at: string
          description: string
          distribution_key: string
          id: string
          tenant_amount: number
          total_amount: number
          user_id: string
        }
        Insert: {
          billing_id: string
          category?: string
          created_at?: string
          description?: string
          distribution_key?: string
          id?: string
          tenant_amount?: number
          total_amount?: number
          user_id: string
        }
        Update: {
          billing_id?: string
          category?: string
          created_at?: string
          description?: string
          distribution_key?: string
          id?: string
          tenant_amount?: number
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_billing_items_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "utility_billings"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_billings: {
        Row: {
          balance: number
          billing_period_end: string
          billing_period_start: string
          created_at: string
          id: string
          notes: string | null
          prepayments: number
          property_id: string
          status: string
          tenant_id: string | null
          tenant_share: number
          total_costs: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          billing_period_end: string
          billing_period_start: string
          created_at?: string
          id?: string
          notes?: string | null
          prepayments?: number
          property_id: string
          status?: string
          tenant_id?: string | null
          tenant_share?: number
          total_costs?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          id?: string
          notes?: string | null
          prepayments?: number
          property_id?: string
          status?: string
          tenant_id?: string | null
          tenant_share?: number
          total_costs?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_billings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_billings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_protocols: {
        Row: {
          id: string
          property_id: string
          tenant_id: string
          created_by: string
          type: string
          protocol_data: Json
          pdf_storage_path: string | null
          confirm_token: string | null
          tenant_confirmed_at: string | null
          tenant_signature_data: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          tenant_id: string
          created_by: string
          type: string
          protocol_data?: Json
          pdf_storage_path?: string | null
          confirm_token?: string | null
          tenant_confirmed_at?: string | null
          tenant_signature_data?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          tenant_id?: string
          created_by?: string
          type?: string
          protocol_data?: Json
          pdf_storage_path?: string | null
          confirm_token?: string | null
          tenant_confirmed_at?: string | null
          tenant_signature_data?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "handover_protocols_property_id_fkey", columns: ["property_id"], referencedRelation: "properties", referencedColumns: ["id"] },
          { foreignKeyName: "handover_protocols_tenant_id_fkey", columns: ["tenant_id"], referencedRelation: "tenants", referencedColumns: ["id"] },
        ]
      }
      contract_signature_requests: {
        Row: {
          id: string
          property_id: string
          tenant_id: string
          created_by: string
          type: string
          contract_data: Json
          pdf_storage_path: string | null
          confirm_token: string | null
          landlord_signed_at: string | null
          tenant_signed_at: string | null
          tenant_signature_data: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          tenant_id: string
          created_by: string
          type?: string
          contract_data?: Json
          pdf_storage_path?: string | null
          confirm_token?: string | null
          landlord_signed_at?: string | null
          tenant_signed_at?: string | null
          tenant_signature_data?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          tenant_id?: string
          created_by?: string
          type?: string
          contract_data?: Json
          pdf_storage_path?: string | null
          confirm_token?: string | null
          landlord_signed_at?: string | null
          tenant_signed_at?: string | null
          tenant_signature_data?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "contract_signature_requests_property_id_fkey", columns: ["property_id"], referencedRelation: "properties", referencedColumns: ["id"] },
          { foreignKeyName: "contract_signature_requests_tenant_id_fkey", columns: ["tenant_id"], referencedRelation: "tenants", referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tenant_landlord: { Args: { _tenant_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_message_participant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      get_handover_by_token: { Args: { _token: string }; Returns: Json }
      confirm_handover_by_token: { Args: { _token: string; _signature_data?: string | null }; Returns: boolean }
      get_contract_by_token: { Args: { _token: string }; Returns: Json }
      sign_contract_by_token: { Args: { _token: string; _signature_data?: string | null }; Returns: boolean }
    }
    Enums: {
      app_role: "landlord" | "tenant" | "handworker"
      payment_status: "pending" | "confirmed" | "overdue" | "cancelled"
      ticket_category:
        | "repair"
        | "damage"
        | "maintenance"
        | "question"
        | "other"
        | "documents"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {
      app_role: ["landlord", "tenant", "handworker"],
      payment_status: ["pending", "confirmed", "overdue", "cancelled"],
      ticket_category: [
        "repair",
        "damage",
        "maintenance",
        "question",
        "other",
        "documents",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
