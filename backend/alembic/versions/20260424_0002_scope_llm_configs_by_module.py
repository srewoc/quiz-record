"""scope llm configs by module

Revision ID: 20260424_0002
Revises: 20260422_0001
Create Date: 2026-04-24 18:40:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260424_0002"
down_revision = "20260422_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "llm_configs",
        sa.Column(
            "module_type",
            sa.String(length=32),
            nullable=False,
            server_default="question_analysis",
        ),
    )
    op.create_check_constraint(
        "ck_llm_configs_module_type",
        "llm_configs",
        "module_type IN ('ocr', 'question_analysis')",
    )
    op.alter_column("llm_configs", "module_type", server_default=None)
    op.create_index("idx_llm_configs_module_type", "llm_configs", ["module_type"], unique=False)
    op.execute("DROP INDEX IF EXISTS uq_llm_configs_single_active")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_llm_configs_active_per_module
        ON llm_configs (module_type)
        WHERE is_active = true
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_llm_configs_active_per_module")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_llm_configs_single_active
        ON llm_configs ((is_active))
        WHERE is_active = true
        """
    )
    op.drop_index("idx_llm_configs_module_type", table_name="llm_configs")
    op.drop_constraint("ck_llm_configs_module_type", "llm_configs", type_="check")
    op.drop_column("llm_configs", "module_type")
