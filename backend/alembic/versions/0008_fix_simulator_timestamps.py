"""Align simulator timestamp columns with the SQLAlchemy model.

Revision ID: 0008_fix_simulator_timestamps
Revises: 0007_simulator_sessions
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008_fix_simulator_timestamps"
down_revision: str | None = "0007_simulator_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("sesiones_simulador", "creado_en", new_column_name="created_at")
    op.alter_column("sesiones_simulador", "actualizado_en", new_column_name="updated_at")


def downgrade() -> None:
    op.alter_column("sesiones_simulador", "updated_at", new_column_name="actualizado_en")
    op.alter_column("sesiones_simulador", "created_at", new_column_name="creado_en")
