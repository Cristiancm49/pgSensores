"""Persist simulator run reports and history.

Revision ID: 0009_simulator_runs
Revises: 0008_fix_simulator_timestamps
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_simulator_runs"
down_revision: str | None = "0008_fix_simulator_timestamps"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ejecuciones_simulador",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sesion_id", sa.Uuid(), nullable=False),
        sa.Column("proyecto_id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=False),
        sa.Column("creado_por_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(length=30), server_default="ejecutando", nullable=False),
        sa.Column("escenario", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column("resumen", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column("registros", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=False),
        sa.Column("iniciada_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finalizada_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["sesion_id"], ["sesiones_simulador.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["creado_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("sesion_id", "proyecto_id", "dispositivo_id", "creado_por_id", "estado"):
        op.create_index(f"ix_ejecuciones_simulador_{column}", "ejecuciones_simulador", [column])


def downgrade() -> None:
    op.drop_table("ejecuciones_simulador")
