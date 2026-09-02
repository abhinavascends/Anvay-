export type UserRole =
  | "CITIZEN"
  | "OPERATOR"
  | "FIELD_TEAM"
  | "SHELTER_MANAGER"
  | "ADMIN";

export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentType =
  | "FLOOD"
  | "FIRE"
  | "LANDSLIDE"
  | "STRUCTURAL_COLLAPSE"
  | "MEDICAL_EMERGENCY"
  | "EARTHQUAKE"
  | "CYCLONE"
  | "OTHER";
export type IncidentStatus =
  | "REPORTED"
  | "VALIDATED"
  | "UNASSIGNED"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "RESOLVED"
  | "ESCALATED"
  | "CANCELLED";
export type VerificationStatus =
  | "UNVERIFIED"
  | "CORROBORATED"
  | "CONFIRMED"
  | "REJECTED";
export type AlertType =
  | "RAINFALL"
  | "FLOOD"
  | "CYCLONE"
  | "THUNDERSTORM"
  | "HEATWAVE"
  | "EARTHQUAKE"
  | "TSUNAMI"
  | "LANDSLIDE"
  | "OTHER";

export type ReportSource = "APP" | "SMS" | "IVR" | "OFFICIAL" | "MANUAL";
export type ResourceStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "RETURNING"
  | "UNAVAILABLE";
export type ShelterStatus =
  | "OPEN"
  | "FILLING"
  | "NEAR_CAPACITY"
  | "FULL"
  | "CLOSED";
export type AssignmentStatus =
  | "PENDING"
  | "ACKNOWLEDGED"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "COMPLETED"
  | "INTERRUPTED"
  | "CANCELLED";
export type AlertSeverity = "EXTREME" | "SEVERE" | "MODERATE" | "MINOR";
export type AlertSource = "IMD" | "CWC" | "NDMA" | "MANUAL";
export type StockItemType =
  | "FOOD"
  | "WATER"
  | "MEDICAL"
  | "BLANKETS"
  | "CLOTHING"
  | "SANITATION"
  | "TENTS"
  | "OTHER";

export type Profile = {
  id: string;
  name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type Incident = {
  id: string;
  incident_number: string;
  reporter_id: string | null;
  cluster_id: string | null;
  severity: IncidentSeverity;
  type: IncidentType;
  status: IncidentStatus;
  description: string;
  latitude: number;
  longitude: number;
  location_text: string | null;
  people_affected: number;
  required_capabilities: string[];
  confidence_score: number;
  verification_status: VerificationStatus;
  source: ReportSource;
  is_simulated: boolean;
  photo_url: string | null;
  ai_classification: unknown;
  reported_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type IncidentInsert = {
  incident_number?: string;
  reporter_id?: string | null;
  cluster_id?: string | null;
  severity?: IncidentSeverity;
  type?: IncidentType;
  status?: IncidentStatus;
  description: string;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  people_affected?: number;
  required_capabilities?: string[];
  confidence_score?: number;
  verification_status?: VerificationStatus;
  source?: ReportSource;
  is_simulated?: boolean;
  photo_url?: string | null;
  resolved_at?: string | null;
  ai_classification?: unknown;
}

export type ResourceTeam = {
  id: string;
  team_code: string;
  name: string;
  status: ResourceStatus;
  latitude: number;
  longitude: number;
  base_latitude: number;
  base_longitude: number;
  capacity: number;
  capabilities: string[];
  current_assignment_id: string | null;
  managed_by_id: string | null;
  contact_phone: string | null;
  vehicle_type: string | null;
  last_status_update: string;
  created_at: string;
  updated_at: string;
}

export type Shelter = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  total_capacity: number;
  current_occupancy: number;
  status: ShelterStatus;
  managed_by_id: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export type ShelterStock = {
  id: string;
  shelter_id: string;
  item_type: StockItemType;
  quantity: number;
  max_quantity: number;
  last_updated: string;
}

export type Assignment = {
  id: string;
  incident_id: string;
  resource_id: string;
  assigned_by_id: string | null;
  status: AssignmentStatus;
  allocation_score: number | null;
  score_breakdown: Record<string, number> | null;
  explanation: string | null;
  distance_km: number | null;
  eta_minutes: number | null;
  is_manual_override: boolean;
  assigned_at: string;
  acknowledged_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type IncidentActivity = {
  id: string;
  incident_id: string;
  action_type: string;
  message: string;
  actor_type: "citizen" | "operator" | "rescue_team" | "system";
  actor_id: string | null;
  created_at: string;
}

export type AssignmentLog = {
  id: string;
  assignment_id: string;
  event_type:
    | "CREATED"
    | "ACKNOWLEDGED"
    | "STATUS_CHANGED"
    | "REASSIGNED"
    | "COMPLETED"
    | "INTERRUPTED"
    | "CANCELLED"
    | "NOTE_ADDED";
  description: string | null;
  metadata: unknown;
  created_at: string;
}

export type Alert = {
  id: string;
  alert_id: string;
  source: AlertSource;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string | null;
  affected_area: unknown;
  effective_from: string;
  effective_until: string | null;
  raw_data: unknown;
  is_active: boolean;
  created_at: string;
}

export type AllocationWeight = {
  id: string;
  name: string;
  severity_weight: number;
  eta_weight: number;
  capability_weight: number;
  availability_weight: number;
  capacity_weight: number;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        { id: string; name: string; phone?: string | null; role?: UserRole },
        { name?: string; phone?: string | null }
      >;
      incidents: Table<Incident, IncidentInsert>;
      resource_teams: Table<ResourceTeam>;
      shelters: Table<Shelter>;
      shelter_stocks: Table<ShelterStock>;
      assignments: Table<Assignment>;
      assignment_logs: Table<AssignmentLog>;
      incident_activity: Table<IncidentActivity>;
      alerts: Table<Alert>;
      allocation_weights: Table<AllocationWeight>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: { Args: { roles: UserRole[] }; Returns: boolean };
      is_authority: { Args: Record<string, never>; Returns: boolean };
      haversine_km: {
        Args: {
          lat1: number;
          lng1: number;
          lat2: number;
          lng2: number;
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      incident_severity: IncidentSeverity;
      incident_type: IncidentType;
      incident_status: IncidentStatus;
      verification_status: VerificationStatus;
      report_source: ReportSource;
      resource_status: ResourceStatus;
      shelter_status: ShelterStatus;
      assignment_status: AssignmentStatus;
      alert_severity: AlertSeverity;
      alert_source: AlertSource;
      stock_item_type: StockItemType;
    };
    CompositeTypes: Record<string, never>;
  };
};
