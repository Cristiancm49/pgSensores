"""Add managed IoT simulator sessions.

Revision ID: 0007_simulator_sessions
Revises: 0006_rebrand_udlaiot
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_simulator_sessions"
down_revision: str | None = "0006_rebrand_udlaiot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sesiones_simulador",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("proyecto_id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=False),
        sa.Column("creado_por_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=160), nullable=False),
        sa.Column("perfil_placa", sa.String(length=60), nullable=False),
        sa.Column("estado", sa.String(length=30), server_default="creada", nullable=False),
        sa.Column("intervalo_ms", sa.SmallInteger(), server_default="2000", nullable=False),
        sa.Column("semilla", sa.BigInteger(), server_default="1", nullable=False),
        sa.Column("configuracion", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column("escenario", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column("ultimo_error", sa.Text(), nullable=True),
        sa.Column("iniciada_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("detenida_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["creado_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("proyecto_id", "dispositivo_id", "creado_por_id", "estado"):
        op.create_index(f"ix_sesiones_simulador_{column}", "sesiones_simulador", [column])


def downgrade() -> None:
    for column in ("proyecto_id", "dispositivo_id", "creado_por_id", "estado"):
        op.drop_index(f"ix_sesiones_simulador_{column}", table_name="sesiones_simulador")
    op.drop_table("sesiones_simulador")
