from typing import TypeVar

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.models import Elder

ModelT = TypeVar("ModelT", bound=Base)


def get_the_elder(db: Session = Depends(get_db)) -> Elder:
    """Single-elder MVP: there is exactly one Elder row, created by app.seed on startup."""
    elder = db.execute(select(Elder)).scalars().first()
    if elder is None:
        raise HTTPException(status_code=500, detail="No elder seeded yet — restart the backend.")
    return elder


def get_owned_or_404(
    db: Session, model: type[ModelT], obj_id: int, elder_id: int, detail: str
) -> ModelT:
    """Fetch a row by id, 404ing both when it's missing and when it belongs to another elder.

    The elder check is inert while there's only one Elder, but it keeps id-guessing from
    reaching another elder's data the moment a second one exists.
    """
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "elder_id", elder_id) != elder_id:
        raise HTTPException(status_code=404, detail=detail)
    return obj
