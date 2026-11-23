"""Add events, audit, and telemetry policies.

Revision ID: 0005_events_policies_audit
Revises: 0004_project_content
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_events_policies_audit"
down_revision: str | None = "0004_project_content"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "canales",
        sa.Column("guardar_historico", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "canales",
        sa.Column(
            "intervalo_guardado_segundos", sa.SmallInteger(), server_default="5", nullable=False
        ),
    )
    op.add_column(
        "canales",
        sa.Column(
            "guardar_solo_si_cambia", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )
    op.add_column("canales", sa.Column("cambio_minimo", sa.Float(), nullable=True))
    op.add_column(
        "canales",
        sa.Column("retencion_dias", sa.SmallInteger(), server_default="30", nullable=False),
    )
    op.create_unique_constraint(
        "uq_telemetria_canal_marca_origen",
        "telemetria",
        ["canal_id", "marca_tiempo_origen"],
    )
    op.create_table(
        "eventos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("proyecto_id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=True),
        sa.Column("canal_id", sa.Uuid(), nullable=True),
        sa.Column("tipo", sa.String(length=60), nullable=False),
        sa.Column("severidad", sa.String(length=20), nullable=False),
        sa.Column("mensaje", sa.String(length=500), nullable=False),
        sa.Column("detalles", sa.JSON(), nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["proyecto_id"], ["proyectos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["canal_id"], ["canales.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("proyecto_id", "dispositivo_id", "canal_id", "tipo", "severidad", "creado_en"):
        op.create_index(f"ix_eventos_{column}", "eventos", [column])
    op.create_table(
        "auditoria",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=True),
        sa.Column("accion", sa.String(length=120), nullable=False),
        sa.Column("recurso", sa.String(length=500), nullable=False),
        sa.Column("codigo_estado", sa.SmallInteger(), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("detalles", sa.JSON(), nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("usuario_id", "accion", "creado_en"):
        op.create_index(f"ix_auditoria_{column}", "auditoria", [column])


def downgrade() -> None:
    for column in ("usuario_id", "accion", "creado_en"):
        op.drop_index(f"ix_auditoria_{column}", table_name="auditoria")
    op.drop_table("auditoria")
    for column in ("proyecto_id", "dispositivo_id", "canal_id", "tipo", "severidad", "creado_en"):
        op.drop_index(f"ix_eventos_{column}", table_name="eventos")
    op.drop_table("eventos")
    op.drop_constraint("uq_telemetria_canal_marca_origen", "telemetria", type_="unique")
    op.drop_column("canales", "retencion_dias")
    op.drop_column("canales", "cambio_minimo")
    op.drop_column("canales", "guardar_solo_si_cambia")
    op.drop_column("canales", "intervalo_guardado_segundos")
    op.drop_column("canales", "guardar_historico")
