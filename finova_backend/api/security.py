from __future__ import annotations

"""Password security helpers for Finova API."""

from dataclasses import dataclass
from typing import Optional

from django.contrib.auth.hashers import check_password, make_password

# Password complexity requirements align with OWASP recommendations for high-value systems.
MIN_LENGTH = 12
SPECIAL_CHARACTERS = set("!@#$%^&*()_+-=[]{}|;:'\",.<>/?")
COMMON_WEAK_PATTERNS = {
    "password",
    "123456",
    "123456789",
    "qwerty",
    "letmein",
    "welcome",
    "admin",
}


@dataclass
class PasswordValidationResult:
    """Structured outcome for password validation."""

    is_valid: bool
    error: Optional[str] = None


# Pre-compute a dummy hash so timing stays consistent for unknown users.
_DUMMY_PASSWORD_HASH = make_password("ThisIsADummyPassword#2026")


def validate_password_strength(password: str) -> PasswordValidationResult:
    """Validate password against policy while avoiding revealing context."""

    if password is None:
        return PasswordValidationResult(False, "Password is required.")

    if password != password.strip():
        return PasswordValidationResult(False, "Password cannot start or end with whitespace.")

    if len(password) < MIN_LENGTH:
        return PasswordValidationResult(False, "Password must be at least 12 characters long.")

    if password.lower() in COMMON_WEAK_PATTERNS:
        return PasswordValidationResult(False, "Choose a password that is harder to guess.")

    if not any(ch.isupper() for ch in password):
        return PasswordValidationResult(False, "Password must include at least one uppercase letter.")

    if not any(ch.islower() for ch in password):
        return PasswordValidationResult(False, "Password must include at least one lowercase letter.")

    if not any(ch.isdigit() for ch in password):
        return PasswordValidationResult(False, "Password must include at least one number.")

    if not any(ch in SPECIAL_CHARACTERS for ch in password):
        return PasswordValidationResult(False, "Password must include at least one special character.")

    lowered = password.lower()
    for pattern in COMMON_WEAK_PATTERNS:
        if pattern in lowered:
            return PasswordValidationResult(False, "Password is too easy to guess.")

    return PasswordValidationResult(True)


def hash_password(password: str) -> str:
    """Hash password with bcrypt (via Django) to ensure unique salt per credential."""

    return make_password(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password in constant time to resist timing attacks."""

    return check_password(password, hashed_password)


def constant_time_check(password: str, hashed_password: Optional[str]) -> bool:
    """Always execute a hash comparison to keep timing uniform for invalid users."""

    candidate_hash = hashed_password or _DUMMY_PASSWORD_HASH
    return verify_password(password, candidate_hash)
