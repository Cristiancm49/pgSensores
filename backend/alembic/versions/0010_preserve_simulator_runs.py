"""Preserve reports when a simulator session is deleted.

Revision ID: 0010_preserve_simulator_runs
Revises: 0009_simulator_runs
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010_preserve_simulator_runs"
down_revision: str | None = "0009_simulator_runs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ejecuciones_simulador_sesion_id_fkey",
        "ejecuciones_simulador",
        type_="foreignkey",
    )
    op.alter_column("ejecuciones_simulador", "sesion_id", nullable=True)
    op.create_foreign_key(
        "ejecuciones_simulador_sesion_id_fkey",
        "ejecuciones_simulador",
        "sesiones_simulador",
        ["sesion_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ejecuciones_simulador_sesion_id_fkey",
        "ejecuciones_simulador",
        type_="foreignkey",
    )
    op.alter_column("ejecuciones_simulador", "sesion_id", nullable=False)
    op.create_foreign_key(
        "ejecuciones_simulador_sesion_id_fkey",
        "ejecuciones_simulador",
        "sesiones_simulador",
        ["sesion_id"],
        ["id"],
        ondelete="CASCADE",
    )
