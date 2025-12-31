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
          visible_modules: Json | null
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
          visible_modules?: Json | null
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
          visible_modules?: Json | null
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
          cuit: string | null
          email: string | null
          access_keys: string | null
          economic_link: string | null
          contact_full_name: string | null
          client_type: string | null
          phone: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          client_name: string
          cuit?: string | null
          email?: string | null
          access_keys?: string | null
          economic_link?: string | null
          contact_full_name?: string | null
          client_type?: string | null
          phone?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          client_name?: string
          cuit?: string | null
          email?: string | null
          access_keys?: string | null
          economic_link?: string | null
          contact_full_name?: string | null
          client_type?: string | null
          phone?: string | null
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
          reel_url: string | null
          reel_platform: 'instagram' | 'tiktok' | 'x' | 'twitter' | 'facebook' | 'youtube' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content?: string | null
          media_type?: 'image' | 'video' | 'gif' | null
          media_url?: string | null
          reel_url?: string | null
          reel_platform?: 'instagram' | 'tiktok' | 'x' | 'twitter' | 'facebook' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string | null
          media_type?: 'image' | 'video' | 'gif' | null
          media_url?: string | null
          reel_url?: string | null
          reel_platform?: 'instagram' | 'tiktok' | 'x' | 'twitter' | 'facebook' | null
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
          tenant_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subforum_id: string
          tenant_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subforum_id?: string
          tenant_id?: string
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
      // ============================================
      // SISTEMA FABINSA - PRODUCCIÓN Y GESTIÓN
      // ============================================
      products: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          familia: string | null
          medida: string | null
          caracteristica: string | null
          peso_unidad: number
          precio_venta: number | null
          cantidad_fabricar: number
          cantidad_por_hora: number
          iibb_porcentaje: number
          otros_costos: number
          moneda_precio: 'ARS' | 'USD'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          familia?: string | null
          medida?: string | null
          caracteristica?: string | null
          peso_unidad: number
          precio_venta?: number | null
          cantidad_fabricar?: number
          cantidad_por_hora?: number
          iibb_porcentaje?: number
          otros_costos?: number
          moneda_precio?: 'ARS' | 'USD'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          familia?: string | null
          medida?: string | null
          caracteristica?: string | null
          peso_unidad?: number
          precio_venta?: number | null
          cantidad_fabricar?: number
          cantidad_por_hora?: number
          iibb_porcentaje?: number
          otros_costos?: number
          moneda_precio?: 'ARS' | 'USD'
          created_at?: string
          updated_at?: string
        }
      }
      product_materials: {
        Row: {
          id: string
          product_id: string
          material_name: string
          kg_por_unidad: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          material_name: string
          kg_por_unidad: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          material_name?: string
          kg_por_unidad?: number
          created_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          valor_hora: number
          dias_trabajados: number
          horas_dia: number
          ausencias: number
          vacaciones: number
          feriados: number
          lic_enfermedad: number
          otras_licencias: number
          horas_descanso: number
          carga_social: number
          horas_extras: number
          feriados_trabajados: number
          valor_hora_ajustado: number | null
          horas_productivas: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          valor_hora: number
          dias_trabajados?: number
          horas_dia?: number
          ausencias?: number
          vacaciones?: number
          feriados?: number
          lic_enfermedad?: number
          otras_licencias?: number
          horas_descanso?: number
          carga_social?: number
          horas_extras?: number
          feriados_trabajados?: number
          valor_hora_ajustado?: number | null
          horas_productivas?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          valor_hora?: number
          dias_trabajados?: number
          horas_dia?: number
          ausencias?: number
          vacaciones?: number
          feriados?: number
          lic_enfermedad?: number
          otras_licencias?: number
          horas_descanso?: number
          carga_social?: number
          horas_extras?: number
          feriados_trabajados?: number
          valor_hora_ajustado?: number | null
          horas_productivas?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      stock_materials: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          material: string
          kg: number
          costo_kilo_usd: number
          valor_dolar: number
          moneda: 'ARS' | 'USD'
          stock_minimo: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          material: string
          kg?: number
          costo_kilo_usd: number
          valor_dolar?: number
          moneda?: 'ARS' | 'USD'
          stock_minimo?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          material?: string
          kg?: number
          costo_kilo_usd?: number
          valor_dolar?: number
          moneda?: 'ARS' | 'USD'
          stock_minimo?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      stock_products: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          cantidad: number
          peso_unidad: number
          costo_unit_total: number | null
          stock_minimo: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          cantidad?: number
          peso_unidad: number
          costo_unit_total?: number | null
          stock_minimo?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          cantidad?: number
          peso_unidad?: number
          costo_unit_total?: number | null
          stock_minimo?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      resale_products: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          cantidad: number
          costo_unitario: number
          otros_costos: number
          costo_unitario_final: number
          moneda: 'ARS' | 'USD'
          valor_dolar: number | null
          stock_minimo: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          cantidad?: number
          costo_unitario: number
          otros_costos?: number
          costo_unitario_final: number
          moneda?: 'ARS' | 'USD'
          valor_dolar?: number | null
          stock_minimo?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          cantidad?: number
          costo_unitario?: number
          otros_costos?: number
          costo_unitario_final?: number
          moneda?: 'ARS' | 'USD'
          valor_dolar?: number | null
          stock_minimo?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          tenant_id: string
          fecha: string
          producto: string
          tipo_producto: 'fabricado' | 'reventa'
          cantidad: number
          precio_unitario: number
          descuento_pct: number
          iib_pct: number
          precio_final: number
          costo_unitario: number
          ingreso_bruto: number
          ingreso_neto: number
          ganancia_un: number
          ganancia_total: number
          stock_antes: number
          stock_despues: number
          cliente: string | null
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          fecha?: string
          producto: string
          tipo_producto: 'fabricado' | 'reventa'
          cantidad: number
          precio_unitario: number
          descuento_pct?: number
          iib_pct?: number
          cliente?: string | null
          order_id?: string | null
          precio_final: number
          costo_unitario: number
          ingreso_bruto: number
          ingreso_neto: number
          ganancia_un: number
          ganancia_total: number
          stock_antes: number
          stock_despues: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          fecha?: string
          producto?: string
          tipo_producto?: 'fabricado' | 'reventa'
          cantidad?: number
          precio_unitario?: number
          descuento_pct?: number
          iib_pct?: number
          cliente?: string | null
          precio_final?: number
          costo_unitario?: number
          ingreso_bruto?: number
          ingreso_neto?: number
          ganancia_un?: number
          ganancia_total?: number
          stock_antes?: number
          stock_despues?: number
          created_at?: string
        }
      }
      purchases_materials: {
        Row: {
          id: string
          tenant_id: string
          fecha: string
          material: string
          cantidad: number
          precio: number
          proveedor: string
          moneda: 'ARS' | 'USD'
          valor_dolar: number | null
          total: number
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          fecha: string
          material: string
          cantidad: number
          precio: number
          proveedor: string
          moneda?: 'ARS' | 'USD'
          valor_dolar?: number | null
          total: number
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          fecha?: string
          material?: string
          cantidad?: number
          precio?: number
          proveedor?: string
          moneda?: 'ARS' | 'USD'
          valor_dolar?: number | null
          total?: number
          created_at?: string
        }
      }
      purchases_products: {
        Row: {
          id: string
          tenant_id: string
          fecha: string
          producto: string
          cantidad: number
          precio: number
          proveedor: string
          moneda: 'ARS' | 'USD'
          valor_dolar: number | null
          total: number
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          fecha: string
          producto: string
          cantidad: number
          precio: number
          proveedor: string
          moneda?: 'ARS' | 'USD'
          valor_dolar?: number | null
          total: number
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          fecha?: string
          producto?: string
          cantidad?: number
          precio?: number
          proveedor?: string
          moneda?: 'ARS' | 'USD'
          valor_dolar?: number | null
          total?: number
          created_at?: string
        }
      }
      production_metrics: {
        Row: {
          id: string
          tenant_id: string
          fecha: string
          producto: string
          cantidad: number
          peso_unidad: number
          kg_consumidos: number
          costo_mp: number
          costo_mo: number
          costo_prod_unit: number
          costo_total_mp: number
          precio_venta: number | null
          rentabilidad_neta: number | null
          rentabilidad_total: number | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          fecha: string
          producto: string
          cantidad: number
          peso_unidad: number
          kg_consumidos: number
          costo_mp: number
          costo_mo: number
          costo_prod_unit: number
          costo_total_mp: number
          precio_venta?: number | null
          rentabilidad_neta?: number | null
          rentabilidad_total?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          fecha?: string
          producto?: string
          cantidad?: number
          peso_unidad?: number
          kg_consumidos?: number
          costo_mp?: number
          costo_mo?: number
          costo_prod_unit?: number
          costo_total_mp?: number
          precio_venta?: number | null
          rentabilidad_neta?: number | null
          rentabilidad_total?: number | null
          created_at?: string
        }
      }
      inventory_movements: {
        Row: {
          id: string
          tenant_id: string
          tipo: 'ingreso_mp' | 'egreso_mp' | 'ingreso_pr' | 'egreso_pr' | 'ingreso_fab' | 'egreso_fab'
          item_nombre: string
          cantidad: number
          motivo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          tipo: 'ingreso_mp' | 'egreso_mp' | 'ingreso_pr' | 'egreso_pr' | 'ingreso_fab' | 'egreso_fab'
          item_nombre: string
          cantidad: number
          motivo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          tipo?: 'ingreso_mp' | 'egreso_mp' | 'ingreso_pr' | 'egreso_pr' | 'ingreso_fab' | 'egreso_fab'
          item_nombre?: string
          cantidad?: number
          motivo?: string | null
          created_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          razon_social: string | null
          cuit: string | null
          telefono: string | null
          email: string | null
          provincia: string | null
          direccion: string | null
          observaciones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          razon_social?: string | null
          cuit?: string | null
          telefono?: string | null
          email?: string | null
          provincia?: string | null
          direccion?: string | null
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          razon_social?: string | null
          cuit?: string | null
          telefono?: string | null
          email?: string | null
          provincia?: string | null
          direccion?: string | null
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      supplier_documents: {
        Row: {
          id: string
          supplier_id: string
          tenant_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          tenant_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          tenant_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          uploaded_by?: string
          created_at?: string
        }
      }
      supplier_drive_mapping: {
        Row: {
          id: string
          supplier_id: string
          tenant_id: string
          google_drive_folder_id: string
          folder_name: string
          folder_link: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          tenant_id: string
          google_drive_folder_id: string
          folder_name: string
          folder_link?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          tenant_id?: string
          google_drive_folder_id?: string
          folder_name?: string
          folder_link?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          razon_social: string | null
          cuit: string | null
          telefono: string | null
          email: string | null
          provincia: string | null
          direccion: string | null
          observaciones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          razon_social?: string | null
          cuit?: string | null
          telefono?: string | null
          email?: string | null
          provincia?: string | null
          direccion?: string | null
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          razon_social?: string | null
          cuit?: string | null
          telefono?: string | null
          email?: string | null
          provincia?: string | null
          direccion?: string | null
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      client_documents: {
        Row: {
          id: string
          client_id: string
          tenant_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          tenant_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          tenant_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          uploaded_by?: string
          created_at?: string
        }
      }
      client_drive_mapping: {
        Row: {
          id: string
          client_id: string
          tenant_id: string
          google_drive_folder_id: string
          folder_name: string
          folder_link: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          tenant_id: string
          google_drive_folder_id: string
          folder_name: string
          folder_link?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          tenant_id?: string
          google_drive_folder_id?: string
          folder_name?: string
          folder_link?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string
          color: string
          tenant_id: string | null
          hourly_cost: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          color?: string
          tenant_id?: string | null
          hourly_cost?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          color?: string
          tenant_id?: string | null
          hourly_cost?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      user_departments: {
        Row: {
          id: string
          user_id: string
          department_id: string
          assigned_by: string
          tenant_id: string | null
          assigned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          department_id: string
          assigned_by: string
          tenant_id?: string | null
          assigned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          department_id?: string
          assigned_by?: string
          tenant_id?: string | null
          assigned_at?: string
        }
      }
      department_permissions: {
        Row: {
          id: string
          department_id: string
          tenant_id: string
          module_view: string
          can_view: boolean
          can_create: boolean
          can_edit: boolean
          can_delete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          department_id: string
          tenant_id: string
          module_view: string
          can_view?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_delete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          department_id?: string
          tenant_id?: string
          module_view?: string
          can_view?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_delete?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          tenant_id: string
          status: 'trial' | 'active' | 'expired' | 'cancelled'
          plan_type: 'trial' | 'basic' | 'premium' | 'enterprise'
          trial_start_date: string
          trial_end_date: string | null
          subscription_start_date: string | null
          subscription_end_date: string | null
          max_users: number
          current_users_count: number
          price_per_month: number
          payment_method: string | null
          payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
          last_payment_date: string | null
          next_payment_date: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          status?: 'trial' | 'active' | 'expired' | 'cancelled'
          plan_type?: 'trial' | 'basic' | 'premium' | 'enterprise'
          trial_start_date?: string
          trial_end_date?: string | null
          subscription_start_date?: string | null
          subscription_end_date?: string | null
          max_users?: number
          current_users_count?: number
          price_per_month?: number
          payment_method?: string | null
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded'
          last_payment_date?: string | null
          next_payment_date?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          status?: 'trial' | 'active' | 'expired' | 'cancelled'
          plan_type?: 'trial' | 'basic' | 'premium' | 'enterprise'
          trial_start_date?: string
          trial_end_date?: string | null
          subscription_start_date?: string | null
          subscription_end_date?: string | null
          max_users?: number
          current_users_count?: number
          price_per_month?: number
          payment_method?: string | null
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded'
          last_payment_date?: string | null
          next_payment_date?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_subscription_status: {
        Args: {
          p_tenant_id: string
        }
        Returns: Json
      }
      check_user_limit: {
        Args: {
          p_tenant_id: string
        }
        Returns: boolean
      }
      activate_paid_subscription: {
        Args: {
          p_tenant_id: string
          p_user_count?: number
        }
        Returns: undefined
      }
      calculate_subscription_price: {
        Args: {
          p_user_count: number
        }
        Returns: number
      }
      initialize_trial_subscription: {
        Args: {
          p_tenant_id: string
        }
        Returns: string
      }
      update_subscription_user_count: {
        Args: {
          p_tenant_id: string
        }
        Returns: undefined
      }
      fix_subscription_max_users_for_tenant: {
        Args: {
          p_tenant_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
