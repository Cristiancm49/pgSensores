import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_project_access
from app.db.session import get_db
from app.models import Project, ProjectMember, ProjectRole, User
from app.schemas.entities import (
    MemberCreate,
    MemberRead,
    MemberUpdate,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter()


@router.get("", response_model=list[ProjectRead])
def list_projects(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[Project]:
    statement = select(Project).order_by(Project.updated_at.desc())
    if not current_user.is_admin:
        member_project_ids = select(ProjectMember.project_id).where(
            ProjectMember.user_id == current_user.id
        )
        statement = statement.where(
            or_(Project.owner_id == current_user.id, Project.id.in_(member_project_ids))
        )
    if not include_archived:
        statement = statement.where(Project.status != "archivado")
    return list(database.scalars(statement).unique().all())


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Project:
    owner_role = database.scalar(select(ProjectRole).where(ProjectRole.code == "propietario"))
    if owner_role is None:
        raise HTTPException(status_code=500, detail="Los roles del sistema no están configurados")
    project = Project(owner_id=current_user.id, **payload.model_dump())
    database.add(project)
    database.flush()
    database.add(
        ProjectMember(project_id=project.id, user_id=current_user.id, role_id=owner_role.id)
    )
    database.commit()
    database.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Project:
    return require_project_access(database, project_id, current_user)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Project:
    project = require_project_access(database, project_id, current_user, "write")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    database.commit()
    database.refresh(project)
    return project


@router.delete("/{project_id}", response_model=ProjectRead)
def archive_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Project:
    project = require_project_access(database, project_id, current_user, "manage")
    project.status = "archivado"
    database.commit()
    database.refresh(project)
    return project


def member_to_schema(member: ProjectMember, user: User, role: ProjectRole) -> MemberRead:
    return MemberRead(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role_code=role.code,
        role_name=role.name,
        added_at=member.added_at,
    )


@router.get("/{project_id}/members", response_model=list[MemberRead])
def list_members(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[MemberRead]:
    require_project_access(database, project_id, current_user)
    rows = database.execute(
        select(ProjectMember, User, ProjectRole)
        .join(User, User.id == ProjectMember.user_id)
        .join(ProjectRole, ProjectRole.id == ProjectMember.role_id)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectRole.id, User.full_name)
    ).all()
    return [member_to_schema(member, user, role) for member, user, role in rows]


@router.post("/{project_id}/members", response_model=MemberRead, status_code=201)
def add_member(
    project_id: uuid.UUID,
    payload: MemberCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> MemberRead:
    require_project_access(database, project_id, current_user, "manage")
    user = database.scalar(select(User).where(User.username == payload.username.lower()))
    role = database.scalar(select(ProjectRole).where(ProjectRole.code == payload.role_code))
    if user is None or not user.active:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if role is None:
        raise HTTPException(status_code=400, detail="Rol inválido")
    exists = database.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="El usuario ya pertenece al proyecto")
    member = ProjectMember(project_id=project_id, user_id=user.id, role_id=role.id)
    database.add(member)
    database.commit()
    database.refresh(member)
    return member_to_schema(member, user, role)


@router.patch("/{project_id}/members/{user_id}", response_model=MemberRead)
def update_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: MemberUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> MemberRead:
    require_project_access(database, project_id, current_user, "manage")
    member = database.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )
    role = database.scalar(select(ProjectRole).where(ProjectRole.code == payload.role_code))
    user = database.get(User, user_id)
    if member is None or user is None:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    if role is None:
        raise HTTPException(status_code=400, detail="Rol inválido")
    current_role = database.get(ProjectRole, member.role_id)
    if current_role and current_role.code == "propietario":
        raise HTTPException(status_code=400, detail="No se puede cambiar el rol del propietario")
    member.role_id = role.id
    database.commit()
    database.refresh(member)
    return member_to_schema(member, user, role)


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    project = require_project_access(database, project_id, current_user, "manage")
    if project.owner_id == user_id:
        raise HTTPException(status_code=400, detail="No se puede eliminar al propietario")
    member = database.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    database.delete(member)
    database.commit()
