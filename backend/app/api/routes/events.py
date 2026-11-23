import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Event, Project, ProjectMember, User
from app.schemas.entities import EventPage

router = APIRouter()


@router.get("/events", response_model=EventPage)
def list_events(
    project_id: uuid.UUID | None = None,
    device_id: uuid.UUID | None = None,
    severity: str | None = Query(default=None, pattern=r"^(info|advertencia|critica)$"),
    event_type: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> EventPage:
    filters = []
    if not current_user.is_admin:
        memberships = select(ProjectMember.project_id).where(
            ProjectMember.user_id == current_user.id
        )
        allowed = select(Project.id).where(
            or_(Project.owner_id == current_user.id, Project.id.in_(memberships))
        )
        filters.append(Event.project_id.in_(allowed))
    if project_id:
        filters.append(Event.project_id == project_id)
    if device_id:
        filters.append(Event.device_id == device_id)
    if severity:
        filters.append(Event.severity == severity)
    if event_type:
        filters.append(Event.event_type == event_type)
    if from_date:
        filters.append(Event.created_at >= from_date)
    if to_date:
        filters.append(Event.created_at <= to_date)

    total = database.scalar(select(func.count(Event.id)).where(*filters)) or 0
    items = list(
        database.scalars(
            select(Event)
            .where(*filters)
            .order_by(Event.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return EventPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/projects/{project_id}/events/summary")
def project_event_summary(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict[str, int]:
    from app.api.deps import require_project_access

    require_project_access(database, project_id, current_user)
    rows = database.execute(
        select(Event.severity, func.count(Event.id))
        .where(Event.project_id == project_id)
        .group_by(Event.severity)
    ).all()
    summary = {severity: count for severity, count in rows}
    return {
        "total": sum(summary.values()),
        "info": summary.get("info", 0),
        "advertencia": summary.get("advertencia", 0),
        "critica": summary.get("critica", 0),
    }
