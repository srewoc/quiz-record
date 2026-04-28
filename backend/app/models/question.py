from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint("main_subject IN ('数学', '408')", name="ck_questions_main_subject"),
        CheckConstraint(
            "sub_subject IN ('高数', '线代', '概率论', "
            "'数据结构', '计组', '操作系统', '计网')",
            name="ck_questions_sub_subject",
        ),
        CheckConstraint(
            "(main_subject = '数学' AND sub_subject IN ('高数', '线代', '概率论')) "
            "OR "
            "(main_subject = '408' AND sub_subject IN "
            "('数据结构', '计组', '操作系统', '计网'))",
            name="ck_questions_subject_consistency",
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    main_subject: Mapped[str] = mapped_column(String(32), nullable=False)
    sub_subject: Mapped[str] = mapped_column(String(64), nullable=False)
    is_wrong: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
