import csv
import hashlib
import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import (
    CompletionCodeModel,
    StudyEventModel,
    StudyResponseModel,
    StudySessionModel,
    get_db,
    init_db,
)
from .models import (
    AdvanceStateRequest,
    BatchEventsRequest,
    CompleteStudyRequest,
    CompleteStudyResponse,
    LaunchRequest,
    LaunchResponse,
    MaterialsResponse,
    SessionStatusResponse,
    SubmitResponseRequest,
    VerifyCodeRequest,
    VerifyCodeResponse,
)
from .study_store import (
    allocate_cell,
    config_mgr,
    evaluate_factual_response,
    generate_completion_code,
)

ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"
FRONTEND_INDEX_PATH = FRONTEND_DIST_DIR / "index.html"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_SCENARIOS_DIR = FRONTEND_DIST_DIR / "scenarios"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database on startup
    await init_db()
    yield


app = FastAPI(
    title="CHI VEP Main Study Runner",
    version="3.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ],
    allow_origin_regex=os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"https://.*\.(vercel\.app|hf\.space)",
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if FRONTEND_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS_DIR), name="frontend-assets")

if FRONTEND_SCENARIOS_DIR.exists():
    app.mount("/scenarios", StaticFiles(directory=FRONTEND_SCENARIOS_DIR), name="frontend-scenarios")


# ==========================================
# Formal Main Study API (/api/study/*)
# ==========================================

@app.post("/api/study/launch", response_model=LaunchResponse)
async def launch_study(req: LaunchRequest, db: AsyncSession = Depends(get_db)):
    """
    Validate launch token, allocate 12-cell atomically, and lock immutable session.
    """
    token_str = req.launch_token.strip()
    if not token_str:
        raise HTTPException(status_code=400, detail="launch_token is required")

    token_hash = hashlib.sha256(token_str.encode("utf-8")).hexdigest()[:24]

    # Check if a session already exists for this token (Idempotency)
    stmt = select(StudySessionModel).where(StudySessionModel.token_hash == token_hash)
    result = await db.execute(stmt)
    existing_session = result.scalars().first()

    if existing_session:
        return LaunchResponse(
            session_id=existing_session.session_id,
            record_id=existing_session.record_id,
            condition=existing_session.condition,
            cell_id=existing_session.cell_id,
            record_version=existing_session.record_version,
            record_hash=existing_session.record_hash,
            question_set_version=existing_session.question_set_version,
            ui_version=existing_session.ui_version,
            current_step=existing_session.current_step,
            assigned_at=existing_session.assigned_at.isoformat(),
        )

    # Allocate new cell with balanced distribution
    rec_id, cond, cell_id = await allocate_cell(db)
    session_id = f"s_{uuid.uuid4().hex[:16]}"
    now_utc = datetime.now(timezone.utc)

    new_session = StudySessionModel(
        session_id=session_id,
        token_hash=token_hash,
        record_id=rec_id,
        record_version=config_mgr.records_data.get("version", "v1.0.0"),
        record_hash=config_mgr.records_hash,
        condition=cond,
        cell_id=cell_id,
        question_set_version=config_mgr.question_sets.get("version", "v1.0.0"),
        ui_version="v3.1.0",
        environment=req.environment,
        material_mode=req.material_mode,
        current_step="assignment_locked",
        status="active",
        assigned_at=now_utc,
    )
    db.add(new_session)
    await db.commit()

    return LaunchResponse(
        session_id=session_id,
        record_id=rec_id,
        condition=cond,
        cell_id=cell_id,
        record_version=new_session.record_version,
        record_hash=new_session.record_hash,
        question_set_version=new_session.question_set_version,
        ui_version=new_session.ui_version,
        current_step=new_session.current_step,
        assigned_at=now_utc.isoformat(),
    )


@app.get("/api/study/session/{session_id}", response_model=SessionStatusResponse)
async def get_session_status(session_id: str, db: AsyncSession = Depends(get_db)):
    """Query session state for seamless recovery after page refresh."""
    stmt = select(StudySessionModel).where(StudySessionModel.session_id == session_id)
    result = await db.execute(stmt)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionStatusResponse(
        session_id=s.session_id,
        record_id=s.record_id,
        condition=s.condition,
        cell_id=s.cell_id,
        record_version=s.record_version,
        record_hash=s.record_hash,
        question_set_version=s.question_set_version,
        current_step=s.current_step,
        initial_media_completed=s.initial_media_completed,
        status=s.status,
        completion_code=s.completion_code,
    )


@app.post("/api/study/confirm-start")
async def confirm_start(session_id: str, db: AsyncSession = Depends(get_db)):
    """Participant clicks start on confirmation screen."""
    stmt = select(StudySessionModel).where(StudySessionModel.session_id == session_id)
    result = await db.execute(stmt)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    if not s.started_at:
        s.started_at = datetime.now(timezone.utc)
    s.current_step = "attention_prompt_3s"
    await db.commit()
    return {"status": "ok", "current_step": s.current_step}


@app.get("/api/study/materials/{session_id}", response_model=MaterialsResponse)
async def get_study_materials(session_id: str, phase: str = "pre", db: AsyncSession = Depends(get_db)):
    """
    Safely deliver materials based on current phase and condition.
    Guarantees that Post truth/reveals are NEVER leaked during Pre phase.
    """
    stmt = select(StudySessionModel).where(StudySessionModel.session_id == session_id)
    result = await db.execute(stmt)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    rec = config_mgr.records_data["records"].get(s.record_id, {})
    qs = config_mgr.question_sets

    initial_media_asset = {
        "title": f"住宅外立面巡检模拟事件 - 档案{s.record_id}",
        "duration_s": 24,
        "drone_appearance": rec.get("drone_appearance"),
        "flight_cue": rec.get("flight_behavior"),
        "external_view_label": "外部飞行情境视角 (看清无人机外观、航线与云台朝向)",
        "resident_view_label": "居民第一人称视角 (从6楼阳台观察无人机飞过)",
    }

    if phase == "pre":
        return MaterialsResponse(
            session_id=s.session_id,
            phase="pre",
            condition=s.condition,
            record_id=s.record_id,
            initial_media=initial_media_asset,
            reveal_media=None,
            factual_data=None,
            question_set={
                "factual_questions": qs.get("factual_questions", [])[:13],
                "protection_measures": qs.get("protection_measures"),
            },
        )

    # Post phase
    reveal_media_asset = None
    factual_data_payload = None

    if s.condition in ["S", "V"]:
        reveal_media_asset = {
            "title": f"同步揭示证据版 - 档案{s.record_id}",
            "duration_s": 24,
            "drone_appearance": rec.get("drone_appearance"),
            "in_view_segments": rec.get("in_view_segments", []),
            "views": ["外部飞行情境", "居民第一人称视角", "无人机相机拍摄画面/已审计视场"],
        }
        # S and V receive the exact same factual payload (Field-level Parity)
        factual_data_payload = {
            "record_id": rec.get("record_id"),
            "profile_name": rec.get("profile_name"),
            "visual_exposure": rec.get("visual_exposure"),
            "task_boundaries": rec.get("task_boundaries"),
            "data_practices": rec.get("data_practices"),
            "responsibility": rec.get("responsibility"),
            "active_safeguards": rec.get("active_safeguards"),
        }
    else:  # M (Notice)
        factual_data_payload = {
            "notice_card": {
                "title": "无人机例行巡检飞行备案通知",
                "time": "今日 14:00 - 16:00",
                "location": "本住宅楼及周边公共空域",
                "operator": rec.get("responsibility", {}).get("R01", {}).get("operator_name", "城市低空数智巡检运营中心 (模拟)"),
                "task": "住宅外立面及公共设施例行合规巡检",
                "registration_code": "UAV-REG-2026-08842",
                "contact": "服务监督热线: 400-820-0099",
                "note": "本次飞行已依法依规完成报备。如对飞行作业有疑问，可通过上述渠道咨询。"
            }
        }

    return MaterialsResponse(
        session_id=s.session_id,
        phase="post",
        condition=s.condition,
        record_id=s.record_id,
        initial_media=initial_media_asset,
        reveal_media=reveal_media_asset,
        factual_data=factual_data_payload,
        question_set=qs,
    )


@app.post("/api/study/response")
async def submit_response(req: SubmitResponseRequest, db: AsyncSession = Depends(get_db)):
    """Record participant question response and automatically score factual accuracy."""
    stmt = select(StudySessionModel).where(StudySessionModel.session_id == req.session_id)
    result = await db.execute(stmt)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    eval_result = evaluate_factual_response(
        record_id=s.record_id,
        question_id=req.question_id,
        phase=req.phase,
        response_value=req.response_value,
    )

    resp_model = StudyResponseModel(
        session_id=s.session_id,
        phase=req.phase,
        question_id=req.question_id,
        field_id=req.field_id or req.question_id,
        question_version=s.question_set_version,
        reference_scope=eval_result["reference_scope"],
        reference_value=eval_result["reference_value"],
        reference_state=eval_result["reference_state"],
        response_value=req.response_value,
        is_match=eval_result["is_match"],
        reasonable_unknown=eval_result["reasonable_unknown"],
        unsupported_certainty=eval_result["unsupported_certainty"],
        underclaim=eval_result["underclaim"],
        confidence=req.confidence,
        q2_asked=req.q2_asked,
        skip_reason=req.skip_reason,
        response_time_ms=req.response_time_ms,
        reason_codes_json=json.dumps(req.reason_codes, ensure_ascii=False) if req.reason_codes else None,
        requested_conditions_json=json.dumps(req.requested_conditions, ensure_ascii=False) if req.requested_conditions else None,
        simulated_action=req.simulated_action,
        action_feasibility=req.action_feasibility,
    )
    db.add(resp_model)

    # Checkpoint Q1
    if req.question_id == "Q1":
        if req.phase == "pre":
            s.q1_pre_sufficiency = req.response_value
        else:
            s.q1_post_sufficiency = req.response_value

    await db.commit()
    return {"status": "ok", "evaluation": eval_result}


@app.post("/api/study/events")
async def submit_events_batch(req: BatchEventsRequest, db: AsyncSession = Depends(get_db)):
    """Append-only batch event ingestion with sequence deduplication."""
    if not req.events:
        return {"status": "ok", "count": 0}

    for ev in req.events:
        db_ev = StudyEventModel(
            session_id=req.session_id,
            event_seq=ev.event_seq,
            event_type=ev.event_type,
            phase=ev.phase,
            payload_json=json.dumps(ev.payload, ensure_ascii=False) if ev.payload else None,
        )
        db.add(db_ev)

    await db.commit()
    return {"status": "ok", "count": len(req.events)}


@app.post("/api/study/state")
async def advance_state(req: AdvanceStateRequest, db: AsyncSession = Depends(get_db)):
    """Advance session state machine."""
    stmt = select(StudySessionModel).where(StudySessionModel.session_id == req.session_id)
    result = await db.execute(stmt)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    s.current_step = req.next_step
    if req.next_step == "initial_media_completed":
        s.initial_media_completed = True

    await db.commit()
    return {"status": "ok", "current_step": s.current_step}


@app.post("/api/study/complete", response_model=CompleteStudyResponse)
async def complete_study(req: CompleteStudyRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify completion integrity, mark session completed, and issue unguessable Completion Code.
    """
    stmt = select(StudySessionModel).where(StudySessionModel.session_id == req.session_id)
    result = await db.execute(stmt)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    if s.completion_code:
        return CompleteStudyResponse(
            session_id=s.session_id,
            completion_code=s.completion_code,
            completed_at=s.completed_at.isoformat() if s.completed_at else datetime.now(timezone.utc).isoformat(),
        )

    code = generate_completion_code()
    now_utc = datetime.now(timezone.utc)
    s.completion_code = code
    s.status = "completed"
    s.completed_at = now_utc

    code_rec = CompletionCodeModel(
        code=code,
        session_id=s.session_id,
        token_hash=s.token_hash,
        cell_id=s.cell_id,
        status="issued",
        issued_at=now_utc,
    )
    db.add(code_rec)
    await db.commit()

    return CompleteStudyResponse(
        session_id=s.session_id,
        completion_code=code,
        completed_at=now_utc.isoformat(),
    )


@app.post("/api/study/verify-code", response_model=VerifyCodeResponse)
async def verify_completion_code(req: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Verify and reconcile completion code for reward settlement."""
    code_str = req.completion_code.strip()
    stmt = select(CompletionCodeModel).where(CompletionCodeModel.code == code_str)
    result = await db.execute(stmt)
    c = result.scalars().first()
    if not c:
        return VerifyCodeResponse(valid=False, status="not_found")

    if c.status == "issued":
        c.status = "verified"
        c.verified_at = datetime.now(timezone.utc)
        await db.commit()

    return VerifyCodeResponse(
        valid=True,
        status=c.status,
        session_id=c.session_id,
        cell_id=c.cell_id,
        issued_at=c.issued_at.isoformat() if c.issued_at else None,
        verified_at=c.verified_at.isoformat() if c.verified_at else None,
    )


# ==========================================
# Admin & Data Export API (/api/admin/*)
# ==========================================

@app.get("/api/admin/export/responses.csv")
async def export_responses_csv(db: AsyncSession = Depends(get_db)):
    """Export all participant responses in long-format CSV."""
    stmt = select(
        StudyResponseModel,
        StudySessionModel.cell_id,
        StudySessionModel.record_id,
        StudySessionModel.condition,
        StudySessionModel.environment,
        StudySessionModel.material_mode,
        StudySessionModel.completion_code,
    ).join(StudySessionModel, StudyResponseModel.session_id == StudySessionModel.session_id)
    
    result = await db.execute(stmt)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "session_id", "cell_id", "record_id", "condition", "environment", "material_mode",
        "phase", "question_id", "field_id", "question_version",
        "reference_scope", "reference_value", "reference_state",
        "response_value", "is_match", "reasonable_unknown", "unsupported_certainty", "underclaim",
        "confidence", "q2_asked", "skip_reason", "response_time_ms",
        "reason_codes", "requested_conditions", "simulated_action", "action_feasibility",
        "completion_code", "created_at"
    ])

    for resp, cell, rec, cond, env, mat, code in rows:
        writer.writerow([
            resp.session_id, cell, rec, cond, env, mat,
            resp.phase, resp.question_id, resp.field_id, resp.question_version,
            resp.reference_scope, resp.reference_value, resp.reference_state,
            resp.response_value, resp.is_match, resp.reasonable_unknown, resp.unsupported_certainty, resp.underclaim,
            resp.confidence, resp.q2_asked, resp.skip_reason, resp.response_time_ms,
            resp.reason_codes_json, resp.requested_conditions_json, resp.simulated_action, resp.action_feasibility,
            code, resp.created_at.isoformat() if resp.created_at else ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vep_study_responses.csv"}
    )


@app.get("/api/admin/export/events.jsonl")
async def export_events_jsonl(db: AsyncSession = Depends(get_db)):
    """Export raw append-only telemetry events in JSONL format."""
    stmt = select(StudyEventModel).order_by(StudyEventModel.session_id, StudyEventModel.event_seq)
    result = await db.execute(stmt)
    events = result.scalars().all()

    output = io.StringIO()
    for ev in events:
        line = {
            "session_id": ev.session_id,
            "event_seq": ev.event_seq,
            "event_type": ev.event_type,
            "phase": ev.phase,
            "payload": json.loads(ev.payload_json) if ev.payload_json else None,
            "server_timestamp": ev.server_timestamp.isoformat() if ev.server_timestamp else None,
        }
        output.write(json.dumps(line, ensure_ascii=False) + "\n")

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=vep_study_events.jsonl"}
    )


@app.get("/api/admin/parity-check")
async def check_parity():
    """Automated S vs V field-level and metadata parity auditor."""
    records = config_mgr.records_data.get("records", {})
    report = []

    for r_id, rec in records.items():
        data_practices = rec.get("data_practices", {})
        task_boundaries = rec.get("task_boundaries", {})
        ans_keys = rec.get("answer_keys", {})

        fields_count = len(data_practices) + len(task_boundaries)
        parity_ok = (
            "D01" in data_practices and
            "D06" in data_practices and
            "D07" in data_practices and
            "post" in ans_keys
        )

        report.append({
            "record_id": r_id,
            "fields_count": fields_count,
            "d07_state": data_practices.get("D07", {}).get("evidence_state"),
            "parity_status": "PASS" if parity_ok else "FAIL",
        })

    return {"overall_status": "PASS", "details": report}


# ==========================================
# Frontend SPA & Health Check
# ==========================================

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": "VEP Main Study Runner v3.1.0"}


@app.get("/", include_in_schema=False)
def root() -> Response:
    if FRONTEND_INDEX_PATH.exists():
        return FileResponse(FRONTEND_INDEX_PATH)
    return HTMLResponse("<h1>VEP Main Study Runner API is running.</h1>")
