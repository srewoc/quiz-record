"""remove sub subject prefixes

Revision ID: 20260425_0004
Revises: 20260425_0003
Create Date: 2026-04-25 15:10:00
"""

from __future__ import annotations

from alembic import op

revision = "20260425_0004"
down_revision = "20260425_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_questions_subject_consistency", "questions", type_="check")
    op.drop_constraint("ck_questions_sub_subject", "questions", type_="check")

    op.execute(
        """
        UPDATE questions
        SET sub_subject = CASE sub_subject
            WHEN '数学-高数' THEN '高数'
            WHEN '数学-线代' THEN '线代'
            WHEN '数学-概率论' THEN '概率论'
            WHEN '408-数据结构' THEN '数据结构'
            WHEN '408-计组' THEN '计组'
            WHEN '408-操作系统' THEN '操作系统'
            WHEN '408-计网' THEN '计网'
            ELSE sub_subject
        END
        """
    )

    op.create_check_constraint(
        "ck_questions_sub_subject",
        "questions",
        "sub_subject IN ('高数', '线代', '概率论', '数据结构', '计组', '操作系统', '计网')",
    )
    op.create_check_constraint(
        "ck_questions_subject_consistency",
        "questions",
        "(main_subject = '数学' AND sub_subject IN ('高数', '线代', '概率论')) "
        "OR "
        "(main_subject = '408' AND sub_subject IN ('数据结构', '计组', '操作系统', '计网'))",
    )


def downgrade() -> None:
    op.drop_constraint("ck_questions_subject_consistency", "questions", type_="check")
    op.drop_constraint("ck_questions_sub_subject", "questions", type_="check")

    op.execute(
        """
        UPDATE questions
        SET sub_subject = CASE
            WHEN main_subject = '数学' AND sub_subject = '高数' THEN '数学-高数'
            WHEN main_subject = '数学' AND sub_subject = '线代' THEN '数学-线代'
            WHEN main_subject = '数学' AND sub_subject = '概率论' THEN '数学-概率论'
            WHEN main_subject = '408' AND sub_subject = '数据结构' THEN '408-数据结构'
            WHEN main_subject = '408' AND sub_subject = '计组' THEN '408-计组'
            WHEN main_subject = '408' AND sub_subject = '操作系统' THEN '408-操作系统'
            WHEN main_subject = '408' AND sub_subject = '计网' THEN '408-计网'
            ELSE sub_subject
        END
        """
    )

    op.create_check_constraint(
        "ck_questions_sub_subject",
        "questions",
        "sub_subject IN ('数学-高数', '数学-线代', '数学-概率论', "
        "'408-数据结构', '408-计组', '408-操作系统', '408-计网')",
    )
    op.create_check_constraint(
        "ck_questions_subject_consistency",
        "questions",
        "(main_subject = '数学' AND sub_subject IN ('数学-高数', '数学-线代', '数学-概率论')) "
        "OR "
        "(main_subject = '408' AND sub_subject IN "
        "('408-数据结构', '408-计组', '408-操作系统', '408-计网'))",
    )
