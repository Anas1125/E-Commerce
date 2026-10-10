from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

# Argon2id with the library's recommended settings.
# Install with:  pip install "pwdlib[argon2]"
password_hash = PasswordHash.recommended()

# A real hash of a throwaway password. Login uses it to do the same amount of
# work when the email doesn't exist, so response time doesn't reveal which
# emails have accounts.
_DUMMY_HASH = password_hash.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False

    try:
        return password_hash.verify(password, hashed_password)
    except UnknownHashError:
        # An empty, truncated or legacy hash in the database should mean
        # "wrong password", not a 500 error.
        return False


def verify_and_maybe_rehash(
    password: str,
    hashed_password: str | None,
) -> tuple[bool, str | None]:
    """Returns (is_valid, new_hash).

    new_hash is not None when the stored hash used older or weaker settings;
    save it so the account is upgraded the next time the user signs in.
    """
    if not hashed_password:
        return False, None

    try:
        return password_hash.verify_and_update(password, hashed_password)
    except UnknownHashError:
        return False, None


def burn_password_check(password: str) -> None:
    """Call when no user was found, to keep timing the same as a real check."""
    verify_password(password, _DUMMY_HASH)