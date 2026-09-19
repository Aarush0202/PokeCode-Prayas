import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


class DemoRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500, json_schema_extra={"example": "Hello from hackathon!"})
    tag: Optional[str] = Field(default="general", json_schema_extra={"example": "ai-feature"})


class DemoResponse(BaseModel):
    id: str
    original_message: str
    processed_message: str
    tag: str
    word_count: int
    char_count: int
    timestamp: str


@router.get("/demo/sample", response_model=List[DemoResponse], tags=["Demo"])
async def get_sample_data():
    """Returns sample starter items for rapid hackathon testing."""
    return [
        DemoResponse(
            id="sample-1",
            original_message="Deploying PokeCode to production!",
            processed_message="DEPLOYING POKECODE TO PRODUCTION!",
            tag="deployment",
            word_count=4,
            char_count=35,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        ),
        DemoResponse(
            id="sample-2",
            original_message="Hackathon full-stack pipeline connected.",
            processed_message="HACKATHON FULL-STACK PIPELINE CONNECTED.",
            tag="pipeline",
            word_count=4,
            char_count=42,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        ),
    ]


@router.post("/demo/process", response_model=DemoResponse, status_code=status.HTTP_201_CREATED, tags=["Demo"])
async def process_demo_message(payload: DemoRequest):
    """Demo endpoint that processes text and returns structured analysis."""
    if not payload.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty or whitespace only",
        )

    words = payload.message.strip().split()
    return DemoResponse(
        id=f"demo-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        original_message=payload.message,
        processed_message=payload.message.upper(),
        tag=payload.tag or "general",
        word_count=len(words),
        char_count=len(payload.message),
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )
