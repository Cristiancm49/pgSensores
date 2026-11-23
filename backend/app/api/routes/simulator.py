import uuid
from datetime import UTC, datetime

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_project_access
from app.core.config import settings
from app.db.session import get_db
from app.models import Channel, Device, SimulatorRun, SimulatorSession, User
from app.schemas.entities import (
    SimulatorFaults,
    SimulatorInputs,
    SimulatorLaboratoryCreate,
    SimulatorRunRead,
    SimulatorScenarioDocument,
    SimulatorSessionCreate,
    SimulatorSessionRead,
    SimulatorSessionUpdate,
)
from app.services.mqtt_security import MqttSecurityError
from app.services.simulator_runtime import (
    board_profiles,
    component_catalog,
    simulator_manager,
    starter_kit_channels,
    starter_kits,
)

router = APIRouter(prefix="/simulator")


def validate_scenario(value: dict) -> dict:
    try:
        document = SimulatorScenarioDocument.model_validate(value or {})
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"Escenario inválido: {error}") from error
    if len(document.steps) > settings.simulator_max_scenario_steps:
        raise HTTPException(status_code=422, detail="El escenario supera el límite de pasos")
    allowed = {"set", "ramp", "sequence", "fault"}
    for index, step in enumerate(document.steps, start=1):
        if float(step.get("at_seconds", 0)) < 0:
            raise HTTPException(status_code=422, detail=f"Paso {index}: tiempo negativo")
        if step.get("action", "set") not in allowed:
            raise HTTPException(status_code=422, detail=f"Paso {index}: acción no soportada")
    return document.model_dump()


def board_profile(profile_id: str) -> dict:
    profile = next((item for item in board_profiles() if item["id"] == profile_id), None)
    if profile is None:
        raise HTTPException(status_code=422, detail="Perfil de placa no soportado")
    return profile


def finish_latest_run(database: Session, session: SimulatorSession, snapshot: dict) -> None:
    run = database.scalar(
        select(SimulatorRun)
        .where(SimulatorRun.session_id == session.id, SimulatorRun.finished_at.is_(None))
        .order_by(SimulatorRun.started_at.desc())
    )
    if run is None:
        return
    run.state = snapshot.get("state", "detenida")
    run.finished_at = datetime.now(UTC)
    run.logs = snapshot.get("logs", [])
    run.summary = {
        "elapsed_seconds": snapshot.get("elapsed_seconds", 0),
        "messages_sent": snapshot.get("messages_sent", 0),
        "last_values": snapshot.get("values", {}),
        "actuators": snapshot.get("actuators", {}),
        "faults": snapshot.get("faults", {}),
        "last_error": snapshot.get("last_error"),
    }


def get_session_with_access(
    session_id: uuid.UUID,
    current_user: User,
    database: Session,
    permission: str = "read",
) -> SimulatorSession:
    session = database.get(SimulatorSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión de simulación no encontrada")
    require_project_access(database, session.project_id, current_user, permission)
    return session


def runtime_snapshot(session: SimulatorSession) -> dict:
    runtime = simulator_manager.get(session.id)
    if runtime is not None:
        return runtime.snapshot()
    return {
        "session_id": str(session.id),
        "device_id": str(session.device_id),
        "state": session.state,
        "connected": False,
        "elapsed_seconds": 0,
        "messages_sent": 0,
        "values": {},
        "actuators": {},
        "faults": {
            "network_disconnected": False,
            "drop_ack": False,
            "latency_ms": 0,
            "noise_multiplier": 1,
        },
        "last_error": session.last_error,
        "logs": [],
    }


@router.get("/profiles")
def list_board_profiles(_: User = Depends(get_current_user)) -> list[dict]:
    return board_profiles()


@router.get("/kits")
def list_starter_kits(_: User = Depends(get_current_user)) -> list[dict]:
    return starter_kits()


@router.get("/components")
def list_simulator_components(_: User = Depends(get_current_user)) -> list[dict]:
    return component_catalog()


@router.get("/sessions", response_model=list[SimulatorSessionRead])
def list_sessions(
    project_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[SimulatorSession]:
    statement = select(SimulatorSession).order_by(SimulatorSession.created_at.desc())
    if project_id:
        require_project_access(database, project_id, current_user)
        statement = statement.where(SimulatorSession.project_id == project_id)
    sessions = list(database.scalars(statement).all())
    if project_id or current_user.is_admin:
        return sessions
    accessible = []
    for session in sessions:
        try:
            require_project_access(database, session.project_id, current_user)
            accessible.append(session)
        except HTTPException as error:
            if error.status_code != 403:
                raise
    return accessible


@router.post("/sessions", response_model=SimulatorSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SimulatorSessionCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> SimulatorSession:
    require_project_access(database, payload.project_id, current_user, "write")
    board_profile(payload.board_profile)
    device = database.get(Device, payload.device_id)
    if device is None or device.project_id != payload.project_id:
        raise HTTPException(status_code=422, detail="El dispositivo no pertenece al proyecto")
    values = payload.model_dump()
    values["scenario"] = validate_scenario(values.get("scenario", {}))
    session = SimulatorSession(created_by_id=current_user.id, **values)
    database.add(session)
    database.commit()
    database.refresh(session)
    return session


@router.post(
    "/laboratories", response_model=SimulatorSessionRead, status_code=status.HTTP_201_CREATED
)
def create_virtual_laboratory(
    payload: SimulatorLaboratoryCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> SimulatorSession:
    require_project_access(database, payload.project_id, current_user, "write")
    profile = board_profile(payload.board_profile)
    try:
        channel_specs = starter_kit_channels(payload.starter_kit, payload.components or None)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    scenario = validate_scenario(payload.scenario)
    device = Device(
        project_id=payload.project_id,
        name=payload.device_name,
        description=f"Dispositivo virtual {profile['name']} creado desde el simulador UDLAIoT.",
        board_type=profile["name"],
        connection_type="simulador",
        device_identifier=f"virtual-{payload.board_profile}-{uuid.uuid4().hex[:10]}",
        firmware_version="udlaiot-simulator-1.0",
        configuration={
            "virtual": True,
            "board_profile": payload.board_profile,
            "starter_kit": payload.starter_kit,
            "connectivity": profile["connectivity"],
            "firmware_language": payload.firmware_language,
            "firmware_code": payload.firmware_code,
        },
    )
    database.add(device)
    database.flush()
    for spec in channel_specs:
        database.add(
            Channel(
                device_id=device.id,
                key=spec["key"],
                name=spec["name"],
                description="Canal virtual creado automáticamente por el simulador.",
                category=spec["category"],
                data_type=spec["data_type"],
                unit=spec.get("unit"),
                gpio=spec["gpio"],
                writable=spec["category"] == "actuador",
                widget_type=spec["widget_type"],
                minimum_value=spec.get("minimum_value"),
                maximum_value=spec.get("maximum_value"),
                configuration={"virtual": True, "starter_kit": payload.starter_kit},
                save_history=True,
                save_interval_seconds=max(1, payload.tick_ms // 1000),
                retention_days=30,
            )
        )
    session = SimulatorSession(
        project_id=payload.project_id,
        device_id=device.id,
        created_by_id=current_user.id,
        name=payload.name,
        board_profile=payload.board_profile,
        tick_ms=payload.tick_ms,
        seed=payload.seed,
        configuration={
            **payload.configuration,
            "starter_kit": payload.starter_kit,
            "components": [spec["key"] for spec in channel_specs],
            "firmware_language": payload.firmware_language,
            "firmware_code": payload.firmware_code,
        },
        scenario=scenario,
    )
    database.add(session)
    database.commit()
    database.refresh(session)
    return session


@router.get("/sessions/{session_id}", response_model=SimulatorSessionRead)
def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> SimulatorSession:
    return get_session_with_access(session_id, current_user, database)


@router.patch("/sessions/{session_id}", response_model=SimulatorSessionRead)
def update_session(
    session_id: uuid.UUID,
    payload: SimulatorSessionUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> SimulatorSession:
    session = get_session_with_access(session_id, current_user, database, "write")
    runtime = simulator_manager.get(session.id)
    if runtime and runtime.state in {"preparando", "ejecutando", "pausada"}:
        raise HTTPException(status_code=409, detail="Detén la sesión antes de editarla")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "board_profile":
            board_profile(value)
        if field == "scenario":
            value = validate_scenario(value)
        setattr(session, field, value)
    database.commit()
    database.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Response:
    session = get_session_with_access(session_id, current_user, database, "write")
    simulator_manager.remove(session.id)
    database.delete(session)
    database.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/{session_id}/start")
def start_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    device = database.get(Device, session.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    channels = list(
        database.scalars(
            select(Channel).where(Channel.device_id == device.id, Channel.active.is_(True))
        ).all()
    )
    if not any(channel.category == "sensor" for channel in channels):
        raise HTTPException(
            status_code=422, detail="El dispositivo necesita al menos un sensor activo"
        )
    session.state = "preparando"
    session.last_error = None
    database.commit()
    try:
        snapshot = simulator_manager.start(session, device, channels)
    except MqttSecurityError as error:
        session.state = "fallida"
        session.last_error = str(error)
        database.commit()
        raise HTTPException(status_code=503, detail=str(error)) from error
    except RuntimeError as error:
        session.state = "fallida"
        session.last_error = str(error)
        database.commit()
        raise HTTPException(status_code=409, detail=str(error)) from error
    session.state = "ejecutando"
    session.started_at = datetime.now(UTC)
    session.stopped_at = None
    database.add(
        SimulatorRun(
            session_id=session.id,
            project_id=session.project_id,
            device_id=session.device_id,
            created_by_id=current_user.id,
            state="ejecutando",
            scenario=session.scenario,
        )
    )
    database.commit()
    return snapshot


@router.post("/sessions/{session_id}/pause")
def pause_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    runtime = simulator_manager.get(session.id)
    if runtime is None:
        raise HTTPException(status_code=409, detail="La sesión no está activa")
    try:
        runtime.pause()
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    session.state = "pausada"
    database.commit()
    return runtime.snapshot()


@router.post("/sessions/{session_id}/resume")
def resume_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    runtime = simulator_manager.get(session.id)
    if runtime is None:
        raise HTTPException(status_code=409, detail="La sesión no está activa")
    try:
        runtime.resume()
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    session.state = "ejecutando"
    database.commit()
    return runtime.snapshot()


@router.post("/sessions/{session_id}/reset")
def reset_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    runtime = simulator_manager.get(session.id)
    if runtime is None:
        raise HTTPException(status_code=409, detail="La sesión no está activa")
    runtime.reset()
    return runtime.snapshot()


@router.post("/sessions/{session_id}/stop")
def stop_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    snapshot = simulator_manager.stop(session.id) or runtime_snapshot(session)
    session.state = "detenida"
    session.stopped_at = datetime.now(UTC)
    finish_latest_run(database, session, snapshot)
    database.commit()
    return snapshot


@router.get("/sessions/{session_id}/status")
def get_session_status(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database)
    snapshot = runtime_snapshot(session)
    runtime_state = snapshot["state"]
    if runtime_state != session.state and runtime_state in {"fallida", "detenida"}:
        session.state = runtime_state
        session.last_error = snapshot.get("last_error")
        if runtime_state == "detenida":
            session.stopped_at = datetime.now(UTC)
        finish_latest_run(database, session, snapshot)
        database.commit()
    return snapshot


@router.post("/sessions/{session_id}/inputs")
def set_session_inputs(
    session_id: uuid.UUID,
    payload: SimulatorInputs,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    runtime = simulator_manager.get(session.id)
    if runtime is None:
        raise HTTPException(status_code=409, detail="La sesión no está activa")
    try:
        runtime.set_inputs(payload.values)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return runtime.snapshot()


@router.post("/sessions/{session_id}/faults")
def set_session_faults(
    session_id: uuid.UUID,
    payload: SimulatorFaults,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    session = get_session_with_access(session_id, current_user, database, "write")
    runtime = simulator_manager.get(session.id)
    if runtime is None:
        raise HTTPException(status_code=409, detail="La sesión no está activa")
    runtime.set_faults(payload.model_dump(exclude_none=True))
    return runtime.snapshot()


@router.get("/sessions/{session_id}/logs")
def get_session_logs(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[dict]:
    session = get_session_with_access(session_id, current_user, database)
    return runtime_snapshot(session)["logs"]


@router.get("/sessions/{session_id}/scenario/export", response_class=PlainTextResponse)
def export_scenario(
    session_id: uuid.UUID,
    format: str = Query(default="json", pattern="^(json|yaml)$"),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> str:
    session = get_session_with_access(session_id, current_user, database)
    if format == "yaml":
        return yaml.safe_dump(session.scenario, allow_unicode=True, sort_keys=False)
    import json

    return json.dumps(session.scenario, ensure_ascii=False, indent=2)


@router.post("/sessions/{session_id}/scenario/import", response_model=SimulatorSessionRead)
def import_scenario(
    session_id: uuid.UUID,
    content: str = Body(media_type="text/plain", max_length=262_144),
    format: str = Query(default="json", pattern="^(json|yaml)$"),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> SimulatorSession:
    session = get_session_with_access(session_id, current_user, database, "write")
    if session.state in {"preparando", "ejecutando", "pausada"}:
        raise HTTPException(status_code=409, detail="Detén la sesión antes de importar")
    try:
        if format == "yaml":
            value = yaml.safe_load(content)
        else:
            import json

            value = json.loads(content)
    except (ValueError, yaml.YAMLError) as error:
        raise HTTPException(status_code=422, detail=f"Documento inválido: {error}") from error
    if not isinstance(value, dict):
        raise HTTPException(status_code=422, detail="El escenario debe ser un objeto")
    session.scenario = validate_scenario(value)
    database.commit()
    database.refresh(session)
    return session


@router.get("/runs", response_model=list[SimulatorRunRead])
def list_runs(
    project_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[SimulatorRun]:
    statement = select(SimulatorRun).order_by(SimulatorRun.started_at.desc()).limit(200)
    if project_id:
        require_project_access(database, project_id, current_user)
        statement = statement.where(SimulatorRun.project_id == project_id)
    if session_id:
        session = get_session_with_access(session_id, current_user, database)
        statement = statement.where(SimulatorRun.session_id == session.id)
    runs = list(database.scalars(statement).all())
    if project_id or session_id or current_user.is_admin:
        return runs
    return [run for run in runs if not _forbidden(database, run.project_id, current_user)]


def _forbidden(database: Session, project_id: uuid.UUID, user: User) -> bool:
    try:
        require_project_access(database, project_id, user)
        return False
    except HTTPException as error:
        if error.status_code != 403:
            raise
        return True


@router.get("/runs/compare")
def compare_runs(
    ids: list[uuid.UUID] = Query(min_length=2, max_length=5),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict:
    runs = list(database.scalars(select(SimulatorRun).where(SimulatorRun.id.in_(ids))).all())
    if len(runs) != len(set(ids)):
        raise HTTPException(status_code=404, detail="Una o más ejecuciones no existen")
    for run in runs:
        require_project_access(database, run.project_id, current_user)
    metrics = ["elapsed_seconds", "messages_sent"]
    return {
        "runs": [SimulatorRunRead.model_validate(run).model_dump(mode="json") for run in runs],
        "metrics": {
            metric: {str(run.id): run.summary.get(metric, 0) for run in runs} for metric in metrics
        },
    }
