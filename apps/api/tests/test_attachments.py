"""Attachment endpoint helpers (no database required)."""
import pytest

from app.api.v1.attachments import ENTITY_MODELS, _model_for
from app.core.exceptions import ValidationError


def test_supported_entity_types():
    assert set(ENTITY_MODELS) == {"complaint", "inspection", "corrective_action", "task"}


def test_rejects_unknown_entity_type():
    with pytest.raises(ValidationError):
        _model_for("ncr")
    with pytest.raises(ValidationError):
        _model_for("")


def test_returns_model_for_known_type():
    assert _model_for("complaint") is ENTITY_MODELS["complaint"]
