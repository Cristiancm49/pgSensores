import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Project, ProjectMember, ProjectRole, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), database: Session = Depends(get_db)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="La sesión no es válida",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_error
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as error:
        raise credentials_error from error

    user = database.get(User, user_id)
    if user is None or not user.active:
        raise credentials_error
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador")
    return current_user


def require_project_access(
    database: Session,
    project_id: uuid.UUID,
    current_user: User,
    permission: str = "read",
) -> Project:
    project = database.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if current_user.is_admin or project.owner_id == current_user.id:
        return project

    role_code = database.scalar(
        select(ProjectRole.code)
        .join(ProjectMember, ProjectMember.role_id == ProjectRole.id)
        .where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
        )
    )
    if role_code is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto")
    if permission == "write" and role_code not in {"propietario", "editor"}:
        raise HTTPException(status_code=403, detail="No puedes modificar este proyecto")
    if permission == "manage" and role_code != "propietario":
        raise HTTPException(status_code=403, detail="No puedes administrar este proyecto")
    return project
