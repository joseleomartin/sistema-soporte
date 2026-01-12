export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          email: string
          role: 'admin' | 'employee'
          full_name: string
          created_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          email: string
          role: 'admin' | 'employee'
          full_name: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          role?: 'admin' | 'employee'
          full_name?: string
          created_at?: string
        }
      }
      paystubs: {
        Row: {
          id: string
          tenant_id: string
          employee_id: string
          file_path: string
          file_name: string
          file_size: number
          period: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          employee_id: string
          file_path: string
          file_name: string
          file_size: number
          period: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          employee_id?: string
          file_path?: string
          file_name?: string
          file_size?: number
          period?: string
          uploaded_at?: string
        }
      }
      billing_log: {
        Row: {
          id: string
          tenant_id: string
          paystub_id: string
          amount: number
          period: string
          status: 'pending' | 'paid' | 'failed'
          mercadopago_payment_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          paystub_id: string
          amount?: number
          period: string
          status?: 'pending' | 'paid' | 'failed'
          mercadopago_payment_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          paystub_id?: string
          amount?: number
          period?: string
          status?: 'pending' | 'paid' | 'failed'
          mercadopago_payment_id?: string | null
          created_at?: string
        }
      }
    }
  }
}
