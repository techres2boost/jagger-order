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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          additional_info: string | null
          address_type: string
          apartment_number: string | null
          city: string | null
          created_at: string | null
          floor_number: string | null
          full_address: string
          id: string
          is_default: boolean | null
          label: string | null
          latitude: number
          longitude: number
          photo_url: string | null
          user_id: string
        }
        Insert: {
          additional_info?: string | null
          address_type: string
          apartment_number?: string | null
          city?: string | null
          created_at?: string | null
          floor_number?: string | null
          full_address: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          latitude: number
          longitude: number
          photo_url?: string | null
          user_id: string
        }
        Update: {
          additional_info?: string | null
          address_type?: string
          apartment_number?: string | null
          city?: string | null
          created_at?: string | null
          floor_number?: string | null
          full_address?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          latitude?: number
          longitude?: number
          photo_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          order_id: string | null
          read: boolean | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          order_id?: string | null
          read?: boolean | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string | null
          read?: boolean | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: number
          prep_time_minutes: number
        }
        Insert: {
          id?: number
          prep_time_minutes?: number
        }
        Update: {
          id?: number
          prep_time_minutes?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      livreur_ratings: {
        Row: {
          comment: string | null
          created_at: string
          dismissed: boolean
          id: string
          livreur_id: string | null
          order_id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          livreur_id?: string | null
          order_id: string
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          livreur_id?: string | null
          order_id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livreur_ratings_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreur_stats"
            referencedColumns: ["livreur_id"]
          },
          {
            foreignKeyName: "livreur_ratings_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livreur_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      livreurs: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          nom: string
          telephone: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          nom: string
          telephone: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          nom?: string
          telephone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      menu_item_option_groups: {
        Row: {
          display_order: number | null
          menu_item_id: string
          option_group_id: string
        }
        Insert: {
          display_order?: number | null
          menu_item_id: string
          option_group_id: string
        }
        Update: {
          display_order?: number | null
          menu_item_id?: string
          option_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_option_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_option_groups_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_sizes: {
        Row: {
          display_order: number | null
          id: string
          menu_item_id: string
          price: number
          size_label: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          menu_item_id: string
          price: number
          size_label: string
        }
        Update: {
          display_order?: number | null
          id?: string
          menu_item_id?: string
          price?: number
          size_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_sizes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          max_selection: number
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          max_selection?: number
          name: string
          type: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          max_selection?: number
          name?: string
          type?: string
        }
        Relationships: []
      }
      option_items: {
        Row: {
          created_at: string | null
          display_order: number | null
          group_id: string
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          group_id: string
          id?: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          group_id?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_options: {
        Row: {
          created_at: string | null
          id: string
          option_item_id: string | null
          option_name: string
          option_price: number
          order_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_item_id?: string | null
          option_name: string
          option_price?: number
          order_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_item_id?: string | null
          option_name?: string
          option_price?: number
          order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_option_item_id_fkey"
            columns: ["option_item_id"]
            isOneToOne: false
            referencedRelation: "option_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          note: string | null
          order_id: string
          qty: number
          size: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          note?: string | null
          order_id: string
          qty: number
          size?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          note?: string | null
          order_id?: string
          qty?: number
          size?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_ratings: {
        Row: {
          comment: string | null
          created_at: string
          dismissed: boolean
          id: string
          order_id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          order_id: string
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          order_id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          address: string | null
          address_id: string | null
          admin_notified_late: boolean | null
          arrival_at: string | null
          assigned_livreur_id: string | null
          assignment_expires_at: string | null
          city: string | null
          created_at: string
          customer_name: string
          delivered_at: string | null
          delivering_at: string | null
          distance_km: number | null
          estimated_delivery_at: string | null
          estimated_ready_at: string | null
          expires_at: string
          id: string
          lat: number | null
          late_notification_sent: boolean | null
          lng: number | null
          pending_assignment: boolean
          phone: string
          ready_at: string | null
          refusal_reason: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          tried_livreur_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          address?: string | null
          address_id?: string | null
          admin_notified_late?: boolean | null
          arrival_at?: string | null
          assigned_livreur_id?: string | null
          assignment_expires_at?: string | null
          city?: string | null
          created_at?: string
          customer_name: string
          delivered_at?: string | null
          delivering_at?: string | null
          distance_km?: number | null
          estimated_delivery_at?: string | null
          estimated_ready_at?: string | null
          expires_at: string
          id?: string
          lat?: number | null
          late_notification_sent?: boolean | null
          lng?: number | null
          pending_assignment?: boolean
          phone: string
          ready_at?: string | null
          refusal_reason?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          tried_livreur_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          address?: string | null
          address_id?: string | null
          admin_notified_late?: boolean | null
          arrival_at?: string | null
          assigned_livreur_id?: string | null
          assignment_expires_at?: string | null
          city?: string | null
          created_at?: string
          customer_name?: string
          delivered_at?: string | null
          delivering_at?: string | null
          distance_km?: number | null
          estimated_delivery_at?: string | null
          estimated_ready_at?: string | null
          expires_at?: string
          id?: string
          lat?: number | null
          late_notification_sent?: boolean | null
          lng?: number | null
          pending_assignment?: boolean
          phone?: string
          ready_at?: string | null
          refusal_reason?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tried_livreur_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_assigned_livreur_id_fkey"
            columns: ["assigned_livreur_id"]
            isOneToOne: false
            referencedRelation: "livreur_stats"
            referencedColumns: ["livreur_id"]
          },
          {
            foreignKeyName: "orders_assigned_livreur_id_fkey"
            columns: ["assigned_livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          lat: number | null
          lng: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          role: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          role: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      livreur_stats: {
        Row: {
          is_active: boolean | null
          livraisons_en_cours: number | null
          livreur_id: string | null
          nom: string | null
          telephone: string | null
          total_livraisons: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_order_filters: { Args: never; Returns: Json }
      admin_process_assignments: { Args: never; Returns: undefined }
      can_access_order_chat: { Args: { _order_id: string }; Returns: boolean }
      check_late_orders: { Args: never; Returns: undefined }
      create_order_secure: {
        Args: {
          p_address_id: string
          p_items: Json
          p_promo_code: string
          p_special_instructions: string
        }
        Returns: string
      }
      expire_stale_orders: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      internal_secret: { Args: { _key: string }; Returns: string }
      livreur_update_order_status: {
        Args: { p_new_status: string; p_order_id: string }
        Returns: undefined
      }
      notify_late_deliveries: { Args: never; Returns: undefined }
      process_delivery_assignments: { Args: never; Returns: undefined }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_role: string
        }
        Returns: undefined
      }
      shares_active_delivery: {
        Args: { _profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "admin" | "livreur"
      order_status:
        | "pending"
        | "accepted"
        | "refused"
        | "expired"
        | "ready"
        | "cancelled"
        | "delivering"
        | "delivered"
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
      app_role: ["client", "admin", "livreur"],
      order_status: [
        "pending",
        "accepted",
        "refused",
        "expired",
        "ready",
        "cancelled",
        "delivering",
        "delivered",
      ],
    },
  },
} as const
