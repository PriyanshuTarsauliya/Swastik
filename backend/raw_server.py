"""Swastik Healthcare — Gemini Live voice receptionist backend."""

import asyncio
import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

from backend.persona import SWASTIK_INSTRUCTION
from backend.tools import TOOL_DECLARATIONS, dispatch_tool

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("swastik-agent")

MODEL = os.getenv("LIVE_MODEL", "gemini-3.1-flash-live-preview")
VOICE = os.getenv("LIVE_VOICE", "Aoede")

client = genai.Client()  # reads GOOGLE_API_KEY + GOOGLE_GENAI_USE_VERTEXAI=FALSE from .env

LIVE_CONFIG = {
    "response_modalities": ["AUDIO"],
    "system_instruction": SWASTIK_INSTRUCTION,
    "input_audio_transcription": {},
    "output_audio_transcription": {},
    "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": VOICE}}},
    "tools": [{"function_declarations": TOOL_DECLARATIONS}],
}

app = FastAPI(title="Swastik Healthcare Voice Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
ASSETS = Path(__file__).resolve().parents[1] / "assets"


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    log.info("ws connected; opening Live session (model=%s, voice=%s)", MODEL, VOICE)
    try:
        async with client.aio.live.connect(model=MODEL, config=LIVE_CONFIG) as session:
            log.info("Live session open for Swastik Healthcare")

            async def upstream():
                while True:
                    try:
                        msg = await asyncio.wait_for(websocket.receive(), timeout=300.0)
                    except asyncio.TimeoutError:
                        log.warning("upstream: no input for 5 minutes, closing session due to inactivity")
                        return
                        
                    if msg.get("type") == "websocket.disconnect":
                        log.info("upstream: browser disconnected")
                        return
                    raw = msg.get("bytes")
                    if raw:
                        await session.send_realtime_input(
                            audio=types.Blob(data=raw, mime_type="audio/pcm;rate=16000"))

            async def handle(response):
                sc = getattr(response, "server_content", None)
                tc = getattr(response, "tool_call", None)
                if sc is not None:
                    it = getattr(sc, "input_transcription", None)
                    ot = getattr(sc, "output_transcription", None)
                    mt = getattr(sc, "model_turn", None)
                    if it and getattr(it, "text", None):
                        await websocket.send_text(json.dumps({"type": "transcript", "role": "user", "text": it.text}))
                    if ot and getattr(ot, "text", None):
                        await websocket.send_text(json.dumps({"type": "transcript", "role": "swastik", "text": ot.text}))
                    if mt and getattr(mt, "parts", None):
                        for part in mt.parts:
                            idata = getattr(part, "inline_data", None)
                            if idata and getattr(idata, "data", None):
                                await websocket.send_bytes(idata.data)  # 24k voice
                    if getattr(sc, "interrupted", None):
                        await websocket.send_text(json.dumps({"type": "interrupted"}))
                if tc:
                    results = []
                    for fc in tc.function_calls:
                        cmd, result = dispatch_tool(fc.name, dict(getattr(fc, "args", None) or {}))
                        if cmd:
                            await websocket.send_text(json.dumps({"type": "tool_action", **cmd}))
                        results.append(types.FunctionResponse(id=fc.id, name=fc.name, response=result))
                    await session.send_tool_response(function_responses=results)

            async def downstream():
                empty = 0
                while True:
                    got = 0
                    try:
                        async for response in session.receive():
                            got += 1
                            await handle(response)
                    except Exception:
                        log.exception("downstream: receive() raised — ending")
                        return
                    if got == 0:
                        empty += 1
                        if empty >= 2:
                            log.info("downstream: receive() empty %dx — session closed, ending", empty)
                            return
                    else:
                        empty = 0

            up = asyncio.create_task(upstream(), name="upstream")
            down = asyncio.create_task(downstream(), name="downstream")
            done, pending = await asyncio.wait({up, down}, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                exc = t.exception()
                if exc:
                    log.exception("%s task FAILED: %r", t.get_name(), exc, exc_info=exc)
                    try:
                        await websocket.send_text(json.dumps({"type": "error", "message": f"{type(exc).__name__}: {exc}"}))
                    except Exception:
                        pass
                else:
                    log.info("%s task ended -> tearing down", t.get_name())
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
    except WebSocketDisconnect:
        log.info("ws disconnected")
    except Exception as e:
        log.exception("ws handler error")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": f"{type(e).__name__}: {e}"}))
        except Exception:
            pass
    log.info("ws closed")


@app.post("/upload-receipt")
async def upload_receipt(file: UploadFile = File(...)):
    """Accept a payment screenshot, verify it with Gemini Vision."""
    import base64

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB limit
        return JSONResponse({"verified": False, "reason": "File too large (max 10 MB)"}, status_code=400)

    b64 = base64.b64encode(contents).decode("utf-8")
    mime = file.content_type or "image/png"

    upi_id = os.getenv("UPI_ID", "6387831138-2@ibl")
    payee_name = os.getenv("UPI_PAYEE_NAME", "Dr Gunja Gupta")

    verification_prompt = f"""You are a payment receipt verification assistant.
Analyze this UPI payment screenshot and extract the following details:
1. Transaction status (Success / Failed / Pending)
2. Amount paid (in INR)
3. Payee name or UPI ID
4. UPI Transaction Reference Number (UTR / Ref ID) if visible
5. Date and time of transaction if visible

The expected payment is:
- Amount: ₹499
- Accepted Payee UPI IDs / Names: {upi_id}, priyanshu@upi, {payee_name}, Priyanshu

Respond ONLY in this exact JSON format, no extra text:
{{{{
  "verified": true or false,
  "status": "Success" or "Failed" or "Pending" or "Unreadable",
  "amount": "extracted amount or null",
  "payee": "extracted payee name/UPI ID or null",
  "utr": "extracted UTR/reference number or null",
  "timestamp": "extracted date-time or null",
  "reason": "brief explanation of verification result"
}}}}

Set verified=true ONLY if:
- Status is "Success"
- Amount is ₹499 (or very close, e.g. 499.00)
- Payee matches any of "{payee_name}", "{upi_id}", "priyanshu@upi", or "Priyanshu" (partial match is OK)
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=contents, mime_type=mime),
                verification_prompt,
            ],
        )
        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]  # remove first line
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        import json as json_mod
        result = json_mod.loads(raw_text)
        log.info(f"Receipt verification result: {result}")
        return JSONResponse(result)
    except Exception as e:
        log.exception("Receipt verification failed")
        return JSONResponse(
            {"verified": False, "reason": f"Verification error: {str(e)}"},
            status_code=500,
        )


if ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS)), name="assets")
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")
