from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import ProjectRole, User

ROLES = [
    (1, "propietario", "Propietario", "Control total del proyecto"),
    (2, "editor", "Editor", "Puede modificar recursos del proyecto"),
    (3, "visualizador", "Visualizador", "Puede consultar el proyecto"),
]


def seed() -> None:
    with SessionLocal() as database:
        for role_id, code, name, description in ROLES:
            if database.get(ProjectRole, role_id) is None:
                database.add(ProjectRole(id=role_id, code=code, name=name, description=description))

        admin = database.scalar(select(User).where(User.username == settings.admin_username))
        if admin is None:
            database.add(
                User(
                    username=settings.admin_username,
                    full_name=settings.admin_full_name,
                    password_hash=hash_password(settings.admin_password),
                    active=True,
                    is_admin=True,
                )
            )
        else:
            admin.active = True
            admin.is_admin = True
        database.commit()


if __name__ == "__main__":
    seed()
