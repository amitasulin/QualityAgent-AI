"""Shared helpers for list endpoints."""
from typing import Any, Mapping, Optional, Sequence, Union

from sqlalchemy import asc, desc


def apply_sorting(
    query,
    columns: Mapping[str, Any],
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
    default_order: Optional[Union[Any, Sequence[Any]]] = None,
):
    """Apply a whitelisted ORDER BY clause to a select query.

    Only columns present in ``columns`` may be used, so user supplied values
    can never reach arbitrary model attributes. Rows are always ordered with
    NULLs last, and a stable ``created_at DESC`` tie-breaker is added so
    pagination does not repeat or skip rows.
    """
    column = columns.get(sort_by) if sort_by else None

    if column is None:
        if default_order is None:
            return query
        if isinstance(default_order, (list, tuple)):
            return query.order_by(*default_order)
        return query.order_by(default_order)

    expression = asc(column) if (sort_order or "desc").lower() == "asc" else desc(column)
    query = query.order_by(expression.nullslast())

    created_at = columns.get("created_at")
    if created_at is not None and column is not created_at:
        query = query.order_by(desc(created_at))

    return query
