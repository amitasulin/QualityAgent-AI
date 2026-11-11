"""Validation tests for user and site schemas (no database required)."""
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.user import UserRole
from app.schemas.site import SiteCreate, SiteUpdate
from app.schemas.user import UserCreate, UserUpdate


def test_user_create_requires_a_password_of_at_least_eight_characters():
    with pytest.raises(ValidationError):
        UserCreate(email="user@example.com", full_name="Test User", password="short")

    user = UserCreate(email="user@example.com", full_name="Test User", password="longenough")
    assert user.password == "longenough"


def test_user_create_generates_identity_when_omitted():
    user = UserCreate(email="user@example.com", full_name="Test User", password="longenough")

    assert user.identity_id is None
    assert user.role == UserRole.VIEWER
    assert user.is_active is True


def test_user_create_accepts_explicit_identity_and_site():
    site_id = uuid4()
    user = UserCreate(
        email="user@example.com",
        full_name="Test User",
        password="longenough",
        identity_id="sso-123",
        role="quality_inspector",
        site_id=site_id,
    )

    assert user.identity_id == "sso-123"
    assert user.role == UserRole.QUALITY_INSPECTOR
    assert user.site_id == site_id


def test_user_create_rejects_invalid_email():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", full_name="Test User", password="longenough")


def test_user_update_is_fully_optional():
    update = UserUpdate()

    assert update.model_dump(exclude_unset=True) == {}


def test_user_update_password_has_the_same_minimum_length():
    with pytest.raises(ValidationError):
        UserUpdate(password="short")

    assert UserUpdate(password="longenough").password == "longenough"


def test_user_update_can_change_role_and_status():
    update = UserUpdate(role="admin", is_active=False)

    assert update.role == UserRole.ADMIN
    assert update.is_active is False


def test_site_create_requires_a_name():
    with pytest.raises(ValidationError):
        SiteCreate(name="")

    site = SiteCreate(name="מפעל ראשי", code="SITE-001")
    assert site.name == "מפעל ראשי"
    assert site.code == "SITE-001"
    assert site.is_active is True


def test_site_update_is_fully_optional():
    update = SiteUpdate()

    assert update.model_dump(exclude_unset=True) == {}


def test_site_update_accepts_partial_fields():
    update = SiteUpdate(address="רחוב הרצל 1, תל אביב", is_active=False)

    assert update.name is None
    assert update.address == "רחוב הרצל 1, תל אביב"
    assert update.is_active is False
