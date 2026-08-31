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
      ai_requests: {
        Row: {
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      arena_entries: {
        Row: {
          color: string
          craft: number
          created_at: string
          creativity: number
          description: string
          garment: string
          id: string
          is_hidden: boolean
          score: number
          topic_fit: number
          topic_id: string
          user_id: string
          verdict: string
        }
        Insert: {
          color: string
          craft: number
          created_at?: string
          creativity: number
          description: string
          garment: string
          id?: string
          is_hidden?: boolean
          score: number
          topic_fit: number
          topic_id: string
          user_id: string
          verdict?: string
        }
        Update: {
          color?: string
          craft?: number
          created_at?: string
          creativity?: number
          description?: string
          garment?: string
          id?: string
          is_hidden?: boolean
          score?: number
          topic_fit?: number
          topic_id?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_entries_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "arena_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_topic_votes: {
        Row: {
          created_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_topic_votes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "arena_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_topics: {
        Row: {
          author_id: string
          created_at: string
          id: string
          is_hidden: boolean
          text: string
          votes_count: number
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          text: string
          votes_count?: number
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          text?: string
          votes_count?: number
        }
        Relationships: []
      }
      battle_room_members: {
        Row: {
          color: string | null
          decal_transform: Json | null
          decal_url: string | null
          garment: string | null
          joined_at: string
          level: number
          placement: number | null
          rank_points_delta: number | null
          room_id: string
          score: number | null
          submitted: boolean
          user_id: string
          username: string
        }
        Insert: {
          color?: string | null
          decal_transform?: Json | null
          decal_url?: string | null
          garment?: string | null
          joined_at?: string
          level?: number
          placement?: number | null
          rank_points_delta?: number | null
          room_id: string
          score?: number | null
          submitted?: boolean
          user_id: string
          username: string
        }
        Update: {
          color?: string | null
          decal_transform?: Json | null
          decal_url?: string | null
          garment?: string | null
          joined_at?: string
          level?: number
          placement?: number | null
          rank_points_delta?: number | null
          room_id?: string
          score?: number | null
          submitted?: boolean
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "battle_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_rooms: {
        Row: {
          countdown_ends_at: string | null
          created_at: string
          designing_ends_at: string | null
          garment: string
          id: string
          max_players: number
          status: string
          topic: string
        }
        Insert: {
          countdown_ends_at?: string | null
          created_at?: string
          designing_ends_at?: string | null
          garment?: string
          id?: string
          max_players?: number
          status?: string
          topic: string
        }
        Update: {
          countdown_ends_at?: string | null
          created_at?: string
          designing_ends_at?: string | null
          garment?: string
          id?: string
          max_players?: number
          status?: string
          topic?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          color: string
          created_at: string
          decal_transform: Json | null
          decal_transform_back: Json | null
          decal_url: string | null
          decal_url_back: string | null
          fingerprint: string
          for_sale: boolean
          garment: string
          id: string
          is_hidden: boolean
          price_cents: number | null
          size: string
          title: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          decal_transform?: Json | null
          decal_transform_back?: Json | null
          decal_url?: string | null
          decal_url_back?: string | null
          fingerprint: string
          for_sale?: boolean
          garment: string
          id?: string
          is_hidden?: boolean
          price_cents?: number | null
          size: string
          title?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          decal_transform?: Json | null
          decal_transform_back?: Json | null
          decal_url?: string | null
          decal_url_back?: string | null
          fingerprint?: string
          for_sale?: boolean
          garment?: string
          id?: string
          is_hidden?: boolean
          price_cents?: number | null
          size?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          application_fee_cents: number
          buyer_id: string
          created_at: string
          design_id: string
          id: string
          price_cents: number
          seller_id: string
          seller_stripe_account_id: string | null
          shipping_address_line: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_full_name: string | null
          shipping_phone: string | null
          shipping_postal_code: string | null
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          application_fee_cents?: number
          buyer_id: string
          created_at?: string
          design_id: string
          id?: string
          price_cents: number
          seller_id: string
          seller_stripe_account_id?: string | null
          shipping_address_line?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_full_name?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          application_fee_cents?: number
          buyer_id?: string
          created_at?: string
          design_id?: string
          id?: string
          price_cents?: number
          seller_id?: string
          seller_stripe_account_id?: string | null
          shipping_address_line?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_full_name?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_requests: {
        Row: {
          chest_cm: number | null
          city: string | null
          country: string | null
          created_at: string
          design_id: string
          district: string | null
          fabric_preference: string | null
          first_name: string | null
          garment_size: string | null
          height_cm: number | null
          id: string
          landmark: string | null
          last_name: string | null
          note: string
          phone: string | null
          postal_code: string | null
          status: string
          street_address: string | null
          user_id: string
        }
        Insert: {
          chest_cm?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          design_id: string
          district?: string | null
          fabric_preference?: string | null
          first_name?: string | null
          garment_size?: string | null
          height_cm?: number | null
          id?: string
          landmark?: string | null
          last_name?: string | null
          note?: string
          phone?: string | null
          postal_code?: string | null
          status?: string
          street_address?: string | null
          user_id: string
        }
        Update: {
          chest_cm?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          design_id?: string
          district?: string | null
          fabric_preference?: string | null
          first_name?: string | null
          garment_size?: string | null
          height_cm?: number | null
          id?: string
          landmark?: string | null
          last_name?: string | null
          note?: string
          phone?: string | null
          postal_code?: string | null
          status?: string
          street_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_requests_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_reason: string | null
          bio: string
          coins: number
          completed_missions: string[]
          created_at: string
          id: string
          is_admin: boolean
          is_banned: boolean
          is_private: boolean
          lang: string
          level: number
          missions: number
          score: number
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_payouts_enabled: boolean
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_renews_at: string | null
          subscription_source: string | null
          subscription_tier: string
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          banned_reason?: string | null
          bio?: string
          coins?: number
          completed_missions?: string[]
          created_at?: string
          id: string
          is_admin?: boolean
          is_banned?: boolean
          is_private?: boolean
          lang?: string
          level?: number
          missions?: number
          score?: number
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_payouts_enabled?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_renews_at?: string | null
          subscription_source?: string | null
          subscription_tier?: string
          updated_at?: string
          username?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          banned_reason?: string | null
          bio?: string
          coins?: number
          completed_missions?: string[]
          created_at?: string
          id?: string
          is_admin?: boolean
          is_banned?: boolean
          is_private?: boolean
          lang?: string
          level?: number
          missions?: number
          score?: number
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_payouts_enabled?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_renews_at?: string | null
          subscription_source?: string | null
          subscription_tier?: string
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          banner_from: string
          banner_to: string
          created_at: string
          shop_name: string
          tagline: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banner_from?: string
          banner_to?: string
          created_at?: string
          shop_name: string
          tagline?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banner_from?: string
          banner_to?: string
          created_at?: string
          shop_name?: string
          tagline?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      short_likes: {
        Row: {
          created_at: string
          short_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          short_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          short_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_likes_short_id_fkey"
            columns: ["short_id"]
            isOneToOne: false
            referencedRelation: "shorts"
            referencedColumns: ["id"]
          },
        ]
      }
      shorts: {
        Row: {
          caption: string
          created_at: string
          garment: string | null
          id: string
          likes_count: number
          user_id: string
          username: string
          video_url: string
        }
        Insert: {
          caption?: string
          created_at?: string
          garment?: string | null
          id?: string
          likes_count?: number
          user_id: string
          username: string
          video_url: string
        }
        Update: {
          caption?: string
          created_at?: string
          garment?: string | null
          id?: string
          likes_count?: number
          user_id?: string
          username?: string
          video_url?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_log_ai_request: {
        Args: {
          p_kind: string
          p_max_per_window: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      prune_old_ai_requests: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
