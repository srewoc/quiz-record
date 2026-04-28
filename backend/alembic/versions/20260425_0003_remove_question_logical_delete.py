"""remove question logical delete

Revision ID: 20260425_0003
Revises: 20260424_0002
Create Date: 2026-04-25 13:15:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260425_0003"
down_revision = "20260424_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM questions WHERE is_deleted = true")

    op.drop_index("idx_questions_is_wrong", table_name="questions")
    op.drop_index("idx_questions_sub_subject", table_name="questions")
    op.drop_index("idx_questions_main_subject", table_name="questions")
    op.drop_index("idx_questions_updated_at", table_name="questions")
    op.execute("DROP INDEX IF EXISTS idx_questions_question_text_trgm")

    op.drop_column("questions", "is_deleted")

    op.execute(
        """
        CREATE INDEX idx_questions_question_text_trgm
        ON questions
        USING gin (question_text gin_trgm_ops)
        """
    )
    op.create_index("idx_questions_updated_at", "questions", ["updated_at"], unique=False)
    op.create_index("idx_questions_main_subject", "questions", ["main_subject"], unique=False)
    op.create_index("idx_questions_sub_subject", "questions", ["sub_subject"], unique=False)
    op.create_index("idx_questions_is_wrong", "questions", ["is_wrong"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_questions_is_wrong", table_name="questions")
    op.drop_index("idx_questions_sub_subject", table_name="questions")
    op.drop_index("idx_questions_main_subject", table_name="questions")
    op.drop_index("idx_questions_updated_at", table_name="questions")
    op.execute("DROP INDEX IF EXISTS idx_questions_question_text_trgm")

    op.add_column(
        "questions",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.execute(
        """
        CREATE INDEX idx_questions_question_text_trgm
        ON questions
        USING gin (question_text gin_trgm_ops)
        WHERE is_deleted = false
        """
    )
    op.create_index(
        "idx_questions_updated_at",
        "questions",
        ["updated_at"],
        unique=False,
        postgresql_where=sa.text("is_deleted = false"),
    )
    op.create_index(
        "idx_questions_main_subject",
        "questions",
        ["main_subject"],
        unique=False,
        postgresql_where=sa.text("is_deleted = false"),
    )
    op.create_index(
        "idx_questions_sub_subject",
        "questions",
        ["sub_subject"],
        unique=False,
        postgresql_where=sa.text("is_deleted = false"),
    )
    op.create_index(
        "idx_questions_is_wrong",
        "questions",
        ["is_wrong"],
        unique=False,
        postgresql_where=sa.text("is_deleted = false"),
    )
