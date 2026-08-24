export type DisclosureCondition = 'M' | 'S' | 'V';

export type ProfileRecordId = 'A' | 'B' | 'C' | 'D';

export type StudyStepId =
  | 'launch_received'
  | 'assignment_locked'
  | 'attention_prompt_3s'
  | 'initial_media_once'
  | 'pre_q1_sufficiency'
  | 'pre_q2_protection'
  | 'pre_factual_questions'
  | 'disclosure_view'
  | 'post_factual_questions'
  | 'post_q1_sufficiency'
  | 'post_q2_protection'
  | 'findability_tasks'
  | 'requested_safeguards'
  | 'simulated_action'
  | 'burden_and_debrief'
  | 'completion_code_issued';

export type LegacyStudyStepId =
  | 'briefing'
  | 'footprint'
  | 'exposure'
  | 'concerns'
  | 'options'
  | 'decision';

export type EvidenceState =
  | 'verified'
  | 'audited'
  | 'operator-declared'
  | 'inferred'
  | 'unknown'
  | 'conflict';

export type DroneAppearance = {
  type: string;
  label: string;
  color: string;
  has_police_marking: boolean;
  has_strobe_light: boolean;
};

export type FlightCue = {
  speed: string;
  gimbal_orientation: string;
  altitude_cue: string;
  distance_m: number;
};

export type TaskBoundary = {
  supported: boolean;
  evidence_state: EvidenceState;
  note: string;
};

export type DataPracticeField = {
  field_id: string;
  label: string;
  value: string;
  evidence_state: EvidenceState;
  source: string;
  unknown_reason: string | null;
};

export type ResponsibilityInfo = {
  operator_name: string;
  responsible_role: string;
  evidence_state: EvidenceState;
  contact_channel: string;
};

export type FactualDataPayload = {
  record_id: ProfileRecordId;
  profile_name: string;
  visual_exposure: 'low' | 'high';
  task_boundaries: Record<string, TaskBoundary>;
  data_practices: Record<string, DataPracticeField>;
  responsibility: Record<string, ResponsibilityInfo>;
  active_safeguards: string[];
  notice_card?: {
    title: string;
    time: string;
    location: string;
    operator: string;
    task: string;
    registration_code: string;
    contact: string;
    note: string;
  };
};

export type FactualQuestion = {
  question_id: string;
  field_id: string;
  domain: string;
  prompt: string;
  options: string[];
  allow_unknown: boolean;
};

export type ProtectionMeasureConfig = {
  prompt: string;
  options: Array<{ value: string; label: string }>;
};

export type FindabilityTask = {
  task_id: string;
  target_field_id: string;
  instruction: string;
};

export type RequestedConditionOption = {
  id: string;
  label: string;
};

export type SimulatedActionOption = {
  id: string;
  label: string;
};

export type BurdenQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type QuestionSetConfig = {
  version?: string;
  factual_questions: FactualQuestion[];
  protection_measures: {
    q1: ProtectionMeasureConfig;
    q2: ProtectionMeasureConfig;
  };
  findability_tasks: FindabilityTask[];
  requested_conditions_catalog: RequestedConditionOption[];
  simulated_actions_catalog: SimulatedActionOption[];
  burden_questions: BurdenQuestion[];
};

export type StudySessionInfo = {
  session_id: string;
  record_id: ProfileRecordId;
  condition: DisclosureCondition;
  cell_id: string;
  record_version: string;
  record_hash: string;
  question_set_version: string;
  ui_version: string;
  current_step: StudyStepId;
  initial_media_completed: boolean;
  status: string;
  completion_code?: string | null;
  assigned_at?: string;
};

export type InitialMediaAsset = {
  title: string;
  duration_s: number;
  drone_appearance: DroneAppearance;
  flight_cue: FlightCue;
  external_view_label: string;
  resident_view_label: string;
};

export type RevealMediaAsset = {
  title: string;
  duration_s: number;
  drone_appearance: DroneAppearance;
  in_view_segments: Array<{ start_s: number; end_s: number; target_state: string }>;
  views: string[];
};

export type MaterialsPayload = {
  session_id: string;
  phase: 'pre' | 'post';
  condition: DisclosureCondition;
  record_id: ProfileRecordId;
  initial_media?: InitialMediaAsset | null;
  reveal_media?: RevealMediaAsset | null;
  factual_data?: FactualDataPayload | null;
  question_set?: QuestionSetConfig | null;
};

// ==========================================
// Legacy Types for Sandbox/Demo Isolation
// ==========================================

export type FeatureCollection = {
  type?: string;
  features: Array<{
    type?: string;
    properties?: any;
    geometry?: any;
    [key: string]: any;
  }>;
};
export type Geometry = any;
export type RouteGeometry = Geometry;

export type RoutePoint = {
  lon: number;
  lat: number;
  alt: number;
  yaw: number;
};

export type CameraConfig = {
  hfov_deg: number;
  vfov_deg: number;
  gimbal_pitch_deg: number;
  ray_width: number;
  ray_height: number;
  min_depth_m?: number;
  max_depth_m?: number;
};

export type CameraProfile = {
  id: string;
  label: string;
  description: string;
  camera: CameraConfig;
};

export type Scenario = {
  scenario_id: string;
  name: string;
  origin: { lon: number; lat: number; alt: number };
  camera: CameraConfig;
  camera_profiles: CameraProfile[];
  default_camera_profile_id: string;
  default_route: RoutePoint[];
  summary: { task: string; notice: string };
  translations?: {
    zh?: { name: string; task: string; notice: string };
  };
  buildings: any;
  semantic_layers: any;
};

export type PoseEvidence = {
  pose_index: number;
  distance_along_route_m: number;
  route_fraction: number;
  lon: number;
  lat: number;
  alt: number;
  yaw: number;
  gimbal_pitch_deg: number;
  total_exposure: number;
  sensitive_exposure: number;
  visible_surface_count: number;
  top_surface_ids: string[];
};

export type ExposureSummary = {
  total_exposure: number;
  sensitive_exposure: number;
  max_exposure_area: string | null;
  route_length_m: number;
  sampled_pose_count: number;
  ray_count: number;
  estimated_task_coverage: number;
  engine: string;
  config: {
    min_range_m?: number;
    max_range_m: number;
    recognizability_d0_m: number;
    route_sample_step_m: number;
    reference_rays_per_pose?: number;
  };
};

export type ExposureResponse = {
  exposure_surfaces: any;
  exposure_points: Array<{
    lon: number;
    lat: number;
    exposure: number;
    surface_id: string;
    surface_type: string;
    semantic_type: string;
  }>;
  pose_evidence: PoseEvidence[];
  summary: ExposureSummary;
};

export type UserPreferences = {
  do_not_capture?: any | null;
  sensitive_areas?: any | null;
  acceptable_conditions: Array<Record<string, unknown>>;
};

export type CompareResponse = {
  before: ExposureSummary;
  after: ExposureSummary;
  delta: {
    exposure_reduction_percent: number;
    route_length_increase_percent: number;
    coverage_loss_percent: number;
  };
  explanation: string;
};

export type PlanningOption = {
  id: string;
  label: string;
  strategy: string;
  modified_route: RoutePoint[];
  modified_camera: CameraConfig;
  summary: ExposureSummary;
  delta: {
    sensitive_exposure_reduction_percent: number;
    total_exposure_reduction_percent: number;
    route_length_increase_percent: number;
    coverage_loss_percent: number;
  };
  objective_terms: {
    privacy: number;
    route_length: number;
    smoothness: number;
    altitude: number;
    gimbal: number;
    task: number;
    objective: number;
  };
  explanation: string;
};

export type PlanningResponse = {
  baseline_summary: ExposureSummary;
  options: PlanningOption[];
};

export type PreferenceKind = 'sensitive_area' | 'do_not_capture';
export type StudyCondition = 'basic_notice' | 'camera_footprint' | 'visual_exposure';
export type StudyRole = 'participant' | 'facilitator';
export type StudyLanguage = 'en' | 'zh';

export type LayerToggles = {
  buildings: boolean;
  semanticRegions: boolean;
  uav: boolean;
  frustum: boolean;
  exposure: boolean;
  preferences: boolean;
};

export type UploadParseResult = {
  route: RoutePoint[];
  sourceFormat: 'GeoJSON' | 'WKT';
};

export type AppError = {
  title: string;
  message: string;
};
