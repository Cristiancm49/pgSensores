from fastapi import APIRouter

from app.api.routes.audit import router as audit_router
from app.api.routes.auth import router as auth_router
from app.api.routes.devices import router as devices_router
from app.api.routes.events import router as events_router
from app.api.routes.health import router as health_router
from app.api.routes.locations import router as locations_router
from app.api.routes.project_content import router as project_content_router
from app.api.routes.projects import router as projects_router
from app.api.routes.realtime import router as realtime_router
from app.api.routes.simulator import router as simulator_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.users import router as users_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(audit_router, tags=["audit"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(project_content_router, tags=["documentation", "files"])
api_router.include_router(locations_router, tags=["locations"])
api_router.include_router(devices_router, tags=["devices", "channels"])
api_router.include_router(events_router, tags=["events"])
api_router.include_router(realtime_router, tags=["realtime"])
api_router.include_router(simulator_router, tags=["simulator"])
api_router.include_router(telemetry_router, tags=["telemetry", "commands"])
