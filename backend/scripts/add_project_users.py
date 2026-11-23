from __future__ import annotations

import argparse

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Project, ProjectMember, ProjectRole, User


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create local users and add them to a project.")
    parser.add_argument("usernames", nargs="+")
    parser.add_argument("--project", required=True)
    parser.add_argument("--role", default="editor")
    parser.add_argument("--password", required=True)
    parser.add_argument("--reset-passwords", action="store_true")
    return parser.parse_args()


def student_name(username: str) -> str:
    suffix = username.removeprefix("est")
    return f"Estudiante {suffix}" if suffix.isdigit() else username


def main() -> None:
    args = parse_args()
    with SessionLocal() as database:
        project = database.scalar(select(Project).where(Project.name == args.project))
        if project is None:
            raise SystemExit(f"No existe el proyecto {args.project!r}")
        role = database.scalar(select(ProjectRole).where(ProjectRole.code == args.role))
        if role is None:
            raise SystemExit(f"No existe el rol {args.role!r}")

        for username in args.usernames:
            user = database.scalar(select(User).where(User.username == username))
            if user is None:
                user = User(
                    username=username,
                    full_name=student_name(username),
                    password_hash=hash_password(args.password),
                    active=True,
                    is_admin=False,
                )
                database.add(user)
                database.flush()
            elif args.reset_passwords:
                user.password_hash = hash_password(args.password)
                user.active = True

            membership = database.scalar(
                select(ProjectMember).where(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                )
            )
            if membership is None:
                database.add(
                    ProjectMember(project_id=project.id, user_id=user.id, role_id=role.id)
                )
            else:
                membership.role_id = role.id

        database.commit()
        print(
            f"Usuarios {', '.join(args.usernames)} agregados a {project.name} como {role.code}."
        )


if __name__ == "__main__":
    main()
