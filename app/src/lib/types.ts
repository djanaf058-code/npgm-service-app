// Database types for the NPGM Service App schema.
//
// This is a hand-curated subset matching the migrations in db/migrations/.
// Long-term: regenerate via `supabase gen types typescript --project-id <ref>`
// once we have the Supabase CLI hooked up. For now, we maintain this manually
// because we don't yet have CLI auth and the schema is small.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | 'operator'
  | 'service_engineer'
  | 'project_manager'
  | 'company_admin'
  | 'tier2_engineer'
  | 'platform_admin';

export type AugerPosition = 'upper' | 'lower' | 'none';

export type MachineStatus = 'active' | 'maintenance' | 'decommissioned';

export type GgdType = 'SN' | 'acetic_acid' | null;

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12.2.3';
  };

  public: {
    Tables: {
      // ----------------------------------------------------------------
      companies: {
        Row: {
          id: string;
          name: string;
          country: string;
          language: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country: string;
          language?: string;
          timezone?: string;
        };
        Update: {
          name?: string;
          country?: string;
          language?: string;
          timezone?: string;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      profiles: {
        Row: {
          id: string;
          company_id: string | null;
          full_name: string;
          role: UserRole;
          language: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          full_name: string;
          role?: UserRole;
          language?: string;
          phone?: string | null;
        };
        Update: {
          company_id?: string | null;
          full_name?: string;
          role?: UserRole;
          language?: string;
          phone?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'profiles_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      machine_types: {
        Row: {
          id: string;
          name_ru: string;
          name_en: string;
          description: string | null;
          recipe_modes: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          name_ru: string;
          name_en: string;
          description?: string | null;
          recipe_modes: string[];
        };
        Update: {
          name_ru?: string;
          name_en?: string;
          description?: string | null;
          recipe_modes?: string[];
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      machines: {
        Row: {
          id: string;
          company_id: string;
          machine_type: string;
          model_code: string;
          tonnage_t: number;
          auger_position: AugerPosition;
          has_drum: boolean;
          component_count: number;
          ggd_type: GgdType;
          serial_number: string | null;
          in_service_since: string | null;
          pit_location: string | null;
          engine_hours: number;
          tons_pumped: number;
          status: MachineStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          machine_type: string;
          model_code: string;
          tonnage_t: number;
          auger_position?: AugerPosition;
          has_drum?: boolean;
          component_count?: number;
          ggd_type?: GgdType;
          serial_number?: string | null;
          in_service_since?: string | null;
          pit_location?: string | null;
          engine_hours?: number;
          tons_pumped?: number;
          status?: MachineStatus;
          notes?: string | null;
        };
        Update: {
          machine_type?: string;
          model_code?: string;
          tonnage_t?: number;
          auger_position?: AugerPosition;
          has_drum?: boolean;
          component_count?: number;
          ggd_type?: GgdType;
          serial_number?: string | null;
          in_service_since?: string | null;
          pit_location?: string | null;
          engine_hours?: number;
          tons_pumped?: number;
          status?: MachineStatus;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'machines_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'machines_machine_type_fkey'; columns: ['machine_type']; referencedRelation: 'machine_types'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      machine_assignments: {
        Row: {
          machine_id: string;
          operator_id: string;
          assigned_at: string;
          unassigned_at: string | null;
        };
        Insert: {
          machine_id: string;
          operator_id: string;
          assigned_at?: string;
          unassigned_at?: string | null;
        };
        Update: {
          unassigned_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'machine_assignments_machine_id_fkey'; columns: ['machine_id']; referencedRelation: 'machines'; referencedColumns: ['id'] },
          { foreignKeyName: 'machine_assignments_operator_id_fkey'; columns: ['operator_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      user_company_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      user_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };

    Enums: {
      user_role: UserRole;
      auger_position: AugerPosition;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
