<p align="center">
  <h1 align="center">🤖 Automated Meeting Assistant</h1>
  <p align="center">
    <strong>AI-powered meeting automation that joins, records, transcribes, and summarizes Google Meet sessions — with hybrid cloud + local processing and integrations to Notion & Google Calendar.</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/Whisper-OpenAI-412991?logo=openai&logoColor=white" alt="Whisper" />
    <img src="https://img.shields.io/badge/AssemblyAI-Hybrid%20STT-3B82F6" alt="AssemblyAI" />
    <img src="https://img.shields.io/badge/Ollama-Local%20LLM-000000?logo=ollama&logoColor=white" alt="Ollama" />
    <img src="https://img.shields.io/badge/Playwright-Automation-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
    <img src="https://img.shields.io/badge/Notion-Integration-000000?logo=notion&logoColor=white" alt="Notion" />
    <img src="https://img.shields.io/badge/Google%20Calendar-Integration-4285F4?logo=googlecalendar&logoColor=white" alt="Google Calendar" />
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
- [Hybrid STT Pipeline](#-hybrid-stt-pipeline)
- [Integrations](#-integrations)
- [API Endpoints](#-api-endpoints)
- [Example Workflow](#-example-workflow)
- [Frontend UI](#-frontend-ui)
- [Offline Pipeline (CLI)](#-offline-pipeline-cli)
- [Testing](#-testing)
- [Environment Variables](#-environment-variables)
- [Troubleshooting Guide](#-troubleshooting-guide)

---

## 🌟 Project Overview

The **Automated Meeting Assistant** is a privacy-first AI system that automates the entire lifecycle of a Google Meet session:

1. **Joins** a Google Meet call automatically using Playwright + Brave Browser.
2. **Records** system audio in real time using `ffmpeg` and PulseAudio monitor source.
3. **Transcribes** speech-to-text using a **hybrid pipeline** — AssemblyAI (cloud) with automatic fallback to local OpenAI Whisper.
4. **Summarizes** the transcript and extracts structured meeting intelligence using AssemblyAI LeMUR or a local LLM (Ollama).
5. **Pushes results** to external integrations:
   - **Notion** — Creates a meeting page with summary and tasks/deadlines table.
   - **Google Calendar** — Creates calendar events for action item deadlines.
6. **Outputs** structured JSON containing:
   - 📝 Cleaned transcript
   - 📄 Concise meeting summary
   - ✅ Action items with responsible persons and deadlines

All local processing happens **on your machine**. Cloud services (AssemblyAI) are used when available, with full local fallback when they are not.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔒 **Privacy-First Local Fallback** | Full local pipeline (Whisper + Ollama) when cloud services are unavailable |
| ☁️ **Hybrid STT Pipeline** | AssemblyAI transcription + LeMUR summarization with automatic local fallback |
| 🤖 **Fully Automated** | Joins the meeting, records, transcribes, summarizes — zero manual intervention |
| 🎙️ **System Audio Capture** | Records what you *hear* (system audio via PulseAudio monitor), not microphone input |
| 🧠 **Local LLM Summarization** | Uses Ollama with phi/mistral models as fallback summarization engine |
| 🗣️ **Whisper STT** | OpenAI Whisper running locally as transcription fallback |
| 🌐 **Web UI** | React-based frontend for joining/scheduling meetings and viewing results |
| 📊 **Structured Output** | JSON output with summary, action items, responsible persons, deadlines |
| ⏱️ **Meeting Scheduling** | Schedule meetings to auto-join at a specific time with live countdown |
| 🔄 **Offline Pipeline** | CLI tool for processing pre-recorded audio files |
| 📓 **Notion Integration** | Automatically creates meeting pages in Notion with summary + tasks table |
| 📅 **Google Calendar Integration** | Creates calendar events for upcoming action item deadlines |
| 👤 **Multi-Account Support** | Select from multiple Google accounts in the frontend |

---

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         AUTOMATED MEETING ASSISTANT                          │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐      │
│  │   Frontend    │       │   Automation      │       │   PulseAudio     │      │
│  │   (React)     │──────▶│   Service         │──────▶│   Monitor        │      │
│  │   :3000       │  API  │   (Node.js)       │ Audio │   + ffmpeg       │      │
│  └──────────────┘       │   :4001            │       └────────┬─────────┘      │
│                          └────────┬───────────┘                │               │
│                                   │                            │               │
│                                   │ On meeting end             │ Records       │
│                                   ▼                            ▼               │
│                          ┌──────────────────┐       ┌──────────────────┐      │
│                          │   STT Client      │       │ logs/recordings/ │      │
│                          │   (sttClient.js)  │       │   .wav files     │      │
│                          └────────┬───────────┘       └─────────────────┘      │
│                                   │                                            │
│                                   ▼                                            │
│                   ┌─────────────────────────────┐                             │
│                   │  Hybrid STT Service (:5002) │                             │
│                   │  ┌─────────┐  ┌───────────┐ │                             │
│                   │  │AssemblyAI│  │ Local STT │ │                             │
│                   │  │  Cloud   │  │ (Whisper) │ │                             │
│                   │  │ + LeMUR  │  │  :6000    │ │                             │
│                   │  └────┬─────┘  └─────┬─────┘ │                             │
│                   │       │  fallback ──▶ │       │                             │
│                   └───────┴──────────────┴───────┘                             │
│                                   │                                            │
│                                   │ Transcript + Summary                       │
│                                   ▼                                            │
│                   ┌──────────────────────────────┐                             │
│                   │  NLP Service (:7000)          │                             │
│                   │  ┌──────────┐ ┌────────────┐ │                             │
│                   │  │ Ollama   │ │Integrations│ │                             │
│                   │  │ :11434   │ │            │ │                             │
│                   │  └──────────┘ │ ┌────────┐ │ │                             │
│                   │               │ │ Notion │ │ │                             │
│                   │               │ ├────────┤ │ │                             │
│                   │               │ │Calendar│ │ │                             │
│                   │               │ └────────┘ │ │                             │
│                   │               └────────────┘ │                             │
│                   └──────────────────────────────┘                             │
│                                   │                                            │
│                                   ▼                                            │
│                   ┌──────────────────────────────┐                             │
│                   │  Structured JSON Output       │                             │
│                   │  ┌─────────────────────────┐  │                             │
│                   │  │ Cleaned Transcript       │  │                             │
│                   │  │ Meeting Summary          │  │                             │
│                   │  │ Action Items + Deadlines │  │                             │
│                   │  └─────────────────────────┘  │                             │
│                   └──────────────────────────────┘                             │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Google Meet → Brave Browser → PulseAudio Monitor → ffmpeg → .wav file
    → Hybrid STT (AssemblyAI → local Whisper fallback) → Raw Transcript
    → Summarization (LeMUR → Ollama fallback) → Structured JSON
    → Integrations (Notion page + Google Calendar events)
```

---

## 📁 Folder Structure

```
automated-meeting-assistant/
│
├── automation-service/          # 🤖 Browser automation + audio recording
│   ├── src/
│   │   ├── server.js            #    Express server (port 4001)
│   │   └── joinMeeting.js       #    Playwright meeting automation + ffmpeg recording
│   ├── sttClient.js             #    STT + NLP pipeline trigger (calls hybrid STT)
│   ├── package.json
│   └── logs/
│
├── stt-service/                 # ☁️ Hybrid STT pipeline (AssemblyAI + local fallback)
│   ├── index.js                 #    Express server (port 5002)
│   ├── routes.js                #    /api/stt/transcribe, /api/stt/process
│   ├── stt.controller.js        #    Request handler
│   ├── orchestrator.js          #    Hybrid fallback: AssemblyAI → LeMUR → Ollama → Whisper
│   ├── assemblyai.service.js    #    AssemblyAI transcription + LeMUR summarization
│   ├── local.service.js         #    Local Whisper + Ollama fallback
│   ├── package.json
│   └── transcripts/
│
├── local-stt-service/           # 🗣️ Local Whisper speech-to-text (FastAPI)
│   ├── app.py                   #    FastAPI server (port 6000)
│   └── transcripts/
│
├── nlp-service/                 # 🧠 LLM summarization + integrations
│   ├── index.js                 #    Express server (port 7000)
│   ├── summarizer.js            #    Ollama prompt engineering
│   ├── config.js                #    Notion + Google Calendar credentials
│   ├── routes/
│   │   ├── notion.js            #    POST /notion — Notion meeting page
│   │   └── calendar.js          #    POST /calendar — Google Calendar events
│   ├── services/
│   │   ├── notionService.js     #    Notion API client
│   │   └── calendarService.js   #    Google Calendar API client
│   ├── package.json
│   └── transcripts/
│
├── frontend/                    # 🌐 React web interface
│   ├── src/
│   │   ├── App.jsx              #    HashRouter routing
│   │   ├── api/meeting.js       #    API client
│   │   ├── components/
│   │   │   ├── AccountSelector.jsx
│   │   │   ├── ActionItemsViewer.jsx
│   │   │   ├── MeetingForm.jsx
│   │   │   ├── NavBar.jsx
│   │   │   ├── StartStopButtons.jsx
│   │   │   ├── StatusDisplay.jsx
│   │   │   ├── SummaryViewer.jsx
│   │   │   └── TranscriptViewer.jsx
│   │   └── pages/
│   │       ├── SchedulerForm.jsx
│   │       ├── MeetingsPage.jsx
│   │       └── MeetingDetails.jsx
│   ├── vite.config.js           #    Port 3000
│   └── package.json
│
├── app/                         # 🐍 Python offline pipeline
│   ├── config.py
│   ├── transcriber.py
│   ├── summarizer.py
│   ├── storage.py
│   └── pipeline.py
│
├── scripts/
│   └── run_offline_test.py      #    CLI for offline audio processing
│
├── tests/
│   ├── conftest.py
│   ├── test_pipeline.py
│   └── recordings/
│
├── logs/recordings/             # 🎵 Recorded meeting audio files
├── output/                      # 📊 Offline pipeline JSON results
├── requirements.txt
├── package.json
└── pytest.ini
```

---

## 🛠️ Technologies Used

### Core Stack

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Backend services (automation, STT orchestration, NLP) |
| **Python** | 3.10+ | Local STT service, offline pipeline |
| **React** | 18.x | Frontend web interface |
| **Vite** | 5.x | Frontend build tool |

### AI / ML

| Technology | Purpose |
|---|---|
| **AssemblyAI** | Cloud speech-to-text transcription (primary) |
| **AssemblyAI LeMUR** | Cloud-based meeting summarization (Anthropic Claude 3.5 Sonnet) |
| **OpenAI Whisper** | Local speech-to-text transcription (fallback) |
| **Ollama** | Local LLM inference engine (fallback summarization) |
| **phi / mistral** | LLM models for local summarization |
| **PyTorch** | Whisper model runtime (CPU / CUDA) |

### Browser Automation

| Technology | Purpose |
|---|---|
| **Playwright** | Browser automation library |
| **Brave Browser** | Chromium-based browser (persistent user profile) |
| **xvfb-run** | Virtual framebuffer for headless browser execution |

### Audio Processing

| Technology | Purpose |
|---|---|
| **ffmpeg** | Audio recording (PulseAudio source) and format conversion |
| **PulseAudio** | System audio capture via monitor source |

### Integrations

| Technology | Purpose |
|---|---|
| **Notion API** (`@notionhq/client`) | Create meeting pages with summaries and tasks tables |
| **Google Calendar API** (`googleapis`) | Create calendar events for action item deadlines |

### Frameworks & Libraries

| Technology | Purpose |
|---|---|
| **Express.js** | REST API framework (Node.js services) |
| **FastAPI** | REST API framework (Python STT service) |
| **React Router** | Client-side routing (HashRouter) |
| **Uvicorn** | ASGI server for FastAPI |

---

## 📋 Prerequisites

### System Requirements

- **OS:** Linux (Ubuntu 20.04+ recommended)
- **RAM:** 8 GB minimum (16 GB recommended for `small` Whisper model)
- **GPU:** Optional — CUDA-compatible GPU for faster transcription
- **Disk:** ~5 GB for models and dependencies

### Required Software

```bash
node --version       # v18.x or higher
python3 --version    # 3.10 or higher
ffmpeg -version
pulseaudio --check
brave-browser --version
ollama --version
which xvfb-run
```

### Install Missing Dependencies (Ubuntu / Debian)

```bash
# System packages
sudo apt update && sudo apt install -y \
    ffmpeg pulseaudio xvfb python3-pip python3-venv curl

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
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Install Node.js Dependencies

```bash
cd automation-service && npm install && npx playwright install chromium && cd ..
cd stt-service && npm install && cd ..
cd nlp-service && npm install && cd ..
cd frontend && npm install && cd ..
```

### 4. Pull an Ollama Model

```bash
ollama serve &
ollama pull phi
```

### 5. Configure Environment Variables

**`stt-service/.env`:**
```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

**`nlp-service/.env`:**
```env
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_notion_database_id_here
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
```

### 6. Verify PulseAudio Monitor Source

```bash
pactl list short sources
# Look for: alsa_output.pci-0000_00_05.0.analog-stereo.monitor
```

> If your monitor source name differs, update it in `automation-service/src/joinMeeting.js`.

---

## 🚀 How to Run the Full System

| Service | Port | Command |
|---|---|---|
| Ollama | `11434` | `ollama serve` |
| Local STT | `6000` | `cd local-stt-service && uvicorn app:app --host 0.0.0.0 --port 6000` |
| Hybrid STT | `5002` | `cd stt-service && node index.js` |
| NLP Service | `7000` | `cd nlp-service && node index.js` |
| Automation | `4001` | `cd automation-service && node src/server.js` |
| Frontend | `3000` | `cd frontend && npm run dev` |

Start each in a separate terminal (or use `tmux`), then open **http://localhost:3000**.

### Join a Meeting

**Via Web UI:** Paste a Google Meet link → Click "Join Now"

**Via API:**
```bash
curl -X POST http://localhost:4001/api/meetings \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://meet.google.com/abc-defg-hij",
    "braveExecutable": "/usr/bin/brave-browser",
    "userDataDir": "/home/YOUR_USERNAME/.config/BraveSoftware/Brave-Browser/Default"
  }'
```

---

## 🎙️ Audio Configuration Details

### PulseAudio Monitor Source

The system captures **system audio** via PulseAudio's monitor source:

```
Google Meet Audio → PulseAudio Sink → Monitor Source → ffmpeg → .wav file
```

**ffmpeg recording command:**
```bash
ffmpeg -f pulse \
  -i alsa_output.pci-0000_00_05.0.analog-stereo.monitor \
  -ac 1 -ar 16000 -c:a pcm_s16le \
  logs/recordings/meeting-<timestamp>.wav
```

| Parameter | Purpose |
|---|---|
| `-f pulse` | PulseAudio input |
| `-ac 1` | Mono (optimized for Whisper) |
| `-ar 16000` | 16 kHz sample rate |
| `-c:a pcm_s16le` | PCM 16-bit uncompressed |

**Find your monitor source:**
```bash
pactl list short sources
```

---

## 🗣️ Whisper Configuration Details

| Model | Parameters | VRAM | Speed | Accuracy |
|---|---|---|---|---|
| `tiny` | 39 M | ~1 GB | ~32x | Lowest |
| `base` | 74 M | ~1 GB | ~16x | Low |
| **`small`** | **244 M** | **~2 GB** | **~6x** | **Good (default)** |
| `medium` | 769 M | ~5 GB | ~2x | Better |
| `large` | 1550 M | ~10 GB | 1x | Best |

| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL_NAME` | `small` | Primary model |
| `WHISPER_MODEL_FALLBACK` | `base` | Fallback on OOM |
| `WHISPER_DEVICE` | `auto` | `cpu` / `cuda` / `auto` |

---

## 🧠 NLP Service Details

The NLP service uses Ollama to produce structured meeting intelligence:

| Setting | Value |
|---|---|
| **Ollama URL** | `http://localhost:11434/api/generate` |
| **Default Model** | `phi` |
| **Timeout** | 300 seconds |
| **Min Transcript** | 50 characters |

### Output Schema

```json
{
  "cleaned_transcript": "Full cleaned transcript...",
  "summary": "Comprehensive meeting summary...",
  "action_items": [
    { "task": "...", "responsible": "...", "deadline": "..." }
  ]
}
```

---

## 🔀 Hybrid STT Pipeline

The `stt-service` orchestrates a multi-level fallback strategy:

```
1. Try AssemblyAI transcription
   ├── Success → Try AssemblyAI LeMUR summarization
   │              ├── Success → Return (source: "assemblyai")
   │              └── Failure → Ollama summarization (source: "assemblyai+ollama")
   └── Failure → Full local pipeline
                  ├── Whisper transcription (local-stt-service :6000)
                  └── Ollama summarization (source: "local")
```

After summarization (any source), results are pushed to Notion + Google Calendar in the background.

---

## 🔗 Integrations

### Notion

Creates a meeting page per session with:
- "Summary" heading + paragraph text
- "Tasks & Deadlines" table (Task | Deadline columns)

**Setup:** Create integration at [notion.so/my-integrations](https://www.notion.so/my-integrations), share your database with it.

### Google Calendar

Creates calendar events for action item deadlines:
- All-day events for date-only deadlines
- 1-hour events for specific times
- Only upcoming dates (past dates are skipped)

**Setup:** Create a service account in Google Cloud, enable Calendar API, share calendar with the service account.

---

## 📡 API Endpoints

### Automation Service (`:4001`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service status |
| `GET` | `/health` | Health check |
| `POST` | `/api/meetings` | Join a Google Meet session |

### Hybrid STT Service (`:5002`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service info + AssemblyAI status |
| `POST` | `/api/stt/transcribe` | Hybrid transcription + summarization |
| `POST` | `/api/stt/process` | Alias for transcribe |

### Local STT Service (`:6000`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/transcribe` | Local Whisper transcription |

### NLP Service (`:7000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/summarize` | Summarize via Ollama |
| `POST` | `/integrations/ingest` | Push summary to Notion + Calendar |
| `POST` | `/notion` | Create Notion meeting page |
| `POST` | `/calendar` | Create Google Calendar events |

> Full request/response schemas are in [API-REFERENCE.md](API-REFERENCE.md).

---

## 📐 Example Workflow

```
 1. User opens http://localhost:3000 → Pastes meeting link → Clicks "Join Now"
 2. Automation service launches Brave → disables camera/mic → clicks "Join"
 3. ffmpeg records system audio → logs/recordings/meeting-<ts>.wav
 4. Meeting ends → ffmpeg stops → sttClient sends audio to hybrid STT (:5002)
 5. Hybrid STT: AssemblyAI transcribes + LeMUR summarizes (or local fallback)
 6. Summary pushed to Notion (meeting page) + Google Calendar (deadline events)
 7. Results saved to nlp-service/transcripts/meeting_<id>.json
 8. User views transcript, summary, and action items in the frontend
```

---

## 🌐 Frontend UI

Built with **React 18** + **Vite** (port 3000).

| Route | Page | Description |
|---|---|---|
| `/` | **Scheduler** | Join or schedule meetings |
| `/meetings` | **Meetings** | Meeting history |
| `/meeting/:id` | **Details** | Transcript + summary + action items |

**Features:** Instant join, scheduling with countdown, account selection, meeting history, status tracking.

---

## 🐍 Offline Pipeline (CLI)

Process pre-recorded audio without the full service stack:

```bash
source venv/bin/activate
python scripts/run_offline_test.py path/to/recording.wav
python scripts/run_offline_test.py recording.wav --whisper-model medium --ollama-model mistral
```

---

## 🧪 Testing

```bash
source venv/bin/activate
pytest -v
```

| Test Class | What It Validates |
|---|---|
| `TestTranscriber` | Whisper output, metadata, file-not-found |
| `TestSummarizer` | LLM response keys, summary length, edge cases |
| `TestStorage` | JSON save/load, directory creation |
| `TestPipeline` | End-to-end pipeline, no-save mode |

> Full testing guide: [TESTING.md](TESTING.md)

---

## 🔐 Environment Variables

### `stt-service/.env`

| Variable | Default | Description |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | — | AssemblyAI API key |
| `ASSEMBLYAI_TIMEOUT_MS` | `600000` | Timeout (ms) |
| `LOCAL_STT_URL` | `http://localhost:6000/transcribe` | Local Whisper URL |

### `nlp-service/.env`

| Variable | Default | Description |
|---|---|---|
| `NOTION_API_KEY` | — | Notion integration token |
| `NOTION_DATABASE_ID` | — | Notion database ID |
| `GOOGLE_CLIENT_EMAIL` | — | Service account email |
| `GOOGLE_PRIVATE_KEY` | — | Service account private key |
| `GOOGLE_CALENDAR_ID` | — | Target calendar ID |

### Local STT (environment)

| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL_NAME` | `small` | Primary model |
| `WHISPER_MODEL_FALLBACK` | `base` | Fallback model |
| `WHISPER_DEVICE` | `auto` | `cpu`/`cuda`/`auto` |

### Automation (environment)

| Variable | Default | Description |
|---|---|---|
| `STT_ENDPOINT` | `http://127.0.0.1:5002/api/stt/process` | Hybrid STT URL |
| `NLP_ENDPOINT` | `http://localhost:7000/summarize` | NLP URL |

---

## 🔧 Troubleshooting Guide

| Problem | Solution |
|---|---|
| No PulseAudio source | `pulseaudio --start && pactl list short sources` |
| Whisper model download fails | `python3 -c "import whisper; whisper.load_model('small')"` |
| Ollama connection refused | `ollama serve && ollama pull phi` |
| Browser won't join | Ensure logged into Google in Brave; check `userDataDir` path |
| Port already in use | `lsof -ti:<PORT> \| xargs kill -9` |
| OOM during transcription | `export WHISPER_MODEL_NAME=base WHISPER_DEVICE=cpu` |
| AssemblyAI fails | Automatic local fallback; check API key and credits |
| Notion/Calendar fails | Non-blocking; check `.env` credentials and sharing permissions |

---

## 📚 Additional Documentation

| Document | Description |
|---|---|
| [SETUP.md](SETUP.md) | Detailed setup and configuration guide |
| [COMMANDS.md](COMMANDS.md) | Quick-reference command cheat sheet |
| [TESTING.md](TESTING.md) | Comprehensive testing guide |
| [API-REFERENCE.md](API-REFERENCE.md) | Complete API endpoint documentation |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Detailed architecture and integration design |
| [SYSTEM.md](SYSTEM.md) | System requirements and project specification |
