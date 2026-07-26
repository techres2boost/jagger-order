export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      order_items: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          note: string | null;
          order_id: string;
          qty: number;
          size: string | null;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          note?: string | null;
          order_id: string;
          qty: number;
          size?: string | null;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          note?: string | null;
          order_id?: string;
          qty?: number;
          size?: string | null;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          customer_name: string;
          expires_at: string;
          id: string;
          phone: string;
          status: Database["public"]["Enums"]["order_status"];
          total: number;
          updated_at: string;
          user_id: string;
          distance_km: number | null;
          accepted_at: string | null;
          ready_at: string | null;
          delivering_at: string | null;
          delivered_at: string | null;
          estimated_ready_at: string | null;
          estimated_delivery_at: string | null;
          arrival_at: string | null;
          assigned_livreur_id: string | null;
        };
        Insert: {
          created_at?: string;
          customer_name: string;
          expires_at: string;
          id?: string;
          phone: string;
          status?: Database["public"]["Enums"]["order_status"];
          total: number;
          updated_at?: string;
          user_id: string;
          distance_km?: number | null;
          accepted_at?: string | null;
          ready_at?: string | null;
          delivering_at?: string | null;
          delivered_at?: string | null;
          estimated_ready_at?: string | null;
          estimated_delivery_at?: string | null;
          arrival_at?: string | null;
          assigned_livreur_id?: string | null;
        };
        Update: {
          created_at?: string;
          customer_name?: string;
          expires_at?: string;
          id?: string;
          phone?: string;
          status?: Database["public"]["Enums"]["order_status"];
          total?: number;
          updated_at?: string;
          user_id?: string;
          distance_km?: number | null;
          accepted_at?: string | null;
          ready_at?: string | null;
          delivering_at?: string | null;
          delivered_at?: string | null;
          estimated_ready_at?: string | null;
          estimated_delivery_at?: string | null;
          arrival_at?: string | null;
          assigned_livreur_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_assigned_livreur_id_fkey";
            columns: ["assigned_livreur_id"];
            isOneToOne: false;
            referencedRelation: "livreurs";
            referencedColumns: ["id"];
          },
        ];
      };
      livreurs: {
        Row: {
          id: string;
          user_id: string | null;
          nom: string;
          telephone: string;
          email: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          nom: string;
          telephone: string;
          email: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          nom?: string;
          telephone?: string;
          email?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      order_ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          dismissed: boolean;
          id: string;
          order_id: string;
          rating: number;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          dismissed?: boolean;
          id?: string;
          order_id: string;
          rating: number;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          dismissed?: boolean;
          id?: string;
          order_id?: string;
          rating?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_ratings_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      livreur_ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          dismissed: boolean;
          id: string;
          livreur_id: string | null;
          order_id: string;
          rating: number | null;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          dismissed?: boolean;
          id?: string;
          livreur_id?: string | null;
          order_id: string;
          rating?: number | null;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          dismissed?: boolean;
          id?: string;
          livreur_id?: string | null;
          order_id?: string;
          rating?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "livreur_ratings_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "livreur_ratings_livreur_id_fkey";
            columns: ["livreur_id"];
            isOneToOne: false;
            referencedRelation: "livreurs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          color: string | null;
          is_available: boolean;
          is_featured: boolean;
          display_order: number;
          price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          color?: string | null;
          is_available?: boolean;
          is_featured?: boolean;
          display_order?: number;
          price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          color?: string | null;
          is_available?: boolean;
          is_featured?: boolean;
          display_order?: number;
          price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_sizes: {
        Row: {
          id: string;
          menu_item_id: string;
          size_label: string;
          price: number;
          display_order: number;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          size_label: string;
          price: number;
          display_order?: number;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          size_label?: string;
          price?: number;
          display_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_sizes_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      option_groups: {
        Row: {
          id: string;
          name: string;
          type: "retirable" | "supplement";
          max_selection: number;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: "retirable" | "supplement";
          max_selection?: number;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: "retirable" | "supplement";
          max_selection?: number;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      option_items: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          price: number;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          price?: number;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          price?: number;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "option_items_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_option_groups: {
        Row: {
          menu_item_id: string;
          option_group_id: string;
          display_order: number;
        };
        Insert: {
          menu_item_id: string;
          option_group_id: string;
          display_order?: number;
        };
        Update: {
          menu_item_id?: string;
          option_group_id?: string;
          display_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_option_groups_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_item_option_groups_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_options: {
        Row: {
          id: string;
          order_item_id: string;
          option_item_id: string | null;
          option_name: string;
          option_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          option_item_id?: string | null;
          option_name: string;
          option_price?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_item_id?: string;
          option_item_id?: string | null;
          option_name?: string;
          option_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_options_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      livreur_stats: {
        Row: {
          livreur_id: string;
          nom: string;
          telephone: string;
          is_active: boolean;
          total_livraisons: number;
          livraisons_en_cours: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      expire_stale_orders: { Args: never; Returns: undefined };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "client" | "admin" | "livreur";
      order_status:
        | "pending"
        | "accepted"
        | "refused"
        | "expired"
        | "ready"
        | "delivering"
        | "delivered"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
        "delivering",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const;
