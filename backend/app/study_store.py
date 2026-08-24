import hashlib
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import (
    CompletionCodeModel,
    StudyEventModel,
    StudyResponseModel,
    StudySessionModel,
)

DATA_DIR = Path(__file__).resolve().parent / "data"
CANONICAL_RECORDS_PATH = DATA_DIR / "canonical_records.json"
QUESTION_SETS_PATH = DATA_DIR / "question_sets.json"

CELLS_12 = [
    "A_M", "A_S", "A_V",
    "B_M", "B_S", "B_V",
    "C_M", "C_S", "C_V",
    "D_M", "D_S", "D_V",
]


class CanonicalConfigManager:
    _instance = None

    def __init__(self):
        self.records_data: Dict[str, Any] = {}
        self.question_sets: Dict[str, Any] = {}
        self.records_hash: str = ""
        self.question_sets_hash: str = ""
        self.reload()

    def reload(self):
        with open(CANONICAL_RECORDS_PATH, "r", encoding="utf-8") as f:
            raw_rec = f.read()
            self.records_data = json.loads(raw_rec)
            self.records_hash = hashlib.sha256(raw_rec.encode("utf-8")).hexdigest()[:16]

        with open(QUESTION_SETS_PATH, "r", encoding="utf-8") as f:
            raw_qs = f.read()
            self.question_sets = json.loads(raw_qs)
            self.question_sets_hash = hashlib.sha256(raw_qs.encode("utf-8")).hexdigest()[:16]

    @classmethod
    def get_instance(cls) -> "CanonicalConfigManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance


config_mgr = CanonicalConfigManager.get_instance()


async def allocate_cell(db: AsyncSession) -> Tuple[str, str, str]:
    """
    Atomically allocate the cell with the lowest number of active/completed sessions
    to guarantee balanced cell distribution.
    Returns (record_id, condition, cell_id).
    """
    # Count sessions per cell
    stmt = select(StudySessionModel.cell_id, func.count(StudySessionModel.session_id)).group_by(StudySessionModel.cell_id)
    result = await db.execute(stmt)
    counts = dict(result.all())

    # Find the cell with the minimum count
    # Default to 0 if cell has no records
    min_cell = min(CELLS_12, key=lambda c: counts.get(c, 0))
    rec_id, cond = min_cell.split("_")
    return rec_id, cond, min_cell


def evaluate_factual_response(
    record_id: str,
    question_id: str,
    phase: str,  # pre or post
    response_value: Optional[str],
) -> Dict[str, Any]:
    """
    Evaluate participant response against answer keys for either pre (media_scope) or post (record_scope).
    Returns a dict with is_match, reasonable_unknown, unsupported_certainty, underclaim, reference_value, reference_state.
    """
    rec = config_mgr.records_data["records"].get(record_id)
    if not rec:
        return {
            "is_match": None,
            "reasonable_unknown": None,
            "unsupported_certainty": None,
            "underclaim": None,
            "reference_scope": f"{phase}_scope",
            "reference_value": None,
            "reference_state": None,
        }

    keys = rec["answer_keys"].get(phase, {})
    q_key = keys.get(question_id)
    if not q_key:
        return {
            "is_match": None,
            "reasonable_unknown": None,
            "unsupported_certainty": None,
            "underclaim": None,
            "reference_scope": f"{phase}_scope",
            "reference_value": None,
            "reference_state": None,
        }

    ref_scope = "media_scope" if phase == "pre" else "record_scope"
    ref_value = q_key.get("reference_value")
    ref_state = q_key.get("reference_state", "unknown" if phase == "pre" else "audited")
    acceptable = q_key.get("acceptable", [])
    unsupported = q_key.get("unsupported_certainty", [])

    is_match = 1 if response_value in acceptable else 0
    is_unknown_resp = response_value in ["当前无法确认", "无法确认", "unknown"]

    reasonable_unknown = 0
    unsupported_certainty = 0
    underclaim = 0

    if phase == "pre":
        if is_unknown_resp and ("当前无法确认" in acceptable):
            reasonable_unknown = 1
        elif response_value in unsupported:
            unsupported_certainty = 1
    else:  # post
        if ref_state == "unknown":
            if is_unknown_resp:
                reasonable_unknown = 1
            else:
                unsupported_certainty = 1
        else:  # known fact in post
            if is_unknown_resp:
                underclaim = 1

    return {
        "is_match": is_match,
        "reasonable_unknown": reasonable_unknown,
        "unsupported_certainty": unsupported_certainty,
        "underclaim": underclaim,
        "reference_scope": ref_scope,
        "reference_value": ref_value,
        "reference_state": ref_state,
    }


def generate_completion_code() -> str:
    """Generate an unguessable, human-readable 8-character completion code."""
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    rand_part = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"VEP-{rand_part}"
