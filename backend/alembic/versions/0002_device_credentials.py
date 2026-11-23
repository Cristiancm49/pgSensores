"""Add revocable MQTT device credentials.

Revision ID: 0002_device_credentials
Revises: 0001_initial
"""

import sqlalchemy as sa

from alembic import op

revision = "0002_device_credentials"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credenciales_dispositivo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=False),
        sa.Column("nombre_usuario", sa.String(length=160), nullable=False),
        sa.Column("secreto_hash", sa.String(length=64), nullable=False),
        sa.Column("nombre_rol", sa.String(length=160), nullable=False),
        sa.Column("creado_por_id", sa.Uuid(), nullable=False),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("revocada_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["creado_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre_rol"),
        sa.UniqueConstraint("nombre_usuario"),
    )
    op.create_index(
        "ix_credenciales_dispositivo_dispositivo_id",
        "credenciales_dispositivo",
        ["dispositivo_id"],
    )
    op.create_index(
        "ix_credenciales_dispositivo_nombre_usuario",
        "credenciales_dispositivo",
        ["nombre_usuario"],
        unique=True,
    )
    op.create_index(
        "ix_credenciales_dispositivo_revocada_en",
        "credenciales_dispositivo",
        ["revocada_en"],
    )


def downgrade() -> None:
    op.drop_table("credenciales_dispositivo")
