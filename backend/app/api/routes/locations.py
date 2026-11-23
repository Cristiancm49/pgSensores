import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_project_access
from app.db.session import get_db
from app.models import Device, Location, User
from app.schemas.entities import LocationCreate, LocationRead, LocationUpdate

router = APIRouter()


@router.get("/projects/{project_id}/locations", response_model=list[LocationRead])
def list_locations(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[Location]:
    require_project_access(database, project_id, current_user)
    return list(
        database.scalars(
            select(Location).where(Location.project_id == project_id).order_by(Location.name)
        ).all()
    )


@router.post(
    "/projects/{project_id}/locations",
    response_model=LocationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_location(
    project_id: uuid.UUID,
    payload: LocationCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Location:
    require_project_access(database, project_id, current_user, "write")
    exists = database.scalar(
        select(Location.id).where(Location.project_id == project_id, Location.name == payload.name)
    )
    if exists:
        raise HTTPException(status_code=409, detail="Ya existe una ubicación con ese nombre")
    location = Location(project_id=project_id, **payload.model_dump())
    database.add(location)
    database.commit()
    database.refresh(location)
    return location


def get_location_with_permission(
    location_id: uuid.UUID, current_user: User, database: Session, permission: str
) -> Location:
    location = database.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    require_project_access(database, location.project_id, current_user, permission)
    return location


@router.patch("/locations/{location_id}", response_model=LocationRead)
def update_location(
    location_id: uuid.UUID,
    payload: LocationUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Location:
    location = get_location_with_permission(location_id, current_user, database, "write")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        duplicate = database.scalar(
            select(Location.id).where(
                Location.project_id == location.project_id,
                Location.name == changes["name"],
                Location.id != location.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Ya existe una ubicación con ese nombre")
    for field, value in changes.items():
        setattr(location, field, value)
    database.commit()
    database.refresh(location)
    return location


@router.delete("/locations/{location_id}", status_code=204)
def delete_location(
    location_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    location = get_location_with_permission(location_id, current_user, database, "write")
    in_use = database.scalar(select(Device.id).where(Device.location_id == location.id).limit(1))
    if in_use:
        raise HTTPException(status_code=409, detail="La ubicación tiene dispositivos asociados")
    database.delete(location)
    database.commit()
