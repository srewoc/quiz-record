"""init schema

Revision ID: 20260422_0001
Revises:
Create Date: 2026-04-22 20:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260422_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "questions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("main_subject", sa.String(length=32), nullable=False),
        sa.Column("sub_subject", sa.String(length=64), nullable=False),
        sa.Column("is_wrong", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("reference_answer", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "main_subject IN ('数学', '408')",
            name="ck_questions_main_subject",
        ),
        sa.CheckConstraint(
            "sub_subject IN ('高数', '线代', '概率论', "
            "'数据结构', '计组', '操作系统', '计网')",
            name="ck_questions_sub_subject",
        ),
        sa.CheckConstraint(
            "(main_subject = '数学' AND sub_subject IN ('高数', '线代', '概率论')) "
            "OR "
            "(main_subject = '408' AND sub_subject IN "
            "('数据结构', '计组', '操作系统', '计网'))",
            name="ck_questions_subject_consistency",
        ),
    )

    op.create_table(
        "llm_configs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("config_name", sa.String(length=128), nullable=False),
        sa.Column("provider_type", sa.String(length=32), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("provider_type IN ('openai')", name="ck_llm_configs_provider_type"),
    )

    op.execute(
        """
        CREATE INDEX idx_questions_question_text_trgm
        ON questions
        USING gin (question_text gin_trgm_ops)
        """
    )
    op.create_index(
        "idx_questions_updated_at",
        "questions",
        ["updated_at"],
        unique=False,
    )
    op.create_index(
        "idx_questions_main_subject",
        "questions",
        ["main_subject"],
        unique=False,
    )
    op.create_index(
        "idx_questions_sub_subject",
        "questions",
        ["sub_subject"],
        unique=False,
    )
    op.create_index(
        "idx_questions_is_wrong",
        "questions",
        ["is_wrong"],
        unique=False,
    )
    op.create_index("idx_llm_configs_updated_at", "llm_configs", ["updated_at"], unique=False)
    op.create_index("idx_llm_configs_provider_type", "llm_configs", ["provider_type"], unique=False)
    op.execute(
        """
        CREATE UNIQUE INDEX uq_llm_configs_single_active
        ON llm_configs ((is_active))
        WHERE is_active = true
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_llm_configs_single_active")
    op.drop_index("idx_llm_configs_provider_type", table_name="llm_configs")
    op.drop_index("idx_llm_configs_updated_at", table_name="llm_configs")
    op.drop_table("llm_configs")

    op.drop_index("idx_questions_is_wrong", table_name="questions")
    op.drop_index("idx_questions_sub_subject", table_name="questions")
    op.drop_index("idx_questions_main_subject", table_name="questions")
    op.drop_index("idx_questions_updated_at", table_name="questions")
    op.execute("DROP INDEX IF EXISTS idx_questions_question_text_trgm")
    op.drop_table("questions")
