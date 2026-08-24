from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


# ==========================================
# CHI-3 Formal Main Study API Models
# ==========================================

class LaunchRequest(BaseModel):
    launch_token: str = Field(description="Opaque token from external questionnaire platform")
    environment: str = Field(default="prod", description="dev, pilot, or prod")
    material_mode: str = Field(default="validated", description="placeholder or validated")


class LaunchResponse(BaseModel):
    session_id: str
    record_id: str
    condition: str
    cell_id: str
    record_version: str
    record_hash: str
    question_set_version: str
    ui_version: str
    current_step: str
    assigned_at: str


class SessionStatusResponse(BaseModel):
    session_id: str
    record_id: str
    condition: str
    cell_id: str
    record_version: str
    record_hash: str
    question_set_version: str
    current_step: str
    initial_media_completed: bool
    status: str
    completion_code: Optional[str] = None


class MaterialsResponse(BaseModel):
    session_id: str
    phase: str
    condition: str
    record_id: str
    # Materials for current phase
    initial_media: Optional[Dict[str, Any]] = None
    reveal_media: Optional[Dict[str, Any]] = None
    factual_data: Optional[Dict[str, Any]] = None
    question_set: Optional[Dict[str, Any]] = None


class SubmitResponseRequest(BaseModel):
    session_id: str
    phase: str  # pre, post
    question_id: str  # A01, D02, Q1, Q2, etc.
    field_id: Optional[str] = None
    response_value: Optional[str] = None
    confidence: Optional[int] = None
    q2_asked: Optional[int] = None
    skip_reason: Optional[str] = None
    response_time_ms: Optional[int] = None
    reason_codes: Optional[List[str]] = None
    requested_conditions: Optional[List[str]] = None
    simulated_action: Optional[str] = None
    action_feasibility: Optional[int] = None


class StudyEventItem(BaseModel):
    event_seq: int
    event_type: str
    phase: str
    payload: Optional[Dict[str, Any]] = None
    client_timestamp: Optional[str] = None


class BatchEventsRequest(BaseModel):
    session_id: str
    events: List[StudyEventItem]


class AdvanceStateRequest(BaseModel):
    session_id: str
    next_step: str
    checkpoint_data: Optional[Dict[str, Any]] = None


class CompleteStudyRequest(BaseModel):
    session_id: str


class CompleteStudyResponse(BaseModel):
    session_id: str
    completion_code: str
    completed_at: str


class VerifyCodeRequest(BaseModel):
    completion_code: str


class VerifyCodeResponse(BaseModel):
    valid: bool
    status: str
    session_id: Optional[str] = None
    cell_id: Optional[str] = None
    issued_at: Optional[str] = None
    verified_at: Optional[str] = None


# ==========================================
# Legacy Route & Planning Models (Preserved)
# ==========================================

class RoutePoint(BaseModel):
    lon: float
    lat: float
    alt: float
    yaw: float = 0.0


class CameraConfig(BaseModel):
    hfov_deg: float = 78.0
    vfov_deg: float = 50.0
    gimbal_pitch_deg: float = -45.0
    ray_width: int = Field(default=80, ge=1, le=640)
    ray_height: int = Field(default=45, ge=1, le=360)
    min_depth_m: float | None = Field(default=None, ge=0)
    max_depth_m: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_depth_range(self) -> "CameraConfig":
        if (
            self.min_depth_m is not None
            and self.max_depth_m is not None
            and self.min_depth_m >= self.max_depth_m
        ):
            raise ValueError("camera min_depth_m must be less than max_depth_m")
        return self


class UserPreferences(BaseModel):
    do_not_capture: dict | None = None
    sensitive_areas: dict | None = None
    acceptable_conditions: list[dict] = Field(default_factory=list)


class ExposureRequest(BaseModel):
    scenario_id: str
    route: list[RoutePoint]
    camera: CameraConfig
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)


class CompareRequest(BaseModel):
    scenario_id: str
    before: ExposureRequest
    after: ExposureRequest


class PlannerWeights(BaseModel):
    privacy: float = Field(default=1.0, ge=0)
    route_length: float = Field(default=0.25, ge=0)
    smoothness: float = Field(default=0.1, ge=0)
    altitude: float = Field(default=0.08, ge=0)
    gimbal: float = Field(default=0.08, ge=0)
    task: float = Field(default=0.6, ge=0)


class PlannerConfig(BaseModel):
    max_options: int = Field(default=3, ge=1, le=5)
    max_candidates: int = Field(default=8, ge=1, le=30)
    evaluation_ray_width: int = Field(default=32, ge=1, le=160)
    evaluation_ray_height: int = Field(default=18, ge=1, le=90)
    influence_radius_m: float = Field(default=120.0, gt=0)
    min_task_coverage: float = Field(default=0.0, ge=0, le=1)
    max_route_length_increase_percent: float | None = Field(default=50.0, ge=0)
    weights: PlannerWeights = Field(default_factory=PlannerWeights)


class PlanningRequest(BaseModel):
    scenario_id: str
    route: list[RoutePoint]
    camera: CameraConfig
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)
    planner_config: PlannerConfig = Field(default_factory=PlannerConfig)
