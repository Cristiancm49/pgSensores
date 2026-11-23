import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import User
from app.schemas.entities import ProfileUpdate, UserCreate, UserRead, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserRead)
def get_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> User:
    changes = payload.model_dump(exclude_unset=True)
    password = changes.pop("password", None)
    if "email" in changes and changes["email"]:
        changes["email"] = changes["email"].lower()
        duplicate = database.scalar(
            select(User.id).where(User.email == changes["email"], User.id != current_user.id)
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="El correo ya está en uso")
    if password:
        current_user.password_hash = hash_password(password)
    for field, value in changes.items():
        setattr(current_user, field, value)
    database.commit()
    database.refresh(current_user)
    return current_user


@router.get("", response_model=list[UserRead])
def list_users(
    search: str | None = None,
    _: User = Depends(require_admin),
    database: Session = Depends(get_db),
) -> list[User]:
    statement = select(User).order_by(User.full_name)
    if search:
        term = f"%{search}%"
        statement = statement.where(or_(User.username.ilike(term), User.full_name.ilike(term)))
    return list(database.scalars(statement).all())


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    _: User = Depends(require_admin),
    database: Session = Depends(get_db),
) -> User:
    username = payload.username.lower()
    email = payload.email.lower() if payload.email else None
    exists = database.scalar(
        select(User.id).where(
            or_(
                User.username == username,
                User.email == email if email else False,
            )
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="El usuario o correo ya existe")
    user = User(
        username=username,
        full_name=payload.full_name,
        email=email,
        password_hash=hash_password(payload.password),
        is_admin=payload.is_admin,
    )
    database.add(user)
    database.commit()
    database.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    current_admin: User = Depends(require_admin),
    database: Session = Depends(get_db),
) -> User:
    user = database.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    changes = payload.model_dump(exclude_unset=True)
    password = changes.pop("password", None)
    if "email" in changes and changes["email"]:
        changes["email"] = changes["email"].lower()
        duplicate_email = database.scalar(
            select(User.id).where(
                User.email == changes["email"],
                User.id != user.id,
            )
        )
        if duplicate_email:
            raise HTTPException(status_code=409, detail="El correo ya está en uso")
    if password:
        user.password_hash = hash_password(password)
    for field, value in changes.items():
        setattr(user, field, value)
    if user.id == current_admin.id and not user.active:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propio usuario")
    database.commit()
    database.refresh(user)
    return user
