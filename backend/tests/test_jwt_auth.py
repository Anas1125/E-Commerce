from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.services import dependencies, security


def credentials(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def signed(payload, key=None):
    return jwt.encode(payload, key or security.JWT_SECRET_KEY, algorithm=security.JWT_ALGORITHM)


@pytest.mark.parametrize("role", ["customer", "admin"])
def test_token_roundtrip(role):
    user = SimpleNamespace(id=13, role=role, is_active=True)
    db = Mock()
    db.scalar.return_value = user
    token = security.create_access_token(user.id, role)
    assert dependencies.get_current_user(credentials(token), db) is user
    claims = jwt.decode(token, security.JWT_SECRET_KEY, algorithms=[security.JWT_ALGORITHM])
    assert claims["sub"] == "13"
    assert claims["role"] == role


@pytest.mark.parametrize("kind", ["expired", "missing_exp", "missing_sub", "bad_sub", "oversized_sub", "bad_signature", "malformed"])
def test_invalid_token_rejected_before_database_lookup(kind):
    payload = {"sub": "13", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    if kind == "expired":
        payload["exp"] = datetime.now(timezone.utc) - timedelta(minutes=5)
    elif kind == "missing_exp":
        del payload["exp"]
    elif kind == "missing_sub":
        del payload["sub"]
    elif kind == "bad_sub":
        payload["sub"] = "invalid"
    elif kind == "oversized_sub":
        payload["sub"] = str(2**64)
    token = "not.a.jwt" if kind == "malformed" else signed(payload, "different-test-signing-value-" * 2 if kind == "bad_signature" else None)
    db = Mock()
    with pytest.raises(HTTPException) as exc:
        dependencies.get_current_user(credentials(token), db)
    assert exc.value.status_code == 401
    db.scalar.assert_not_called()


def test_database_role_controls_admin_access():
    db = Mock()
    db.scalar.return_value = SimpleNamespace(id=13, role="customer", is_active=True)
    token = security.create_access_token(13, "admin")
    user = dependencies.get_current_user(credentials(token), db)
    with pytest.raises(HTTPException) as exc:
        dependencies.require_admin(user)
    assert exc.value.status_code == 403


def test_inactive_user_is_rejected():
    db = Mock()
    db.scalar.return_value = SimpleNamespace(id=13, role="customer", is_active=False)
    with pytest.raises(HTTPException) as exc:
        dependencies.get_current_user(credentials(security.create_access_token(13, "customer")), db)
    assert exc.value.status_code == 403
