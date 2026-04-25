from collections.abc import Sequence
from math import ceil
from typing import Any


def success_response(data: Any, message: str = "success") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def paginated_response(
    *,
    items: Sequence[Any],
    page: int,
    page_size: int,
    total: int,
    message: str = "success",
) -> dict[str, Any]:
    total_pages = ceil(total / page_size) if page_size > 0 else 0
    return success_response(
        {
            "items": list(items),
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            },
        },
        message=message,
    )
