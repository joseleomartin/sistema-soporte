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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'support' | 'user'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'admin' | 'support' | 'user'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'support' | 'user'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          title: string
          description: string
          status: 'open' | 'in_progress' | 'resolved'
          priority: 'low' | 'medium' | 'high'
          created_by: string
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          status?: 'open' | 'in_progress' | 'resolved'
          priority?: 'low' | 'medium' | 'high'
          created_by: string
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: 'open' | 'in_progress' | 'resolved'
          priority?: 'low' | 'medium' | 'high'
          created_by?: string
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          user_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          user_id?: string
          message?: string
          created_at?: string
        }
      }
      subforums: {
        Row: {
          id: string
          name: string
          description: string | null
          client_name: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          client_name: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          client_name?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      subforum_permissions: {
        Row: {
          id: string
          subforum_id: string
          user_id: string
          can_view: boolean
          can_post: boolean
          can_moderate: boolean
          created_at: string
        }
        Insert: {
          id?: string
          subforum_id: string
          user_id: string
          can_view?: boolean
          can_post?: boolean
          can_moderate?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          subforum_id?: string
          user_id?: string
          can_view?: boolean
          can_post?: boolean
          can_moderate?: boolean
          created_at?: string
        }
      }
      forum_threads: {
        Row: {
          id: string
          subforum_id: string
          title: string
          content: string
          created_by: string
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subforum_id: string
          title: string
          content: string
          created_by: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subforum_id?: string
          title?: string
          content?: string
          created_by?: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      meeting_rooms: {
        Row: {
          id: string
          name: string
          description: string | null
          jitsi_room_id: string
          created_by: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          jitsi_room_id: string
          created_by: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          jitsi_room_id?: string
          created_by?: string
          is_active?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
