"""Audit trail path parsing helpers (no database required)."""
import uuid

from app.core.audit import _action_for, _entity_from_path, _first_uuid

SAMPLE_ID = "8d4a6a39-bc2f-46ab-84b8-0c092ca1c887"


def test_first_uuid_finds_id_anywhere_in_path():
    assert str(_first_uuid(f"/api/v1/tasks/{SAMPLE_ID}/complete")) == SAMPLE_ID
    assert _first_uuid("/api/v1/tasks") is None
    assert isinstance(_first_uuid(f"/api/v1/tasks/{SAMPLE_ID}"), uuid.UUID)


def test_entity_from_path_maps_plural_routes_to_singular_entities():
    assert _entity_from_path("/api/v1/nonconformities")[0] == "nonconformity"
    assert _entity_from_path("/api/v1/corrective-actions")[0] == "corrective_action"
    assert _entity_from_path("/api/v1/tasks")[0] == "task"
    assert _entity_from_path("/api/v1/attachments")[0] == "attachment"


def test_entity_from_path_extracts_entity_id():
    entity_type, entity_id = _entity_from_path(f"/api/v1/inspections/{SAMPLE_ID}")
    assert entity_type == "inspection"
    assert str(entity_id) == SAMPLE_ID


def test_entity_from_path_handles_auth_and_unknown_routes():
    assert _entity_from_path("/api/v1/auth/change-password")[0] == "user"
    assert _entity_from_path("/api/v1/something-new")[0] == "something-new"
    assert _entity_from_path("/health")[0] == "api"


def test_action_for_maps_http_verbs():
    assert _action_for("POST", "/api/v1/tasks") == "create"
    assert _action_for("PUT", f"/api/v1/tasks/{SAMPLE_ID}") == "update"
    assert _action_for("PATCH", f"/api/v1/tasks/{SAMPLE_ID}") == "update"
    assert _action_for("DELETE", f"/api/v1/tasks/{SAMPLE_ID}") == "delete"


def test_action_for_recognises_named_actions():
    assert _action_for("POST", f"/api/v1/tasks/{SAMPLE_ID}/complete") == "complete"
    assert _action_for("POST", f"/api/v1/corrective-actions/{SAMPLE_ID}/verify") == "verify"
    assert _action_for("POST", f"/api/v1/attachments") == "upload"
    assert _action_for("POST", "/api/v1/auth/change-password") == "change_password"
