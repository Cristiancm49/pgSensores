import asyncio
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class RealtimeManager:
    def __init__(self) -> None:
        self.connections: dict[WebSocket, set[str] | None] = {}

    async def connect(self, websocket: WebSocket, project_ids: set[str] | None) -> None:
        await websocket.accept()
        self.connections[websocket] = project_ids
        await websocket.send_json({"type": "connected"})

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.pop(websocket, None)

    async def broadcast(self, event: dict[str, Any]) -> None:
        project_id = str(event.get("project_id", ""))
        stale: list[WebSocket] = []
        for websocket, allowed_projects in list(self.connections.items()):
            if allowed_projects is not None and project_id not in allowed_projects:
                continue
            try:
                await websocket.send_json(jsonable_encoder(event))
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)

    def broadcast_from_thread(
        self, event: dict[str, Any], loop: asyncio.AbstractEventLoop | None
    ) -> None:
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(event), loop)


realtime_manager = RealtimeManager()
