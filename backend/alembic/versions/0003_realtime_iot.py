"""Add channel state, telemetry, and commands.

Revision ID: 0003_realtime_iot
Revises: 0002_device_credentials
"""

import sqlalchemy as sa

from alembic import op

revision = "0003_realtime_iot"
down_revision = "0002_device_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "estado_canales",
        sa.Column("canal_id", sa.Uuid(), nullable=False),
        sa.Column("valor", sa.JSON(), nullable=False),
        sa.Column(
            "recibido_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("marca_tiempo_origen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["canal_id"], ["canales.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("canal_id"),
    )
    op.create_table(
        "telemetria",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("canal_id", sa.Uuid(), nullable=False),
        sa.Column("valor", sa.JSON(), nullable=False),
        sa.Column(
            "registrado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("marca_tiempo_origen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["canal_id"], ["canales.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_telemetria_canal_id", "telemetria", ["canal_id"])
    op.create_index("ix_telemetria_canal_registrado", "telemetria", ["canal_id", "registrado_en"])
    op.create_table(
        "comandos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=False),
        sa.Column("canal_id", sa.Uuid(), nullable=False),
        sa.Column("solicitado_por_id", sa.Uuid(), nullable=False),
        sa.Column("valor", sa.JSON(), nullable=False),
        sa.Column("estado", sa.String(length=30), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("enviado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["canal_id"], ["canales.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["solicitado_por_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_comandos_canal_id", "comandos", ["canal_id"])
    op.create_index("ix_comandos_dispositivo_id", "comandos", ["dispositivo_id"])
    op.create_index("ix_comandos_estado", "comandos", ["estado"])
    op.create_index("ix_comandos_expira_en", "comandos", ["expira_en"])


def downgrade() -> None:
    op.drop_table("comandos")
    op.drop_table("telemetria")
    op.drop_table("estado_canales")
