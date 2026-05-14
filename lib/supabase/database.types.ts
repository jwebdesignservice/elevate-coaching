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
      category_change_requests: {
        Row: {
          created_at: string
          current_category: Database["public"]["Enums"]["user_category"] | null
          id: string
          reason: string | null
          requested_category: Database["public"]["Enums"]["user_category"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          current_category?: Database["public"]["Enums"]["user_category"] | null
          id?: string
          reason?: string | null
          requested_category: Database["public"]["Enums"]["user_category"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          current_category?: Database["public"]["Enums"]["user_category"] | null
          id?: string
          reason?: string | null
          requested_category?: Database["public"]["Enums"]["user_category"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_change_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_change_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          order_index: number
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
          week_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          order_index?: number
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
          week_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          order_index?: number
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "task_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          id: string
          muscle_groups: string[]
          tags: string[]
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          muscle_groups?: string[]
          tags?: string[]
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          muscle_groups?: string[]
          tags?: string[]
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          category: Database["public"]["Enums"]["user_category"] | null
          created_at: string
          email: string
          experience_level: string | null
          id: string
          max_lift_bench: number | null
          max_lift_deadlift: number | null
          max_lift_ohp: number | null
          max_lift_squat: number | null
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at_period_end: boolean
          subscription_period_end: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["user_category"] | null
          created_at?: string
          email: string
          experience_level?: string | null
          id: string
          max_lift_bench?: number | null
          max_lift_deadlift?: number | null
          max_lift_ohp?: number | null
          max_lift_squat?: number | null
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean
          subscription_period_end?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["user_category"] | null
          created_at?: string
          email?: string
          experience_level?: string | null
          id?: string
          max_lift_bench?: number | null
          max_lift_deadlift?: number | null
          max_lift_ohp?: number | null
          max_lift_squat?: number | null
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean
          subscription_period_end?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      program_sessions: {
        Row: {
          completion_rule: string | null
          estimated_duration_mins: number | null
          id: string
          instructions: string | null
          session_number: number
          title: string
          week_id: string
        }
        Insert: {
          completion_rule?: string | null
          estimated_duration_mins?: number | null
          id?: string
          instructions?: string | null
          session_number: number
          title: string
          week_id: string
        }
        Update: {
          completion_rule?: string | null
          estimated_duration_mins?: number | null
          id?: string
          instructions?: string | null
          session_number?: number
          title?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      program_weeks: {
        Row: {
          description: string | null
          id: string
          program_id: string
          title: string
          week_number: number
        }
        Insert: {
          description?: string | null
          id?: string
          program_id: string
          title: string
          week_number: number
        }
        Update: {
          description?: string | null
          id?: string
          program_id?: string
          title?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          category: Database["public"]["Enums"]["user_category"] | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          plan_access: Database["public"]["Enums"]["subscription_tier"]
          status: string
          title: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["user_category"] | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          plan_access?: Database["public"]["Enums"]["subscription_tier"]
          status?: string
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["user_category"] | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          plan_access?: Database["public"]["Enums"]["subscription_tier"]
          status?: string
          title?: string
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          date: string
          id: string
          metric_type: string
          related_program_id: string | null
          related_session_id: string | null
          user_id: string
          value: number
        }
        Insert: {
          date?: string
          id?: string
          metric_type: string
          related_program_id?: string | null
          related_session_id?: string | null
          user_id: string
          value?: number
        }
        Update: {
          date?: string
          id?: string
          metric_type?: string
          related_program_id?: string | null
          related_session_id?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_related_program_id_fkey"
            columns: ["related_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_logs_related_session_id_fkey"
            columns: ["related_session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          exercise_id: string
          id: string
          lift_key: string | null
          notes: string | null
          order_index: number
          pct_of_1rm: number | null
          reps: string | null
          rest_seconds: number | null
          session_id: string
          sets: number | null
          tutorial_id: string | null
          weight: string | null
        }
        Insert: {
          exercise_id: string
          id?: string
          lift_key?: string | null
          notes?: string | null
          order_index?: number
          pct_of_1rm?: number | null
          reps?: string | null
          rest_seconds?: number | null
          session_id: string
          sets?: number | null
          tutorial_id?: string | null
          weight?: string | null
        }
        Update: {
          exercise_id?: string
          id?: string
          lift_key?: string | null
          notes?: string | null
          order_index?: number
          pct_of_1rm?: number | null
          reps?: string | null
          rest_seconds?: number | null
          session_id?: string
          sets?: number | null
          tutorial_id?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_weeks: {
        Row: {
          category: Database["public"]["Enums"]["user_category"]
          created_at: string
          id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["user_category"]
          created_at?: string
          id?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["user_category"]
          created_at?: string
          id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_exercise_records: {
        Row: {
          exercise_id: string
          five_rm_kg: number | null
          id: string
          one_rm_kg: number | null
          twelve_rm_kg: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          five_rm_kg?: number | null
          id?: string
          one_rm_kg?: number | null
          twelve_rm_kg?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          exercise_id?: string
          five_rm_kg?: number | null
          id?: string
          one_rm_kg?: number | null
          twelve_rm_kg?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_enrollments: {
        Row: {
          current_week_number: number
          enrolled_at: string
          id: string
          last_session_id: string | null
          program_id: string
          user_id: string
        }
        Insert: {
          current_week_number?: number
          enrolled_at?: string
          id?: string
          last_session_id?: string | null
          program_id: string
          user_id: string
        }
        Update: {
          current_week_number?: number
          enrolled_at?: string
          id?: string
          last_session_id?: string | null
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_enrollments_last_session_id_fkey"
            columns: ["last_session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_session_completions: {
        Row: {
          completed_at: string
          id: string
          program_id: string
          session_id: string
          user_id: string
          week_number: number
        }
        Insert: {
          completed_at?: string
          id?: string
          program_id: string
          session_id: string
          user_id: string
          week_number: number
        }
        Update: {
          completed_at?: string
          id?: string
          program_id?: string
          session_id?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_session_completions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_session_completions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_session_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_completions: {
        Row: {
          completed_at: string
          completion_date: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completion_date: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          completion_date?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_task_rollup: {
        Args: {
          cat: Database["public"]["Enums"]["user_category"]
          from_date: string
          to_date: string
          uid: string
        }
        Returns: {
          date: string
          done: number
          total: number
        }[]
      }
      is_coach: { Args: never; Returns: boolean }
    }
    Enums: {
      change_request_status: "pending" | "approved" | "denied"
      subscription_tier: "free" | "basic" | "pro"
      task_type:
        | "workout"
        | "nutrition"
        | "mindset"
        | "recovery"
        | "steps"
        | "other"
      user_category: "A" | "B" | "C" | "D"
      user_role: "user" | "coach"
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
      change_request_status: ["pending", "approved", "denied"],
      subscription_tier: ["free", "basic", "pro"],
      task_type: [
        "workout",
        "nutrition",
        "mindset",
        "recovery",
        "steps",
        "other",
      ],
      user_category: ["A", "B", "C", "D"],
      user_role: ["user", "coach"],
    },
  },
} as const
