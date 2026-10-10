import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY must be set in the environment.")

if len(JWT_SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters long.")
if JWT_ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError(
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero."
    )


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )