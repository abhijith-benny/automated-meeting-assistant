<p align="center">
  <h1 align="center">🤖 Automated Meeting Assistant</h1>
  <p align="center">
    <strong>AI-powered meeting automation that joins, records, transcribes, and summarizes Google Meet sessions — entirely locally.</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/Whisper-OpenAI-412991?logo=openai&logoColor=white" alt="Whisper" />
    <img src="https://img.shields.io/badge/Ollama-Local%20LLM-000000?logo=ollama&logoColor=white" alt="Ollama" />
    <img src="https://img.shields.io/badge/Playwright-Automation-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
  </p>
</p>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Folder Structure](#-folder-structure)
- [Technologies Used](#-technologies-used)
- [Prerequisites](#-prerequisites)
- [Installation Instructions](#-installation-instructions)
- [How to Run the Full System](#-how-to-run-the-full-system)
- [Audio Configuration Details](#-audio-configuration-details)
- [Whisper Configuration Details](#-whisper-configuration-details)
- [NLP Service Details](#-nlp-service-details)
- [API Endpoints](#-api-endpoints)
- [Example Workflow](#-example-workflow)
- [Frontend UI](#-frontend-ui)
- [Offline Pipeline (CLI)](#-offline-pipeline-cli)
- [Testing](#-testing)
- [Troubleshooting Guide](#-troubleshooting-guide)
---

## 🌟 Project Overview

The **Automated Meeting Assistant** is a fully local, privacy-first AI system that automates the entire lifecycle of a Google Meet session:

1. **Joins** a Google Meet call automatically using Playwright + Brave Browser.
2. **Records** system audio in real time using `ffmpeg` and PulseAudio monitor source.
3. **Converts** the recorded audio to a Whisper-optimized format (16 kHz, mono, PCM 16-bit).
4. **Transcribes** speech-to-text using a locally running OpenAI Whisper model via FastAPI.
5. **Summarizes** the transcript and extracts structured meeting intelligence using a local LLM (Ollama).
6. **Outputs** structured JSON containing:
   - 📝 Cleaned transcript
   - 📄 Concise meeting summary
   - ✅ Action items with responsible persons and deadlines
   - 📅 Important dates and milestones

All processing happens **on your machine** — no audio or text is sent to external cloud services (unless you explicitly opt for the cloud STT alternative).

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔒 **Privacy-First** | All transcription and summarization runs locally — your meeting data never leaves your machine |
| 🤖 **Fully Automated** | Joins the meeting, records, transcribes, and summarizes — zero manual intervention |
| 🎙️ **System Audio Capture** | Records what you *hear* (system audio), not microphone input |
| 🧠 **Local LLM Summarization** | Uses Ollama with phi/mistral models for intelligent summarization |
| 🗣️ **Whisper STT** | Accurate speech-to-text using OpenAI's Whisper model running locally |
| 🌐 **Web UI** | React-based frontend for joining/scheduling meetings and viewing results |
| 📊 **Structured Output** | JSON output with summary, action items, responsible persons, deadlines |
| ⏱️ **Meeting Scheduling** | Schedule meetings to auto-join at a specific time |
| 🔄 **Offline Pipeline** | CLI tool for processing pre-recorded audio files |
| ☁️ **Cloud STT Option** | Optional OpenAI API-based transcription as an alternative to local Whisper |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTOMATED MEETING ASSISTANT                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐   │
│   │   Frontend    │       │   Automation      │       │   PulseAudio     │   │
│   │   (React)     │──────▶│   Service         │──────▶│   Monitor        │   │
│   │   :3000       │  API  │   (Node.js)       │ Audio │   + ffmpeg       │   │
│   └──────────────┘       │   :4001            │       └────────┬─────────┘   │
│                           └────────┬───────────┘                │             │
│                                    │                            │             │
│                                    │ On meeting end             │ Records     │
│                                    ▼                            ▼             │
│                           ┌──────────────────┐       ┌──────────────────┐   │
│                           │   STT Client      │       │ logs/recordings/ │   │
│                           │   (sttClient.js)  │       │   .wav files     │   │
│                           └────────┬───────────┘       └────────┬─────────┘   │
│                                    │                            │             │
│                    ┌───────────────┼────────────────────────────┘             │
│                    │               │                                          │
│                    ▼               ▼                                          │
│   ┌──────────────────┐   ┌──────────────────┐                               │
│   │  Local STT        │   │  Cloud STT        │                               │
│   │  (FastAPI+Whisper)│   │  (OpenAI API)     │                               │
│   │  :6000            │   │  :5002            │                               │
│   └────────┬───────────┘   └────────┬───────────┘                               │
│            │                        │                                          │
│            └────────────┬───────────┘                                          │
│                         │  Transcript                                         │
│                         ▼                                                     │
│            ┌──────────────────┐       ┌──────────────────┐                   │
│            │   NLP Service     │──────▶│   Ollama          │                   │
│            │   (Node.js)       │  API  │   (Local LLM)     │                   │
│            │   :7000           │       │   :11434           │                   │
│            └────────┬───────────┘       └──────────────────┘                   │
│                     │                                                         │
│                     ▼                                                         │
│            ┌──────────────────┐                                               │
│            │  Structured JSON  │                                               │
│            │  Output           │                                               │
│            │  ┌─────────────┐  │                                               │
│            │  │ Summary     │  │                                               │
│            │  │ Action Items│  │                                               │
│            │  │ Deadlines   │  │                                               │
│            │  │ Dates       │  │                                               │
│            │  └─────────────┘  │                                               │
│            └──────────────────┘                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Google Meet → Brave Browser → PulseAudio Monitor → ffmpeg → .wav file
    → Whisper (local STT) → Raw Transcript
    → Ollama (local LLM) → Structured JSON (summary + action items + dates)
```

---

## 📁 Folder Structure

```
automated-meeting-assistant/
│
├── automation-service/          # 🤖 Browser automation + audio recording
│   ├── src/
│   │   ├── server.js            #    Express server (port 4001)
│   │   └── joinMeeting.js       #    Playwright meeting automation logic
│   ├── sttClient.js             #    STT + NLP pipeline trigger
│   ├── package.json             #    Node.js dependencies
│   └── logs/                    #    Service-level logs
│
├── local-stt-service/           # 🗣️ Local Whisper speech-to-text
│   ├── app.py                   #    FastAPI server (port 6000)
│   └── transcripts/             #    Saved transcript text files
│
├── nlp-service/                 # 🧠 LLM summarization via Ollama
│   ├── index.js                 #    Express server (port 7000)
│   ├── summarizer.js            #    Ollama integration + prompt engineering
│   ├── package.json             #    Node.js dependencies
│   └── transcripts/             #    Saved NLP analysis JSON files
│
├── stt-service/                 # ☁️ Cloud STT (OpenAI API) — alternative
│   ├── index.js                 #    Express server (port 5002)
│   ├── routes.js                #    API route definitions
│   ├── stt.controller.js        #    Request handler
│   ├── stt.service.js           #    OpenAI Whisper API integration
│   └── package.json             #    Node.js dependencies
│
├── frontend/                    # 🌐 React web interface
│   ├── src/
│   │   ├── App.jsx              #    Main app with routing
│   │   ├── main.jsx             #    Entry point
│   │   ├── styles.css           #    Global styles
│   │   ├── api/
│   │   │   └── meeting.js       #    API client for automation service
│   │   ├── components/          #    Reusable UI components
│   │   │   ├── AccountSelector.jsx
│   │   │   ├── ActionItemsViewer.jsx
│   │   │   ├── MeetingForm.jsx
│   │   │   ├── NavBar.jsx
│   │   │   ├── StartStopButtons.jsx
│   │   │   ├── StatusDisplay.jsx
│   │   │   ├── SummaryViewer.jsx
│   │   │   └── TranscriptViewer.jsx
│   │   └── pages/               #    Page-level components
│   │       ├── SchedulerForm.jsx
│   │       ├── MeetingsPage.jsx
│   │       └── MeetingDetails.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── app/                         # 🐍 Python offline pipeline module
│   ├── config.py                #    Centralized configuration
│   ├── transcriber.py           #    Whisper transcription logic
│   ├── summarizer.py            #    Ollama summarization logic
│   ├── storage.py               #    JSON result persistence
│   └── pipeline.py              #    End-to-end orchestrator
│
├── scripts/                     # 🛠️ Utility scripts
│   └── run_offline_test.py      #    CLI for offline audio processing
│
├── tests/                       # 🧪 Test suite
│   ├── conftest.py              #    Pytest fixtures
│   ├── test_pipeline.py         #    Pipeline unit & integration tests
│   └── recordings/              #    Test audio files (.wav)
│
├── logs/
│   └── recordings/              # 🎵 Recorded meeting audio files
│
├── output/                      # 📊 Offline pipeline JSON results
│
├── requirements.txt             # 🐍 Python dependencies
├── package.json                 # 📦 Root Node.js package
├── pytest.ini                   # 🧪 Pytest configuration
├── setup-and-run.ps1            # ⚙️ Windows setup & launch script
├── start.ps1                    # 🚀 Quick launcher script
└── README.md                    # 📖 This file
```

---

## 🛠️ Technologies Used

### Core Stack

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Backend services (automation, NLP, cloud STT) |
| **Python** | 3.10+ | Local STT service, offline pipeline |
| **React** | 18.x | Frontend web interface |
| **Vite** | 5.x | Frontend build tool |

### AI / ML

| Technology | Purpose |
|---|---|
| **OpenAI Whisper** | Local speech-to-text transcription |
| **Ollama** | Local LLM inference engine |
| **phi / mistral** | LLM models for summarization and extraction |
| **PyTorch** | Whisper model runtime (CPU / CUDA) |

### Browser Automation

| Technology | Purpose |
|---|---|
| **Playwright** | Browser automation library |
| **Brave Browser** | Chromium-based browser (uses persistent user profile) |
| **xvfb-run** | Virtual framebuffer for headless browser execution |

### Audio Processing

| Technology | Purpose |
|---|---|
| **ffmpeg** | Audio recording (PulseAudio source) and format conversion |
| **PulseAudio** | System audio capture via monitor source |

### Frameworks & Libraries

| Technology | Purpose |
|---|---|
| **Express.js** | REST API framework (Node.js services) |
| **FastAPI** | REST API framework (Python STT service) |
| **React Router** | Client-side routing |
| **Uvicorn** | ASGI server for FastAPI |

---

## 📋 Prerequisites

Before installing, ensure the following are available on your system:

### System Requirements

- **OS:** Linux (Ubuntu 20.04+ recommended)
- **RAM:** 8 GB minimum (16 GB recommended for `small` Whisper model)
- **GPU:** Optional — CUDA-compatible GPU for faster transcription
- **Disk:** ~5 GB for models and dependencies

### Required Software

```bash
# Node.js 18+
node --version    # v18.x or higher

# Python 3.10+
python3 --version # 3.10 or higher

# ffmpeg
ffmpeg -version

# PulseAudio
pulseaudio --check

# Brave Browser
brave-browser --version

# Ollama
ollama --version

# xvfb (for headless browser)
which xvfb-run
```

### Install Missing Dependencies (Ubuntu / Debian)

```bash
# System packages
sudo apt update && sudo apt install -y \
    ffmpeg \
    pulseaudio \
    xvfb \
    python3-pip \
    python3-venv \
    curl

# Brave Browser
sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg \
    https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] \
    https://brave-browser-apt-release.s3.brave.com/ stable main" | \
    sudo tee /etc/apt/sources.list.d/brave-browser-release.list
sudo apt update && sudo apt install -y brave-browser

# Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 18
```

---

## 📦 Installation Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/automated-meeting-assistant.git
cd automated-meeting-assistant
```

### 2. Install Python Dependencies

```bash
# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> **Note:** The first time Whisper runs, it will automatically download the model (~461 MB for `small`). Ensure you have internet access for this initial setup.

### 3. Install Node.js Dependencies

```bash
# Automation service
cd automation-service
npm install
npx playwright install chromium
cd ..

# NLP service
cd nlp-service
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# (Optional) Cloud STT service
cd stt-service
npm install
cd ..
```

### 4. Pull an Ollama Model

```bash
# Start Ollama (if not already running)
ollama serve

# Pull the phi model (lightweight, fast)
ollama pull phi

# Or pull mistral (more capable, requires more RAM)
ollama pull mistral
```

### 5. Verify PulseAudio Monitor Source

```bash
# List available audio sources
pactl list short sources

# Look for a line like:
# alsa_output.pci-0000_00_05.0.analog-stereo.monitor
```

> **Important:** The automation service uses `alsa_output.pci-0000_00_05.0.analog-stereo.monitor` as the audio input source. If your system has a different monitor source name, update it in `automation-service/src/joinMeeting.js`.

---

## 🚀 How to Run the Full System

### Service Overview

| Service | Port | Command |
|---|---|---|
| Ollama | `11434` | `ollama serve` |
| Local STT | `6000` | `uvicorn app:app --host 0.0.0.0 --port 6000` |
| NLP Service | `7000` | `node index.js` |
| Automation | `4001` | `node src/server.js` |
| Frontend | `3000` | `npm run dev` |

You will need **five separate terminal sessions** (or use `tmux` / background processes).

### Step 1: Start Ollama

```bash
# Terminal 1 — Start the Ollama server
ollama serve

# Verify it's running (from another terminal)
curl http://localhost:11434/api/tags
```

### Step 2: Start the Local STT Service

```bash
# Terminal 2
cd local-stt-service

# Activate Python virtual environment
source ../venv/bin/activate

# Start the FastAPI server
uvicorn app:app --host 0.0.0.0 --port 6000 --reload

# Verify it's running
# Open http://localhost:6000/docs in a browser for Swagger UI
```

> The first transcription request will trigger Whisper model download if not already cached.

### Step 3: Start the NLP Service

```bash
# Terminal 3
cd nlp-service

# Start the Express server
node index.js

# Expected output:
# NLP service listening on port 7000
```

**Verify:**
```bash
curl http://localhost:7000/health
```

### Step 4: Start the Automation Service

```bash
# Terminal 4
cd automation-service

# Start the Express server
node src/server.js

# Expected output:
# Automation service listening on port 4001
```

**Verify:**
```bash
curl http://localhost:4001/health
```

### Step 5: Start the Frontend

```bash
# Terminal 5
cd frontend

# Start the Vite dev server
npm run dev

# Expected output:
#   VITE v5.x.x  ready in xxx ms
#   ➜  Local:   http://localhost:3000/
```

### Step 6: Join a Meeting

**Option A — Via the Web UI:**

1. Open `http://localhost:3000` in your browser.
2. Paste a Google Meet link (e.g., `https://meet.google.com/abc-defg-hij`).
3. Click **"Join Now"** or schedule it for later.
4. The system will automatically join, record, transcribe, and summarize.

**Option B — Via the API directly:**

```bash
curl -X POST http://localhost:4001/api/meetings \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://meet.google.com/abc-defg-hij",
    "braveExecutable": "/usr/bin/brave-browser",
    "userDataDir": "/home/YOUR_USERNAME/.config/BraveSoftware/Brave-Browser/Default"
  }'
```

> **Important:** Ensure you are logged into Google in Brave Browser before running the automation. The service uses your existing browser profile (persistent cookies) to authenticate.

---

## 🎙️ Audio Configuration Details

### PulseAudio Monitor Source

The system captures **system audio** (what you hear through speakers/headphones) rather than microphone input. This is done via PulseAudio's **monitor source**.

#### How It Works

```
Google Meet Audio → PulseAudio Sink → Monitor Source → ffmpeg → .wav file
```

1. **PulseAudio Sink** — The audio output device (speakers/headphones).
2. **Monitor Source** — A virtual input that mirrors everything played through the sink.
3. **ffmpeg** — Reads from the monitor source and writes a WAV file.

#### The ffmpeg Recording Command

```bash
ffmpeg -f pulse \
  -i alsa_output.pci-0000_00_05.0.analog-stereo.monitor \
  -ac 1 \
  -ar 16000 \
  -c:a pcm_s16le \
  logs/recordings/meeting-<timestamp>.wav
```

| Parameter | Value | Purpose |
|---|---|---|
| `-f pulse` | — | Use PulseAudio as input format |
| `-i` | `alsa_output.pci-0000_00_05.0.analog-stereo.monitor` | PulseAudio monitor source name |
| `-ac 1` | Mono | Single audio channel (Whisper works best with mono) |
| `-ar 16000` | 16 kHz | Sample rate optimized for Whisper |
| `-c:a pcm_s16le` | PCM 16-bit | Uncompressed audio codec |

#### Finding Your Monitor Source

```bash
# List all PulseAudio sources
pactl list short sources

# Example output:
# 0  alsa_output.pci-0000_00_05.0.analog-stereo.monitor  module-alsa-card.c  s16le 2ch 44100Hz  RUNNING

# Or use pacmd for detailed info
pacmd list-sources | grep -e 'name:' -e 'index:'
```

If your monitor source name is different, update the PulseAudio monitor value in:

📍 `automation-service/src/joinMeeting.js` — look for the ffmpeg spawn command.

#### Verifying a Recorded Audio File

```bash
# Check audio file properties with full detail
ffprobe -v quiet -print_format json -show_format -show_streams \
  logs/recordings/meeting-1234567890.wav

# Expected output should show:
# codec_name: pcm_s16le
# sample_rate: 16000
# channels: 1
```

```bash
# Quick verification (one-liner)
ffprobe logs/recordings/meeting-1234567890.wav 2>&1 | grep -E "Stream|Duration"

# Expected:
# Duration: 00:05:23.45, bitrate: 256 kb/s
# Stream #0:0: Audio: pcm_s16le, 16000 Hz, mono, s16, 256 kb/s
```

---

## 🗣️ Whisper Configuration Details

### Model Selection

| Model | Parameters | VRAM | Relative Speed | English Accuracy |
|---|---|---|---|---|
| `tiny` | 39 M | ~1 GB | ~32x | Lowest |
| `base` | 74 M | ~1 GB | ~16x | Low |
| **`small`** | **244 M** | **~2 GB** | **~6x** | **Good (default)** |
| `medium` | 769 M | ~5 GB | ~2x | Better |
| `large` | 1550 M | ~10 GB | 1x | Best |

> The **`small`** model is the default for the local STT service — it provides a good balance of speed and accuracy for meeting transcription.

### Configuration via Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL_NAME` | `small` | Primary Whisper model |
| `WHISPER_MODEL_FALLBACK` | `base` | Fallback model (used on OOM errors) |
| `WHISPER_DEVICE` | `auto` | `cpu`, `cuda`, or `auto` (auto-detects GPU) |
| `MAX_AUDIO_FILE_SIZE_MB` | `200` | Maximum audio file size in MB |
| `MAX_CONCURRENT_TRANSCRIPTIONS` | `auto` | Semaphore limit (defaults to CPU count) |

### Transcription Settings

```python
model.transcribe(
    audio_path,
    language="en",       # English language
    fp16=False,          # Use FP32 (more compatible, slightly slower)
    temperature=0        # Deterministic output (no randomness)
)
```

### Audio Preprocessing

Before transcription, audio is automatically preprocessed via ffmpeg to ensure compatibility:

```bash
ffmpeg -y -i input.wav -ar 16000 -ac 1 -acodec pcm_s16le preprocessed.wav
```

This ensures the audio matches Whisper's expected format regardless of the original input format.

---

## 🧠 NLP Service Details

### Overview

The NLP service receives a raw transcript and produces structured meeting intelligence using a local LLM via Ollama.

### LLM Configuration

| Setting | Value |
|---|---|
| **Ollama URL** | `http://localhost:11434/api/generate` |
| **Default Model** | `phi` (or `mistral`) |
| **Timeout** | 180 seconds (3 minutes) |
| **Response Format** | JSON mode (`format: "json"`) |
| **Retries** | 2 attempts on failure |
| **Min Transcript Length** | 50 characters |

### Prompt Engineering

The NLP service uses a carefully crafted prompt that instructs the LLM to:

1. **Clean** minor transcription errors (stutters, repeated words).
2. **Summarize** the meeting in 3–6 concise sentences.
3. **Extract action items** with task description, responsible person, and deadline.
4. **Identify important dates** and milestones mentioned in the meeting.

### Output JSON Schema

```json
{
  "cleaned_transcript": "Full cleaned transcript text...",
  "summary": "Concise 3-6 sentence meeting summary...",
  "action_items": [
    {
      "task": "Complete the Q4 budget report",
      "responsible": "John",
      "deadline": "March 15, 2026"
    },
    {
      "task": "Schedule a follow-up meeting with the design team",
      "responsible": "Sarah",
      "deadline": "Next Monday"
    }
  ],
  "important_dates": [
    "March 15, 2026 — Q4 budget report deadline",
    "April 1, 2026 — Product launch date"
  ]
}
```

### Transcript Preprocessing Pipeline

Before sending to the LLM, the transcript undergoes preprocessing:

1. **Whitespace normalization** — collapses multiple spaces and newlines.
2. **Duplicate word removal** — removes repeated adjacent words (common in speech-to-text).
3. **Punctuation cleanup** — fixes spacing around punctuation marks.

---

## 📡 API Endpoints

### Automation Service (`:4001`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service status |
| `GET` | `/health` | Health check |
| `POST` | `/api/meetings` | Join a Google Meet session |

#### `POST /api/meetings`

**Request:**
```json
{
  "url": "https://meet.google.com/abc-defg-hij",
  "braveExecutable": "/usr/bin/brave-browser",
  "userDataDir": "/home/user/.config/BraveSoftware/Brave-Browser/Default"
}
```

**Response (`202 Accepted`):**
```json
{
  "started": true,
  "pid": 12345,
  "log": "logs/meeting-1234567890.log"
}
```

---

### Local STT Service (`:6000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/docs` | Interactive API documentation (Swagger UI) |
| `GET` | `/redoc` | API documentation (ReDoc format) |
| `POST` | `/transcribe` | Transcribe an audio file using Whisper |

#### `POST /transcribe`

**Request:**
```json
{
  "meetingId": "meeting-1234567890",
  "audioFilePath": "/absolute/path/to/recording.wav"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "transcript": "Hello everyone, welcome to today's meeting..."
}
```

**Error Responses:**

| Status | Cause |
|---|---|
| `404` | Audio file not found at the specified path |
| `413` | Audio file exceeds the 200 MB size limit |
| `500` | Internal transcription error |

---

### NLP Service (`:7000`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/summarize` | Summarize a transcript using Ollama LLM |

#### `POST /summarize`

**Request:**
```json
{
  "transcript": "Full meeting transcript text..."
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "result": {
    "cleaned_transcript": "Cleaned version of the transcript...",
    "summary": "The team discussed Q4 goals and agreed on...",
    "action_items": [
      {
        "task": "Prepare the budget report",
        "responsible": "Alice",
        "deadline": "March 10"
      }
    ],
    "important_dates": [
      "March 10 — Budget report due"
    ]
  }
}
```

---

### Cloud STT Service (`:5002`) — Optional

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/stt/transcribe` | Transcribe audio via OpenAI API |

#### `POST /api/stt/transcribe`

**Request:**
```json
{
  "meetingId": "meeting-1234567890",
  "audioFilePath": "/absolute/path/to/recording.wav"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "transcript": "Transcribed text...",
  "summary": { "..." },
  "summaryError": null
}
```

> **Note:** Requires `OPENAI_API_KEY` environment variable. Uses the `gpt-4o-transcribe` model.

---

## 📐 Example Workflow

### End-to-End Meeting Processing

```
 1. User opens http://localhost:3000
                  │
                  ▼
 2. Pastes Google Meet link → Clicks "Join Now"
                  │
                  ▼
 3. Frontend sends POST /api/meetings to automation-service (:4001)
                  │
                  ▼
 4. Playwright launches Brave Browser (with user's Google profile)
                  │
                  ▼
 5. Bot navigates to Google Meet → disables camera/mic → clicks "Join"
                  │
                  ▼
 6. ffmpeg starts recording system audio via PulseAudio monitor
    └── Output: logs/recordings/meeting-<id>.wav (16kHz, mono, PCM)
                  │
                  ▼
 7. Meeting proceeds... (bot waits for meeting to end)
                  │
                  ▼
 8. Meeting ends → ffmpeg receives SIGINT → recording stops
                  │
                  ▼
 9. sttClient.js sends audio path to local-stt-service (:6000)
    └── Whisper (small model) transcribes audio → returns text
                  │
                  ▼
10. sttClient.js sends transcript to nlp-service (:7000)
    └── Ollama (phi model) generates summary + action items
                  │
                  ▼
11. Results saved to nlp-service/transcripts/meeting_<id>.json
                  │
                  ▼
12. User views results in the frontend:
    ├── 📝 Full transcript
    ├── 📄 AI-generated summary
    ├── ✅ Action items with owners & deadlines
    └── 📅 Important dates
```

### Sample Output JSON

```json
{
  "meeting_id": "meeting-1771823230527",
  "created_at": "20260224T103045Z",
  "transcript": "Hello everyone, welcome to the weekly standup...",
  "cleaned_transcript": "Hello everyone, welcome to the weekly standup...",
  "summary": "The team discussed progress on the Q1 product roadmap. Backend API migration is 80% complete and on track for the March 15 deadline. The design team presented new mockups for the onboarding flow. Two critical bugs were identified in the payment module that need immediate attention.",
  "action_items": [
    {
      "task": "Fix payment module bugs",
      "responsible": "David",
      "deadline": "February 28, 2026"
    },
    {
      "task": "Complete API migration to v2",
      "responsible": "Backend Team",
      "deadline": "March 15, 2026"
    },
    {
      "task": "Review and approve onboarding mockups",
      "responsible": "Sarah",
      "deadline": "Next Wednesday"
    }
  ],
  "important_dates": [
    "February 28, 2026 — Payment bug fix deadline",
    "March 15, 2026 — API v2 migration deadline",
    "April 1, 2026 — Q2 planning kickoff"
  ]
}
```

---

## 🌐 Frontend UI

The web interface is built with **React 18** and **Vite**, providing a clean, modern UI for managing meetings.

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | **Scheduler** | Enter a Google Meet link, join instantly or schedule for later |
| `/meetings` | **Meetings** | View all scheduled and completed meetings |
| `/meeting/:id` | **Meeting Details** | View transcript, summary, and action items |

### Features

- **Instant Join** — Paste a Meet link and join immediately with one click.
- **Meeting Scheduling** — Schedule a meeting to auto-join at a specific date/time with a live countdown timer.
- **Meeting History** — Browse past meetings stored in local storage.
- **Meeting Insights** — Generate and view AI-powered summaries, action items, and full transcripts.
- **Status Tracking** — Real-time status display (idle → joining → active → ended).
- **Responsive Design** — Clean, card-based UI with CSS custom properties.

### Running the Frontend

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

---

## 🐍 Offline Pipeline (CLI)

For processing pre-recorded audio files without running the full web service stack:

### Basic Usage

```bash
# Activate virtual environment
source venv/bin/activate

# Process an audio file
python scripts/run_offline_test.py path/to/recording.wav
```

### Advanced Options

```bash
# Custom meeting ID and output directory
python scripts/run_offline_test.py recording.wav \
  --meeting-id "standup-2026-02-24" \
  --output-dir ./results

# Use a different Whisper model
python scripts/run_offline_test.py recording.wav \
  --whisper-model medium \
  --whisper-device cuda

# Use a different Ollama model
python scripts/run_offline_test.py recording.wav \
  --ollama-model mistral

# Dry run (process but don't save to disk)
python scripts/run_offline_test.py recording.wav --no-save

# Debug logging
python scripts/run_offline_test.py recording.wav --log-level DEBUG
```

### CLI Arguments Reference

| Argument | Default | Description |
|---|---|---|
| `audio_file` | *(required)* | Path to the `.wav` audio file |
| `--meeting-id` | Auto-generated | Unique meeting identifier |
| `--output-dir` | `output/` | Directory for JSON output files |
| `--whisper-model` | `base` | Whisper model size (`tiny` / `base` / `small` / `medium` / `large`) |
| `--whisper-device` | `auto` | Computation device (`cpu` / `cuda` / `auto`) |
| `--ollama-url` | `http://localhost:11434/api/generate` | Ollama API endpoint |
| `--ollama-model` | `phi` | Ollama model name |
| `--no-save` | `false` | Skip writing result JSON to disk |
| `--log-level` | `INFO` | Logging verbosity level |

### Offline Pipeline Output

Results are saved as timestamped JSON files in the output directory:

```
output/
└── standup-2026-02-24_20260224T103045Z.json
```

Each file contains the full transcript, cleaned transcript, summary, action items, important dates, and processing metadata (model used, device, durations).

---

## 🧪 Testing

### Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test class
pytest tests/test_pipeline.py::TestTranscriber
pytest tests/test_pipeline.py::TestSummarizer
pytest tests/test_pipeline.py::TestStorage
pytest tests/test_pipeline.py::TestPipeline
```

### Test Prerequisites

1. Place at least one `.wav` audio file in `tests/recordings/`.
2. Ensure Ollama is running with a model pulled (`ollama serve` + `ollama pull phi`).
3. Ensure `ffmpeg` is installed and accessible in `$PATH`.

### Test Coverage

| Test Class | Tests | What It Validates |
|---|---|---|
| `TestTranscriber` | 3 | Whisper transcription output, metadata keys, file-not-found handling |
| `TestSummarizer` | 4 | LLM response keys, summary length, empty/short input validation |
| `TestStorage` | 3 | Save/load JSON round-trip, directory creation, missing file errors |
| `TestPipeline` | 3 | Full end-to-end pipeline, no-save mode, JSON serialization |

### Configuration

Test configuration is defined in `pytest.ini`:

```ini
[pytest]
testpaths = tests
timeout = 300
addopts = -v --tb=short
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
```

---

## 🔧 Troubleshooting Guide

### ❌ "No PulseAudio monitor source found"

**Symptom:** ffmpeg fails to start recording with audio source errors.

**Solution:**
```bash
# Check if PulseAudio is running
pulseaudio --check && echo "Running" || echo "Not running"

# Start PulseAudio if not running
pulseaudio --start

# List available sources and find your monitor
pactl list short sources

# If your monitor name differs, update it in:
# automation-service/src/joinMeeting.js
```

---

### ❌ "Whisper model download fails"

**Symptom:** First transcription takes too long or times out.

**Solution:**
```bash
# Pre-download the model manually in Python
python3 -c "import whisper; whisper.load_model('small')"

# For systems with limited RAM, use a smaller model
export WHISPER_MODEL_NAME=base
```

---

### ❌ "Ollama connection refused"

**Symptom:** NLP service returns 500 errors or connection timeouts.

**Solution:**
```bash
# Start Ollama
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags

# Pull the required model
ollama pull phi

# Test generation directly
curl http://localhost:11434/api/generate \
  -d '{"model": "phi", "prompt": "Hello", "stream": false}'
```

---

### ❌ "Browser automation fails to join meeting"

**Symptom:** Playwright launches browser but doesn't successfully join the meeting.

**Possible causes & solutions:**

| Cause | Solution |
|---|---|
| Not logged into Google in Brave | Open Brave manually and sign into Google |
| Stale browser profile | Ensure `userDataDir` points to your actual Brave profile directory |
| Meeting requires admission | The bot clicks "Ask to join" — the host must admit it manually |
| Google Meet UI updated | Check selector logic in `joinMeeting.js` and update as needed |

```bash
# Verify Brave path
which brave-browser
# Expected: /usr/bin/brave-browser

# Verify profile path exists
ls ~/.config/BraveSoftware/Brave-Browser/Default/
```

---

### ❌ "ffprobe shows wrong audio format"

**Symptom:** Whisper produces poor or garbled transcriptions.

**Solution:**
```bash
# Verify the recording format
ffprobe -v quiet -show_streams logs/recordings/meeting-*.wav \
  | grep -E "codec_name|sample_rate|channels"

# Expected:
# codec_name=pcm_s16le
# sample_rate=16000
# channels=1

# If incorrect, manually convert the file:
ffmpeg -i input.wav -ar 16000 -ac 1 -c:a pcm_s16le output.wav
```

---

### ❌ "Port already in use"

**Symptom:** Service fails to start with `EADDRINUSE` or `Address already in use`.

**Solution:**
```bash
# Find and kill the process using the port
lsof -ti:6000 | xargs kill -9    # STT service
lsof -ti:7000 | xargs kill -9    # NLP service
lsof -ti:4001 | xargs kill -9    # Automation service
lsof -ti:3000 | xargs kill -9    # Frontend
```

---

### ❌ "Out of memory during transcription"

**Symptom:** Python process is killed or throws OOM error.

**Solution:**
```bash
# Use a smaller Whisper model
export WHISPER_MODEL_NAME=base    # or tiny

# Or force CPU instead of GPU (slower but uses system RAM)
export WHISPER_DEVICE=cpu
```

---

### ❌ "NLP service returns empty or malformed JSON"

**Symptom:** Summary is empty, action items are missing, or JSON parsing fails.

**Solution:**
1. Ensure the transcript is at least 50 characters long.
2. Try a more capable model:
   ```bash
   ollama pull mistral
   # Then update nlp-service/summarizer.js → change model to "mistral"
   ```
3. Check Ollama logs for errors:
   ```bash
   journalctl -u ollama -f
   ```

---