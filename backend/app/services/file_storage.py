import re
import uuid
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings

ALLOWED_TYPES = {
    ".c": {"text/plain", "text/x-c"},
    ".cpp": {"text/plain", "text/x-c++src"},
    ".csv": {"text/csv", "application/vnd.ms-excel"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".gif": {"image/gif"},
    ".ino": {"text/plain", "application/octet-stream"},
    ".jpeg": {"image/jpeg"},
    ".jpg": {"image/jpeg"},
    ".json": {"application/json", "text/json"},
    ".md": {"text/markdown", "text/plain"},
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".ppt": {"application/vnd.ms-powerpoint"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    ".py": {"text/x-python", "text/plain"},
    ".svg": {"image/svg+xml"},
    ".txt": {"text/plain"},
    ".webm": {"video/webm"},
    ".webp": {"image/webp"},
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".yaml": {"application/yaml", "text/yaml", "text/plain"},
    ".yml": {"application/yaml", "text/yaml", "text/plain"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".mp4": {"video/mp4"},
}


class StorageValidationError(ValueError):
    pass


class FileStorage:
    def __init__(self) -> None:
        self.root = Path(settings.storage_path).resolve()

    def validate(self, filename: str, mime_type: str) -> tuple[str, str]:
        if not filename or len(filename) > 255 or "\x00" in filename:
            raise StorageValidationError("El nombre del archivo no es válido")
        if Path(filename).name != filename or "/" in filename or "\\" in filename:
            raise StorageValidationError("El nombre del archivo contiene una ruta no permitida")
        if not re.search(r"[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ]", filename):
            raise StorageValidationError("El nombre del archivo no es válido")
        extension = Path(filename).suffix.lower()
        allowed_mimes = ALLOWED_TYPES.get(extension)
        normalized_mime = (mime_type or "application/octet-stream").split(";", 1)[0].lower()
        if not allowed_mimes or normalized_mime not in allowed_mimes:
            raise StorageValidationError("El tipo o la extensión del archivo no están permitidos")
        return extension, normalized_mime

    def save(
        self,
        project_id: uuid.UUID,
        source: BinaryIO,
        filename: str,
        mime_type: str,
    ) -> tuple[str, str, int, str]:
        extension, normalized_mime = self.validate(filename, mime_type)
        stored_name = f"{uuid.uuid4().hex}{extension}"
        relative_path = Path(str(project_id)) / stored_name
        destination = self.resolve(relative_path.as_posix())
        destination.parent.mkdir(parents=True, exist_ok=True)
        partial = destination.with_suffix(f"{destination.suffix}.part")
        limit_mb = (
            settings.max_video_size_mb
            if normalized_mime.startswith("video/")
            else settings.max_file_size_mb
        )
        limit_bytes = limit_mb * 1024 * 1024
        size = 0
        try:
            with partial.open("wb") as target:
                while chunk := source.read(1024 * 1024):
                    size += len(chunk)
                    if size > limit_bytes:
                        raise StorageValidationError(
                            f"El archivo supera el límite de {limit_mb} MB"
                        )
                    target.write(chunk)
            if size == 0:
                raise StorageValidationError("El archivo está vacío")
            partial.replace(destination)
        except Exception:
            partial.unlink(missing_ok=True)
            raise
        return stored_name, relative_path.as_posix(), size, normalized_mime

    def resolve(self, relative_path: str) -> Path:
        path = (self.root / relative_path).resolve()
        if not path.is_relative_to(self.root):
            raise StorageValidationError("La ruta del archivo no es válida")
        return path

    def delete(self, relative_path: str) -> None:
        self.resolve(relative_path).unlink(missing_ok=True)


file_storage = FileStorage()
