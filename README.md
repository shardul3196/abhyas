# Abhyas (अभ्यास)

> A distraction-free, local-first SSC CGL mock examination runner and deep analytics platform designed to run locally on your host machine and be accessed seamlessly on a tablet (iPad, Android, Surface) over the local Wi-Fi LAN.

---

## 🏛️ Architecture & Philosophy

- **Local-First & Zero-Auth:** No cloud accounts or internet dependency required during exam execution. Runs entirely on your local machine (`0.0.0.0`) and LAN.
- **Dynamic LAN Routing:** The frontend dynamically queries `http://${window.location.hostname}:8000/api`, allowing any device on your local network to communicate with the FastAPI backend without hardcoded IP configuration.
- **Crash Recovery & Heartbeat Auto-Save:** Real-time response and time delta logging (`PATCH /api/attempts/{id}/response`) preserves timer state, question palette statuses, and selected answers across browser refreshes or accidental tab closes.
- **Git as Cloud Backup:** Single SQLite database file (`cgl_prep.db`) in project root with WAL mode. Commits directly to Git after running the checkpoint routine.

---

## ⚡ Quick Start

### Prerequisites
- **Python 3.11+**
- **Node.js 20+** & **npm**
- **Git**

### Launching with 1 Click

#### Windows:
Double-click `start.bat` or run in PowerShell:
```cmd
.\start.bat
```

#### macOS / Linux:
```bash
chmod +x start.sh
./start.sh
```

The launcher will automatically:
1. Detect your machine's active local Wi-Fi LAN IPv4 address (e.g. `192.168.1.45`).
2. Display the direct URLs for your host machine and your tablet.
3. Start the FastAPI backend on `0.0.0.0:8000` and Vite frontend on `0.0.0.0:5173`.

```
=====================================================================
   SSC CGL Local-First Mock Test & Analytics Platform
=====================================================================
  Local Host URL:    http://localhost:5173
  Tablet LAN Access: http://192.168.1.45:5173
  FastAPI Docs:      http://192.168.1.45:8000/docs
=====================================================================
```

---

## 📱 Tablet LAN Setup

1. Connect your iPad / Android tablet to the **same Wi-Fi network** as your host computer.
2. Open Safari / Chrome on your tablet and navigate to the printed LAN URL:
   ```
   http://<YOUR_HOST_IP>:5173
   ```
3. *(Optional iPad tip)*: Tap **Share -> Add to Home Screen** for a full-screen, app-like distraction-free testing environment!

---

## 🎯 Screen Tour & Capabilities

### Screen 1: Dashboard, Bookmarks & Admin Hub
- **Screen 1A (Student Dashboard):** Exam library cards with marking scheme badges (`+2.0 / -0.5`), question counts, past attempt counters, highest score badges, and quick actions (`Start New Attempt`, `Resume Attempt`, `View Past Reports`).
- **Screen 1B (Admin & Upload Hub):** Drag-and-drop JSON uploader with live dry-run pre-flight schema validator (`POST /api/exams/validate`), download sample template button, and exam management table.
- **Screen 1C (Bookmarked Questions Hub):** Filterable question revision repository with revealable KaTeX solutions and one-click unbookmark toggle.
- **Theme Switcher:** Seamless toggle between **Light**, **Dark**, and **Warm Reading Mode** (sepia paper tone).

### Screen 2: Distraction-Free Tablet Exam Runner (`/attempts/:attemptId`)
- **Top Bar:** Section segmented pill bar (instantaneous section jumping with live `answered/total` counter), countdown timer (pulsing amber at `< 5 min`, auto-submit at `00:00`), pause/resume toggle, and fullscreen mode.
- **Left Workspace (75%):**
  - Live per-question stopwatch tracking cumulative seconds on the current question.
  - Rich LaTeX math rendering via KaTeX (`$20\%$`, fractions, algebra) and Markdown tables.
  - Large touch-optimized Option Cards (`A`, `B`, `C`, `D`) with active emerald/indigo selection states.
  - Bottom action bar: `"Mark for Review & Next"`, `"Clear Response"`, `"Previous"`, and primary `"Save & Next"`.
- **Right Palette Sidebar (25%):**
  - High-contrast 5-state SSC CGL question palette:
    - 🟢 **Answered** (Emerald)
    - 🔴 **Not Answered** (Rose)
    - 🟣 **Marked for Review** (Violet)
    - 🟣🟢 **Answered & Marked for Review** (Violet with Emerald corner indicator)
    - ⚪ **Not Visited** (Slate)
- **Submit Modal:** Section-wise breakdown confirmation before final evaluation.

### Screen 3A: Post-Exam Review & Deep Analytics (`/attempts/:attemptId/analysis`)
- **Bento-Grid Summary:**
  - Total Score (with raw positive score `+N` and negative penalty `-N` breakdown).
  - Accuracy % (with Correct, Incorrect, and Unattempted pill counts).
  - Time Taken (with average time per question and pacing thresholds).
  - Sectional Performance comparison table + Recharts visualizations.
- **4-Quadrant "Topic Action Matrix":**
  1. 🔴 **Concept Gap** (*Low Accuracy < 60%, High Time*) -> Needs fundamental revision.
  2. 🟠 **Silly Mistakes** (*Low Accuracy < 60%, Low Time*) -> Slow down and avoid guessing.
  3. 🔵 **Needs Speed** (*High Accuracy >= 75%, High Time > 90s*) -> Learn shortcuts and elimination.
  4. 🟢 **Strong Zone** (*High Accuracy >= 75%, Optimal Time*) -> Maintain mastery.
- **Interactive Solution Walkthrough:** Filterable by `All`, `Incorrect`, `Unattempted`, `Slow (>90s)`, `Bookmarked`, and Section, with KaTeX explanations and one-click bookmark toggles.

### Screen 3B: Global Topic Analytics (`/analytics`)
- Historical score & accuracy progression area chart over time.
- Cumulative sectional accuracy and pacing comparisons.
- Cumulative cross-exam Topic Action Matrix and high-priority weak/slow topic callouts.

---

## 🔒 Git-Safe SQLite Checkpoint Workflow

SQLite in WAL mode creates temporary `-wal` and `-shm` cache files. To safely persist your mock attempts and question state to Git:

1. In the top navigation bar, click the **"Flush & Lock DB for Git"** button (or call `POST /api/admin/checkpoint`).
2. Verify the toast notification reports `wal_checkpoint_result: [0, 0, 0]` (all WAL frames truncated into `cgl_prep.db`).
3. Commit and push:
   ```bash
   git add cgl_prep.db uploads/
   git commit -m "Complete Mock Attempt #1 with analytics"
   git push origin main
   ```

---

## 📋 Exam JSON Import Format

Custom mock tests can be imported via the Admin Hub using standard JSON:

```json
{
  "exam_title": "SSC CGL 2026 Tier-1 Mock #01",
  "duration_minutes": 60,
  "positive_marks": 2.0,
  "negative_marks": 0.5,
  "questions": [
    {
      "q_no": 1,
      "section": "Quantitative Aptitude",
      "topic": "Profit & Loss",
      "sub_topic": "Successive Discounts",
      "question_text": "A shopkeeper offers two successive discounts of $20\\%$ and $10\\%$ on an article marked at ₹$1500$. Find the selling price.",
      "image_path": null,
      "option_a": "₹$1080$",
      "option_b": "₹$1050$",
      "option_c": "₹$1100$",
      "option_d": "₹$1020$",
      "correct_option": "A",
      "explanation": "Net discount: $D = d_1 + d_2 - \\frac{d_1 \\times d_2}{100} = 20 + 10 - 2 = 28\\%$. Selling price is $1500 \\times (1 - 0.28) = ₹1080$."
    }
  ]
}
```

A complete sample test is available in [`sample_ssc_cgl_mock.json`](sample_ssc_cgl_mock.json).

---

## 🛠️ Tech Stack & Directory Structure

```
SSC Test/
├── backend/                  # FastAPI & SQLModel API
│   ├── database.py           # SQLite engine with WAL pragma & checkpoint
│   ├── models.py             # Exam, Question, Attempt, AttemptResponse SQLModels
│   ├── schemas.py            # Pydantic v2 schemas & strict JSON validator
│   ├── routers/
│   │   ├── exams.py          # Exam upload, validate, fetch, delete
│   │   ├── attempts.py       # Start, auto-save patch, submit, recover
│   │   ├── analytics.py      # Bento metrics, 4-bucket Action Matrix engine
│   │   ├── questions.py      # Bookmark toggle & retrieval
│   │   └── admin.py          # WAL checkpoint & static image upload
│   └── main.py               # FastAPI entrypoint & CORS middleware
├── frontend/                 # Vite + React 19 + TypeScript
│   ├── src/
│   │   ├── components/       # Navbar, MathRenderer, Modals
│   │   ├── context/          # ThemeContext (Light/Dark/Warm), ToastContext
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          # Screen 1A: Exam library
│   │   │   ├── AdminHub.tsx           # Screen 1B: JSON uploader & validator
│   │   │   ├── BookmarksHub.tsx       # Screen 1C: Bookmarked questions
│   │   │   ├── ExamRunner.tsx         # Screen 2: Distraction-free runner
│   │   │   ├── PostExamAnalysis.tsx   # Screen 3A: Deep analytics & matrix
│   │   │   └── GlobalAnalytics.tsx    # Screen 3B: Global trends & matrix
│   │   └── lib/api.ts        # Dynamic LAN API client
├── uploads/                  # Question illustrations and diagrams
├── cgl_prep.db               # SQLite database file (Git-tracked)
├── sample_ssc_cgl_mock.json  # Seed mock exam
├── start.bat                 # Windows one-click launcher
├── start.sh                  # macOS/Linux launcher
└── PLAN.md                   # Master engineering specification & handoffs
```
