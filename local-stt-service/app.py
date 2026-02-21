import logging
import os
import re
import time
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

import torch
import whisper
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


logging.basicConfig(
	level=logging.INFO,
	format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("stt-service")

BASE_DIR = Path(__file__).resolve().parent
TRANSCRIPTS_DIR = BASE_DIR / "transcripts"
WHISPER_MODEL_NAME = "base"
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto").lower()
MAX_AUDIO_FILE_SIZE_MB = int(os.getenv("MAX_AUDIO_FILE_SIZE_MB", "200"))
MAX_AUDIO_FILE_SIZE_BYTES = MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024
MAX_CONCURRENT_TRANSCRIPTIONS = int(os.getenv("MAX_CONCURRENT_TRANSCRIPTIONS", str(max(os.cpu_count() or 1, 2))))
transcription_semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRANSCRIPTIONS)
WHISPER_MODEL = None
ACTIVE_WHISPER_DEVICE = "cpu"


class TranscribeRequest(BaseModel):
	meetingId: str = Field(..., min_length=1)
	audioFilePath: str = Field(..., min_length=1)


def _sanitize_meeting_id(meeting_id: str) -> str:
	sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", meeting_id.strip())
	return sanitized or "meeting"


def _resolve_whisper_device() -> str:
	if WHISPER_DEVICE in {"cpu", "cuda"}:
		return WHISPER_DEVICE

	if torch.cuda.is_available():
		return "cuda"

	return "cpu"


@asynccontextmanager
async def lifespan(app: FastAPI):
	global WHISPER_MODEL
	global ACTIVE_WHISPER_DEVICE

	ACTIVE_WHISPER_DEVICE = _resolve_whisper_device()
	logger.info("Model loading started: whisper '%s' on device '%s'", WHISPER_MODEL_NAME, ACTIVE_WHISPER_DEVICE)
	WHISPER_MODEL = whisper.load_model(WHISPER_MODEL_NAME, device=ACTIVE_WHISPER_DEVICE)
	logger.info("Model loading completed: whisper '%s' on device '%s'", WHISPER_MODEL_NAME, ACTIVE_WHISPER_DEVICE)
	yield


app = FastAPI(
	title="Local STT Service",
	lifespan=lifespan,
	docs_url=None if os.getenv("ENV", "production").lower() == "production" else "/docs",
	redoc_url=None if os.getenv("ENV", "production").lower() == "production" else "/redoc",
)


@app.post("/transcribe")
async def transcribe(request: TranscribeRequest):
	audio_path = Path(request.audioFilePath).expanduser().resolve()
	if not audio_path.exists() or not audio_path.is_file():
		raise HTTPException(
			status_code=400,
			detail=f"Audio file not found: {audio_path}",
		)

	file_size_bytes = audio_path.stat().st_size
	if file_size_bytes > MAX_AUDIO_FILE_SIZE_BYTES:
		raise HTTPException(
			status_code=413,
			detail=(
				f"Audio file is too large ({file_size_bytes} bytes). "
				f"Maximum allowed size is {MAX_AUDIO_FILE_SIZE_BYTES} bytes."
			),
		)

	try:
		logger.info(
			"Transcription start | meetingId=%s | audioFilePath=%s | sizeBytes=%s",
			request.meetingId,
			str(audio_path),
			file_size_bytes,
		)

		if WHISPER_MODEL is None:
			raise HTTPException(status_code=503, detail="Whisper model is not loaded yet.")

		start_time = time.perf_counter()
		async with transcription_semaphore:
			result = await asyncio.to_thread(
				WHISPER_MODEL.transcribe,
				str(audio_path),
				fp16=ACTIVE_WHISPER_DEVICE == "cuda",
			)
		duration_seconds = time.perf_counter() - start_time
		transcript = (result.get("text") or "").strip()

		if not transcript:
			raise HTTPException(
				status_code=500,
				detail="Transcription completed but returned empty text.",
			)

		TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
		safe_meeting_id = _sanitize_meeting_id(request.meetingId)
		output_file = TRANSCRIPTS_DIR / f"meeting_{safe_meeting_id}.txt"
		output_file.write_text(transcript, encoding="utf-8")

		logger.info(
			"Transcription completion | meetingId=%s | output=%s | durationSeconds=%.2f | device=%s",
			request.meetingId,
			str(output_file),
			duration_seconds,
			ACTIVE_WHISPER_DEVICE,
		)

		return {
			"success": True,
			"transcript": transcript,
		}
	except HTTPException:
		raise
	except Exception as exc:
		logger.exception("Transcription failed | meetingId=%s", request.meetingId)
		raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
