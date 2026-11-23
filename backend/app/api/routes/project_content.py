import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_project_access
from app.db.session import get_db
from app.models import ProjectDocument, ProjectFile, User
from app.schemas.entities import (
    DocumentCreate,
    DocumentOrderUpdate,
    DocumentRead,
    DocumentUpdate,
    ProjectFileRead,
)
from app.services.file_storage import StorageValidationError, file_storage

router = APIRouter()


@router.get("/projects/{project_id}/documents", response_model=list[DocumentRead])
def list_documents(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[ProjectDocument]:
    require_project_access(database, project_id, current_user)
    return list(
        database.scalars(
            select(ProjectDocument)
            .where(ProjectDocument.project_id == project_id)
            .order_by(ProjectDocument.order)
        ).all()
    )


@router.post(
    "/projects/{project_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    project_id: uuid.UUID,
    payload: DocumentCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ProjectDocument:
    require_project_access(database, project_id, current_user, "write")
    last_order = database.scalar(
        select(func.max(ProjectDocument.order)).where(ProjectDocument.project_id == project_id)
    )
    document = ProjectDocument(
        project_id=project_id,
        title=payload.title,
        content=payload.content,
        order=(last_order if last_order is not None else -1) + 1,
        updated_by_id=current_user.id,
    )
    database.add(document)
    database.commit()
    database.refresh(document)
    return document


@router.patch("/documents/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ProjectDocument:
    document = database.get(ProjectDocument, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    require_project_access(database, document.project_id, current_user, "write")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field, value)
    document.updated_by_id = current_user.id
    database.commit()
    database.refresh(document)
    return document


@router.put("/projects/{project_id}/documents/order", response_model=list[DocumentRead])
def reorder_documents(
    project_id: uuid.UUID,
    payload: DocumentOrderUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[ProjectDocument]:
    require_project_access(database, project_id, current_user, "write")
    documents = list(
        database.scalars(
            select(ProjectDocument).where(ProjectDocument.project_id == project_id)
        ).all()
    )
    by_id = {document.id: document for document in documents}
    if len(payload.document_ids) != len(documents) or set(payload.document_ids) != set(by_id):
        raise HTTPException(status_code=400, detail="El orden debe incluir todas las secciones")
    for temporary_order, document_id in enumerate(payload.document_ids, start=1):
        by_id[document_id].order = -temporary_order
    database.flush()
    for order, document_id in enumerate(payload.document_ids):
        by_id[document_id].order = order
        by_id[document_id].updated_by_id = current_user.id
    database.commit()
    return [by_id[document_id] for document_id in payload.document_ids]


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    document = database.get(ProjectDocument, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    require_project_access(database, document.project_id, current_user, "write")
    project_id = document.project_id
    database.delete(document)
    database.flush()
    remaining = list(
        database.scalars(
            select(ProjectDocument)
            .where(ProjectDocument.project_id == project_id)
            .order_by(ProjectDocument.order)
        ).all()
    )
    for temporary_order, item in enumerate(remaining, start=1):
        item.order = -temporary_order
    database.flush()
    for order, item in enumerate(remaining):
        item.order = order
    database.commit()


def file_to_schema(item: ProjectFile, user: User) -> ProjectFileRead:
    return ProjectFileRead(
        id=item.id,
        project_id=item.project_id,
        uploaded_by_id=item.uploaded_by_id,
        uploaded_by_name=user.full_name,
        original_name=item.original_name,
        mime_type=item.mime_type,
        size_bytes=item.size_bytes,
        description=item.description,
        created_at=item.created_at,
    )


@router.get("/projects/{project_id}/files", response_model=list[ProjectFileRead])
def list_files(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[ProjectFileRead]:
    require_project_access(database, project_id, current_user)
    rows = database.execute(
        select(ProjectFile, User)
        .join(User, User.id == ProjectFile.uploaded_by_id)
        .where(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
    ).all()
    return [file_to_schema(item, user) for item, user in rows]


@router.post(
    "/projects/{project_id}/files",
    response_model=ProjectFileRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_file(
    project_id: uuid.UUID,
    upload: UploadFile = File(...),
    description: str | None = Form(default=None, max_length=1000),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ProjectFileRead:
    require_project_access(database, project_id, current_user, "write")
    try:
        stored_name, relative_path, size, mime_type = file_storage.save(
            project_id,
            upload.file,
            upload.filename or "",
            upload.content_type or "application/octet-stream",
        )
    except StorageValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    item = ProjectFile(
        project_id=project_id,
        uploaded_by_id=current_user.id,
        original_name=upload.filename,
        stored_name=stored_name,
        relative_path=relative_path,
        mime_type=mime_type,
        size_bytes=size,
        description=description or None,
    )
    try:
        database.add(item)
        database.commit()
        database.refresh(item)
    except Exception:
        database.rollback()
        file_storage.delete(relative_path)
        raise
    return file_to_schema(item, current_user)


def get_file_with_access(
    file_id: uuid.UUID,
    current_user: User,
    database: Session,
    permission: str = "read",
) -> ProjectFile:
    item = database.get(ProjectFile, file_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    require_project_access(database, item.project_id, current_user, permission)
    return item


@router.get("/files/{file_id}/download")
def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> FileResponse:
    item = get_file_with_access(file_id, current_user, database)
    try:
        path = file_storage.resolve(item.relative_path)
    except StorageValidationError as error:
        raise HTTPException(status_code=404, detail="Archivo no encontrado") from error
    if not path.is_file():
        raise HTTPException(status_code=404, detail="El archivo físico no existe")
    return FileResponse(path, media_type=item.mime_type, filename=item.original_name)


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: uuid.UUID,
    confirm: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    if not confirm:
        raise HTTPException(status_code=400, detail="Confirma la eliminación definitiva")
    item = get_file_with_access(file_id, current_user, database, "write")
    relative_path = item.relative_path
    file_storage.delete(relative_path)
    database.delete(item)
    database.commit()
