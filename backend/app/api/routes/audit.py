from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import AuditLog, User
from app.schemas.entities import AuditRead

router = APIRouter()


@router.get("/audit", response_model=list[AuditRead])
def list_audit(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(require_admin),
    database: Session = Depends(get_db),
) -> list[AuditLog]:
    statement = select(AuditLog)
    if from_date:
        statement = statement.where(AuditLog.created_at >= from_date)
    if to_date:
        statement = statement.where(AuditLog.created_at <= to_date)
    return list(database.scalars(statement.order_by(AuditLog.created_at.desc()).limit(limit)).all())
