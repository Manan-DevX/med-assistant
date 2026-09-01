from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, verify_password
from app.database import get_db
from app.deps import get_the_elder
from app.models import Caregiver, Elder
from app.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest, db: Session = Depends(get_db), elder: Elder = Depends(get_the_elder)
) -> LoginResponse:
    caregiver = db.execute(
        select(Caregiver).where(Caregiver.email == payload.email)
    ).scalars().first()

    if caregiver is None or not verify_password(payload.password, caregiver.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(caregiver.id)
    return LoginResponse(
        access_token=token,
        caregiver_name=caregiver.name,
        elder_id=elder.id,
        elder_name=elder.name,
    )
