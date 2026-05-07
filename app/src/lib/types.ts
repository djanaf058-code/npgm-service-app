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

export type TicketStatus =
  | 'new'
  | 'tier2_responding'
  | 'awaiting_operator'
  | 'resolved'
  | 'closed_self';

export type MessageSender = 'operator' | 'service_engineer' | 'tier2';

export type PartCategory = 'filter' | 'seal' | 'sensor' | 'module' | 'pump_part' | 'consumable';

export type PartUnit = 'pcs' | 'm' | 'kg' | 'l' | 'set';

export type MaintenanceKind = 'TO' | 'TO-1' | 'TO-2' | 'annual' | 'unscheduled';

export type MaintenanceStatus =
  | 'forecast'
  | 'requested'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** BOM item embedded in maintenance_schedules.parts_required (and planned/requested in events). */
export interface MaintenanceBomItem {
  part_id: string;
  display_name_ru: string;
  display_name_en?: string;
  quantity: number;
  source?: 'schedule_default' | 'manual_freeform' | 'photo_request';
}

/** Free-form addition by operator when they don't know the part name. */
export interface MaintenanceFreeformItem {
  description: string;
  photo_url?: string | null;
  quantity_estimate?: number | null;
}

/** Single work step on a maintenance regime. */
export interface MaintenanceWorkItem {
  name_ru: string;
  name_en?: string;
  hours_norm?: number;
}

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

      // ----------------------------------------------------------------
      tickets: {
        Row: {
          id: string;
          company_id: string;
          machine_id: string | null;
          operator_id: string;
          status: TicketStatus;
          priority: number;
          title: string | null;
          resolution_summary: string | null;
          created_at: string;
          resolved_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          machine_id?: string | null;
          operator_id: string;
          status?: TicketStatus;
          priority?: number;
          title?: string | null;
          resolution_summary?: string | null;
        };
        Update: {
          machine_id?: string | null;
          status?: TicketStatus;
          priority?: number;
          title?: string | null;
          resolution_summary?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'tickets_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'tickets_machine_id_fkey'; columns: ['machine_id']; referencedRelation: 'machines'; referencedColumns: ['id'] },
          { foreignKeyName: 'tickets_operator_id_fkey'; columns: ['operator_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      parts_catalog: {
        Row: {
          id: string;
          display_name_ru: string;
          display_name_en: string | null;
          category: PartCategory;
          application_ru: string | null;
          application_en: string | null;
          manufacturer: string;
          part_number: string;
          internal_sku: string | null;
          unit: PartUnit;
          compatible_machine_types: string[];
          last_known_price_rub: number | null;
          last_known_price_usd: number | null;
          price_updated_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_name_ru: string;
          display_name_en?: string | null;
          category: PartCategory;
          application_ru?: string | null;
          application_en?: string | null;
          manufacturer?: string;
          part_number: string;
          internal_sku?: string | null;
          unit?: PartUnit;
          compatible_machine_types?: string[];
          last_known_price_rub?: number | null;
          last_known_price_usd?: number | null;
          price_updated_at?: string | null;
          notes?: string | null;
        };
        Update: {
          display_name_ru?: string;
          display_name_en?: string | null;
          category?: PartCategory;
          application_ru?: string | null;
          application_en?: string | null;
          manufacturer?: string;
          part_number?: string;
          internal_sku?: string | null;
          unit?: PartUnit;
          compatible_machine_types?: string[];
          last_known_price_rub?: number | null;
          last_known_price_usd?: number | null;
          price_updated_at?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      parts_inventory: {
        Row: {
          id: string;
          company_id: string;
          part_id: string;
          machine_id: string | null;
          quantity: number;
          reorder_threshold: number | null;
          last_replenished_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          part_id: string;
          machine_id?: string | null;
          quantity?: number;
          reorder_threshold?: number | null;
          last_replenished_at?: string | null;
          notes?: string | null;
        };
        Update: {
          machine_id?: string | null;
          quantity?: number;
          reorder_threshold?: number | null;
          last_replenished_at?: string | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'parts_inventory_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'parts_inventory_part_id_fkey'; columns: ['part_id']; referencedRelation: 'parts_catalog'; referencedColumns: ['id'] },
          { foreignKeyName: 'parts_inventory_machine_id_fkey'; columns: ['machine_id']; referencedRelation: 'machines'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      parts_usage: {
        Row: {
          id: string;
          inventory_id: string;
          ticket_id: string | null;
          maintenance_event_id: string | null;
          quantity_used: number;
          used_at: string;
          used_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          inventory_id: string;
          ticket_id?: string | null;
          maintenance_event_id?: string | null;
          quantity_used: number;
          used_by?: string | null;
          notes?: string | null;
        };
        Update: {
          quantity_used?: number;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'parts_usage_inventory_id_fkey'; columns: ['inventory_id']; referencedRelation: 'parts_inventory'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      maintenance_schedules: {
        Row: {
          id: string;
          machine_type: string;
          kind: MaintenanceKind;
          interval_tons: number;
          alternates_with: MaintenanceKind | null;
          work_items: MaintenanceWorkItem[];
          total_hours_norm: number | null;
          parts_required: MaintenanceBomItem[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          machine_type: string;
          kind: MaintenanceKind;
          interval_tons: number;
          alternates_with?: MaintenanceKind | null;
          work_items?: MaintenanceWorkItem[];
          total_hours_norm?: number | null;
          parts_required?: MaintenanceBomItem[];
          notes?: string | null;
        };
        Update: {
          interval_tons?: number;
          alternates_with?: MaintenanceKind | null;
          work_items?: MaintenanceWorkItem[];
          total_hours_norm?: number | null;
          parts_required?: MaintenanceBomItem[];
          notes?: string | null;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      maintenance_events: {
        Row: {
          id: string;
          company_id: string;
          machine_id: string;
          schedule_id: string | null;
          kind: MaintenanceKind;
          status: MaintenanceStatus;
          tons_at_creation: number | null;
          forecast_tons: number | null;
          planned_date: string | null;
          completed_at: string | null;
          parts_requested: MaintenanceBomItem[];
          parts_freeform: MaintenanceFreeformItem[];
          works_performed: MaintenanceWorkItem[] | null;
          performed_by: string | null;
          requested_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          machine_id: string;
          schedule_id?: string | null;
          kind: MaintenanceKind;
          status?: MaintenanceStatus;
          tons_at_creation?: number | null;
          forecast_tons?: number | null;
          planned_date?: string | null;
          parts_requested?: MaintenanceBomItem[];
          parts_freeform?: MaintenanceFreeformItem[];
          works_performed?: MaintenanceWorkItem[] | null;
          performed_by?: string | null;
          requested_by?: string | null;
          notes?: string | null;
        };
        Update: {
          status?: MaintenanceStatus;
          planned_date?: string | null;
          completed_at?: string | null;
          parts_requested?: MaintenanceBomItem[];
          parts_freeform?: MaintenanceFreeformItem[];
          works_performed?: MaintenanceWorkItem[] | null;
          performed_by?: string | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'maintenance_events_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'maintenance_events_machine_id_fkey'; columns: ['machine_id']; referencedRelation: 'machines'; referencedColumns: ['id'] },
          { foreignKeyName: 'maintenance_events_schedule_id_fkey'; columns: ['schedule_id']; referencedRelation: 'maintenance_schedules'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_type: MessageSender;
          sender_id: string;
          text: string | null;
          image_url: string | null;
          related_manual_chunks: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_type: MessageSender;
          sender_id: string;
          text?: string | null;
          image_url?: string | null;
          related_manual_chunks?: string[] | null;
        };
        Update: {
          text?: string | null;
          image_url?: string | null;
          related_manual_chunks?: string[] | null;
        };
        Relationships: [
          { foreignKeyName: 'ticket_messages_ticket_id_fkey'; columns: ['ticket_id']; referencedRelation: 'tickets'; referencedColumns: ['id'] },
          { foreignKeyName: 'ticket_messages_sender_id_fkey'; columns: ['sender_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
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
      ticket_status: TicketStatus;
      message_sender: MessageSender;
      maintenance_kind: MaintenanceKind;
      maintenance_status: MaintenanceStatus;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
