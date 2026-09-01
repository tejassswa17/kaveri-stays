from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import decode_access_token


security = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    try:
        payload = decode_access_token(credentials.credentials)
        if "sub" not in payload or "role" not in payload:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token"
            )
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


def require_role(*allowed_roles: str):
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Forbidden"
            )
        return current_user
    return role_checker


require_staff = require_role("staff", "manager", "owner")
require_manager = require_role("manager", "owner")
require_owner = require_role("owner")
require_guest = require_role("guest")