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
          birthday: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'admin' | 'support' | 'user'
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'support' | 'user'
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          title: string
          description: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high'
          category: string
          created_by: string
          assigned_to: string | null
          attachments: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high'
          category: string
          created_by: string
          assigned_to?: string | null
          attachments?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high'
          category?: string
          created_by?: string
          assigned_to?: string | null
          attachments?: Json | null
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
      social_posts: {
        Row: {
          id: string
          user_id: string
          content: string | null
          media_type: 'image' | 'video' | 'gif' | null
          media_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content?: string | null
          media_type?: 'image' | 'video' | 'gif' | null
          media_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string | null
          media_type?: 'image' | 'video' | 'gif' | null
          media_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      social_likes: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          created_at?: string
        }
      }
      social_comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      birthday_comments: {
        Row: {
          id: string
          birthday_user_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          birthday_user_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          birthday_user_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      social_post_media: {
        Row: {
          id: string
          post_id: string
          media_type: 'image' | 'video' | 'gif'
          media_url: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          media_type: 'image' | 'video' | 'gif'
          media_url: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          media_type?: 'image' | 'video' | 'gif'
          media_url?: string
          display_order?: number
          created_at?: string
        }
      }
      library_courses: {
        Row: {
          id: string
          title: string
          description: string | null
          youtube_url: string | null
          file_path: string | null
          file_name: string | null
          file_type: string | null
          file_size: number | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          youtube_url?: string | null
          file_path?: string | null
          file_name?: string | null
          file_type?: string | null
          file_size?: number | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          youtube_url?: string | null
          file_path?: string | null
          file_name?: string | null
          file_type?: string | null
          file_size?: number | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      course_parts: {
        Row: {
          id: string
          course_id: string
          part_number: number
          title: string
          description: string | null
          youtube_url: string | null
          file_path: string | null
          file_name: string | null
          file_type: string | null
          file_size: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          part_number: number
          title: string
          description?: string | null
          youtube_url?: string | null
          file_path?: string | null
          file_name?: string | null
          file_type?: string | null
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          part_number?: number
          title?: string
          description?: string | null
          youtube_url?: string | null
          file_path?: string | null
          file_name?: string | null
          file_type?: string | null
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      client_favorites: {
        Row: {
          id: string
          user_id: string
          subforum_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subforum_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subforum_id?: string
          created_at?: string
        }
      }
      professional_news: {
        Row: {
          id: string
          title: string
          description: string | null
          url: string
          image_url: string | null
          tags: string[] | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          url: string
          image_url?: string | null
          tags?: string[] | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          url?: string
          image_url?: string | null
          tags?: string[] | null
          created_by?: string | null
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
