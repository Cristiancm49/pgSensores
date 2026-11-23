"""Update the default administrator display name.

Revision ID: 0006_rebrand_udlaiot
Revises: 0005_events_policies_audit
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_rebrand_udlaiot"
down_revision: str | None = "0005_events_policies_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE usuarios SET nombre_completo = 'Administrador UDLAIoT' "
            "WHERE nombre_completo = 'Administrador NexIoT'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE usuarios SET nombre_completo = 'Administrador NexIoT' "
            "WHERE nombre_completo = 'Administrador UDLAIoT'"
        )
    )
