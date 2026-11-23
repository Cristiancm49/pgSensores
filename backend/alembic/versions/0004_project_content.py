"""Add project documentation and files.

Revision ID: 0004_project_content
Revises: 0003_realtime_iot
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_project_content"
down_revision: str | None = "0003_realtime_iot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "documentos_proyecto",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("proyecto_id", sa.Uuid(), nullable=False),
        sa.Column("titulo", sa.String(length=180), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.Column("actualizado_por_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actualizado_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("proyecto_id", "orden"),
    )
    op.create_index("ix_documentos_proyecto_proyecto_id", "documentos_proyecto", ["proyecto_id"])
    op.create_table(
        "archivos_proyecto",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("proyecto_id", sa.Uuid(), nullable=False),
        sa.Column("subido_por_id", sa.Uuid(), nullable=False),
        sa.Column("nombre_original", sa.String(length=255), nullable=False),
        sa.Column("nombre_fisico", sa.String(length=255), nullable=False),
        sa.Column("ruta_relativa", sa.String(length=500), nullable=False),
        sa.Column("tipo_mime", sa.String(length=160), nullable=False),
        sa.Column("tamano_bytes", sa.BigInteger(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subido_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre_fisico"),
        sa.UniqueConstraint("ruta_relativa"),
    )
    op.create_index("ix_archivos_proyecto_proyecto_id", "archivos_proyecto", ["proyecto_id"])


def downgrade() -> None:
    op.drop_index("ix_archivos_proyecto_proyecto_id", table_name="archivos_proyecto")
    op.drop_table("archivos_proyecto")
    op.drop_index("ix_documentos_proyecto_proyecto_id", table_name="documentos_proyecto")
    op.drop_table("documentos_proyecto")
