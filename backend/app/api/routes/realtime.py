import uuid

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import or_, select

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models import Project, ProjectMember, User
from app.services.realtime import realtime_manager

router = APIRouter()


@router.websocket("/ws")
async def realtime_socket(websocket: WebSocket, token: str | None = None) -> None:
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        await websocket.close(code=4401)
        return

    with SessionLocal() as database:
        user = database.get(User, user_id)
        if user is None or not user.active:
            await websocket.close(code=4401)
            return
        if user.is_admin:
            project_ids = None
        else:
            member_project_ids = select(ProjectMember.project_id).where(
                ProjectMember.user_id == user.id
            )
            project_ids = {
                str(project_id)
                for project_id in database.scalars(
                    select(Project.id).where(
                        or_(
                            Project.owner_id == user.id,
                            Project.id.in_(member_project_ids),
                        )
                    )
                ).all()
            }

    await realtime_manager.connect(websocket, project_ids)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket)
