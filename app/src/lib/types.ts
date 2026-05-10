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

// Two-step workflow (operator → admin → НПГМ).
// 'new' and 'delivered' are kept for backward compatibility with rows
// created before migration 0023 — UI maps them to 'submitted' / 'received'
// for display, but new code should not produce them.
export type PartsRequestStatus =
  | 'submitted'   // operator submitted, waiting for company_admin
  | 'forwarded'   // company_admin forwarded to НПГМ (Tier 2)
  | 'quoted'      // Tier 2 sent quote
  | 'approved'    // company_admin accepted the quote
  | 'ordered'     // Tier 2 placed the order with a supplier (has ETA)
  | 'received'    // delivered to the customer + photo confirmation
  | 'cancelled'
  // Legacy (pre-migration 0023):
  | 'new'
  | 'delivered';

export type PartsRequestUrgency = 'normal' | 'urgent' | 'critical';

export type ShiftStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

export type ChargingRecipe = 'ANFO' | 'EMULSION' | 'BLEND_70_30' | 'BLEND_30_70' | 'OTHER';

export type ChecklistKind = 'pre_shift' | 'monthly' | 'weekly' | 'maintenance';

export type ChecklistItemSeverity = 'critical' | 'normal';

export interface ChecklistItem {
  id: string;
  name_ru: string;
  name_en?: string;
  severity: ChecklistItemSeverity;
}

export type ChecklistAnswerStatus = 'pass' | 'fail' | 'skip'; // 'skip' kept for legacy rows; UI no longer offers it

export interface ChecklistAnswer {
  item_id: string;
  status: ChecklistAnswerStatus;
  photo_url?: string | null;
  comment?: string | null;
}

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
          last_monthly_check_at: string | null;
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
          is_custom: boolean;
          created_by_company_id: string | null;
          image_url: string | null;
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
          is_custom?: boolean;
          created_by_company_id?: string | null;
          image_url?: string | null;
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
          is_custom?: boolean;
          created_by_company_id?: string | null;
          image_url?: string | null;
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
          image_url: string | null;
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
          image_url?: string | null;
        };
        Update: {
          machine_id?: string | null;
          quantity?: number;
          reorder_threshold?: number | null;
          last_replenished_at?: string | null;
          notes?: string | null;
          image_url?: string | null;
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
      parts_requests: {
        Row: {
          id: string;
          company_id: string;
          machine_id: string | null;
          status: PartsRequestStatus;
          urgency: PartsRequestUrgency;
          parts_requested: MaintenanceBomItem[];
          parts_freeform: MaintenanceFreeformItem[];
          notes: string | null;
          requested_by: string | null;
          submitted_at: string | null;
          forwarded_at: string | null;
          forwarded_by: string | null;
          quoted_at: string | null;
          quoted_by: string | null;
          quote_notes: string | null;
          quote_total_amount: number | null;
          quote_currency: string | null;
          approved_at: string | null;
          approved_by: string | null;
          ordered_at: string | null;
          ordered_by: string | null;
          expected_delivery_date: string | null;
          received_at: string | null;
          received_by: string | null;
          received_quantity_text: string | null;
          received_photo_url: string | null;
          received_notes: string | null;
          cancel_reason: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          machine_id?: string | null;
          status?: PartsRequestStatus;
          urgency?: PartsRequestUrgency;
          parts_requested?: MaintenanceBomItem[];
          parts_freeform?: MaintenanceFreeformItem[];
          notes?: string | null;
          requested_by?: string | null;
          submitted_at?: string | null;
        };
        Update: {
          status?: PartsRequestStatus;
          urgency?: PartsRequestUrgency;
          parts_requested?: MaintenanceBomItem[];
          parts_freeform?: MaintenanceFreeformItem[];
          notes?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'parts_requests_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'parts_requests_machine_id_fkey'; columns: ['machine_id']; referencedRelation: 'machines'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      checklist_templates: {
        Row: {
          id: string;
          machine_type: string;
          kind: ChecklistKind;
          items: ChecklistItem[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          machine_type: string;
          kind?: ChecklistKind;
          items?: ChecklistItem[];
          notes?: string | null;
        };
        Update: {
          machine_type?: string;
          kind?: ChecklistKind;
          items?: ChecklistItem[];
          notes?: string | null;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      shifts: {
        Row: {
          id: string;
          company_id: string;
          machine_id: string;
          operator_id: string;
          status: ShiftStatus;
          planned_for: string | null;
          started_at: string | null;
          completed_at: string | null;
          plan_recipe: ChargingRecipe | null;
          plan_tons: number | null;
          plan_emulsion_tons: number | null;
          plan_an_tons: number | null;
          plan_diesel_tons: number | null;
          plan_holes: number | null;
          plan_pit_location: string | null;
          plan_notes: string | null;
          actual_tons: number | null;
          actual_emulsion_tons: number | null;
          actual_an_tons: number | null;
          actual_diesel_tons: number | null;
          actual_engine_hours: number | null;
          actual_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          machine_id: string;
          operator_id: string;
          status?: ShiftStatus;
          planned_for?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          plan_recipe?: ChargingRecipe | null;
          plan_tons?: number | null;
          plan_emulsion_tons?: number | null;
          plan_an_tons?: number | null;
          plan_diesel_tons?: number | null;
          plan_holes?: number | null;
          plan_pit_location?: string | null;
          plan_notes?: string | null;
          actual_tons?: number | null;
          actual_emulsion_tons?: number | null;
          actual_an_tons?: number | null;
          actual_diesel_tons?: number | null;
          actual_engine_hours?: number | null;
          actual_notes?: string | null;
        };
        Update: {
          status?: ShiftStatus;
          started_at?: string | null;
          completed_at?: string | null;
          plan_recipe?: ChargingRecipe | null;
          plan_tons?: number | null;
          plan_emulsion_tons?: number | null;
          plan_an_tons?: number | null;
          plan_diesel_tons?: number | null;
          plan_holes?: number | null;
          plan_pit_location?: string | null;
          plan_notes?: string | null;
          actual_tons?: number | null;
          actual_emulsion_tons?: number | null;
          actual_an_tons?: number | null;
          actual_diesel_tons?: number | null;
          actual_engine_hours?: number | null;
          actual_notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'shifts_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'shifts_machine_id_fkey'; columns: ['machine_id']; referencedRelation: 'machines'; referencedColumns: ['id'] },
          { foreignKeyName: 'shifts_operator_id_fkey'; columns: ['operator_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };

      // ----------------------------------------------------------------
      checklist_executions: {
        Row: {
          id: string;
          shift_id: string;
          template_id: string;
          items_snapshot: ChecklistItem[];
          items_status: ChecklistAnswer[];
          has_critical_fail: boolean;
          notes: string | null;
          performed_by: string | null;
          completed_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          template_id: string;
          items_snapshot: ChecklistItem[];
          items_status?: ChecklistAnswer[];
          has_critical_fail?: boolean;
          notes?: string | null;
          performed_by?: string | null;
        };
        Update: {
          items_status?: ChecklistAnswer[];
          has_critical_fail?: boolean;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'checklist_executions_shift_id_fkey'; columns: ['shift_id']; referencedRelation: 'shifts'; referencedColumns: ['id'] },
          { foreignKeyName: 'checklist_executions_template_id_fkey'; columns: ['template_id']; referencedRelation: 'checklist_templates'; referencedColumns: ['id'] }
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

      // ----------------------------------------------------------------
      invites: {
        Row: {
          id: string;
          token: string;
          company_id: string;
          role: UserRole;
          email: string | null;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          cancel_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          company_id: string;
          role: UserRole;
          email?: string | null;
          invited_by?: string | null;
          expires_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          cancel_reason?: string | null;
          expires_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'invites_company_id_fkey'; columns: ['company_id']; referencedRelation: 'companies'; referencedColumns: ['id'] },
          { foreignKeyName: 'invites_invited_by_fkey'; columns: ['invited_by']; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'invites_accepted_by_fkey'; columns: ['accepted_by']; referencedRelation: 'profiles'; referencedColumns: ['id'] }
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
      parts_request_status: PartsRequestStatus;
      parts_request_urgency: PartsRequestUrgency;
      shift_status: ShiftStatus;
      charging_recipe: ChargingRecipe;
      checklist_kind: ChecklistKind;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
