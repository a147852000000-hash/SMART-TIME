import base64
from threading import Lock
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

try:
    from voicetut_tts import VoiceTutTTS
except Exception as exc:
    VoiceTutTTS = None
    IMPORT_ERROR = str(exc)

app = FastAPI(title="SMART TIME Voice DNA — VoiceTuT Provider", version="0.1.0")

PROVIDER_TOKEN = os.getenv("SMART_VOICE_DNA_PROVIDER_TOKEN", "").strip()
MODEL_ID = os.getenv("SMART_VOICE_DNA_MODEL", "mohammedaly22/VoiceTut-TTS").strip()
MAX_REFERENCE_BYTES = int(os.getenv("SMART_VOICE_DNA_MAX_REFERENCE_BYTES", str(8 * 1024 * 1024)))
MAX_TEXT_CHARS = int(os.getenv("SMART_VOICE_DNA_MAX_TEXT_CHARS", "4000"))

_tts = None
synthesis_lock = Lock()


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: str = "ar"
    locale: str = "ar-EG"
    profileId: str = Field(min_length=1, max_length=180)
    referenceAudioBase64: str = ""
    referenceMimeType: str = "audio/webm"
    speaker: str = ""
    referenceText: str = ""
    speakingStyle: str = "natural"


def _authorize(auth: str | None) -> None:
    if not PROVIDER_TOKEN:
        raise HTTPException(status_code=503, detail="Provider authentication is not configured.")
    expected = "Bearer " + PROVIDER_TOKEN
    if auth != expected:
        raise HTTPException(status_code=401, detail="Unauthorized.")


def _get_tts():
    global _tts
    if _tts is not None:
        return _tts
    if VoiceTutTTS is None:
        raise HTTPException(status_code=503, detail=f"VoiceTuT-TTS unavailable: {IMPORT_ERROR}")
    _tts = VoiceTutTTS.from_pretrained(MODEL_ID)
    return _tts


@app.get("/health")
def health():
    return {
        "ok": True,
        "provider": "voicetut-tts",
        "model": MODEL_ID,
        "engineLoaded": _tts is not None,
    }


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest, authorization: str | None = Header(default=None)):
    _authorize(authorization)
    if len(payload.text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail="Text is too long.")

    reference_audio = b""
    if payload.referenceAudioBase64.strip():
        try:
            reference_audio = base64.b64decode(payload.referenceAudioBase64, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid reference audio encoding.")

    if not reference_audio and not payload.speaker.strip():
        raise HTTPException(status_code=400, detail="Either reference audio or an approved built-in speaker is required.")
    if len(reference_audio) > MAX_REFERENCE_BYTES:
        raise HTTPException(status_code=413, detail="Reference audio is too large.")

    suffix_map = {
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/ogg": ".ogg",
        "audio/webm": ".webm",
        "audio/webm;codecs=opus": ".webm",
    }
    suffix = suffix_map.get(payload.referenceMimeType.lower(), ".bin")

    try:
        tts = _get_tts()
        with tempfile.TemporaryDirectory(prefix="smart-time-voice-") as tmp:
            tmp_path = Path(tmp)
            out_path = tmp_path / "output.wav"

            kwargs = {"output": str(out_path)}
            if reference_audio:
                ref_path = tmp_path / ("reference" + suffix)
                ref_path.write_bytes(reference_audio)
                kwargs["ref_audio"] = str(ref_path)
            elif payload.speaker.strip():
                allowed_speakers = {
                    "Abdelrahman", "Abdullah", "Kamal", "Hossam", "Mohamed",
                    "Omar", "Sayed", "Zaki", "Aly", "Essam", "Ahmed",
                    "Asmaa", "Esraa", "Hanan", "Sarah", "Yasmin", "Omnia",
                }
                if payload.speaker.strip() not in allowed_speakers:
                    raise HTTPException(status_code=400, detail="Unsupported built-in speaker.")
                kwargs["speaker"] = payload.speaker.strip()
            if payload.referenceText.strip():
                kwargs["ref_text"] = payload.referenceText.strip()

            with synthesis_lock:
                tts.synthesize(payload.text, **kwargs)
            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("VoiceTuT produced no audio.")

            audio_bytes = out_path.read_bytes()
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={
                    "X-SMART-VOICE-PROVIDER": "voicetut-tts",
                    "Cache-Control": "no-store",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Voice synthesis failed: {str(exc)[:300]}")
