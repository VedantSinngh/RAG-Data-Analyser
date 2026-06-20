# AnalystAI Developer Guide & System Deep-Dive

Welcome to the **AnalystAI (RAG-Data-Analyser)** developer guide. This document provides a complete technical walkthrough of the codebase, system architecture, database schema, data pipelines, and core features.

---

## 1. High-Level Architecture

AnalystAI uses a decoupled, three-tier architecture structured as follows:

```mermaid
graph TD
    User([User Browser]) -->|Next.js App / Tailwind| Frontend[Frontend: Next.js Client]
    Frontend -->|REST APIs / WebSockets| Backend[Backend: FastAPI Service]
    
    subgraph Backend Core
        Backend -->|SQLAlchemy Async| RelationalDB[(PostgreSQL)]
        Backend -->|ChromaDB Client| VectorDB[(ChromaDB)]
        Backend -->|External API Calls| GroqAPI[Groq LLM API]
        Backend -->|External API Calls| HFEmbeddings[HuggingFace Embeddings API]
        Backend -->|Fallback Logic| HashEmbeddings[Local Deterministic Hash Embeddings]
        Backend -->|Data Processing| PandasAgent[Pandas & Scikit-Learn Engine]
        Backend -->|Stats Engines| StatsmodelsAgent[Statsmodels ARIMA Engine]
        Backend -->|Report Generation| ReportLab[ReportLab PDF Compiler]
    end
```

---

## 2. Database Schema Design (PostgreSQL)

AnalystAI tracks all operational state, users, conversation history, and analytical logs in PostgreSQL. All database models are built using **SQLAlchemy Async (asyncpg)**.

Here is the schema overview:

| Entity / Model | Database Table | Key Attributes | Description |
| :--- | :--- | :--- | :--- |
| **User** | `users` | `id`, `email`, `hashed_password`, `is_active` | Handles JWT-based authentication and user sessions. |
| **Document** | `documents` | `id`, `user_id`, `filename`, `file_type`, `status`, `row_count`, `column_metadata` | Tracks uploaded raw files (PDF/DOCX/CSV) and parsing states. |
| **Conversation** | `conversations` | `id`, `user_id`, `document_id`, `title`, `messages` | Stores chat logs, query prompts, and LLM responses. |
| **Analysis** | `analyses` | `id`, `document_id`, `type` (regression/forecasting/cleansing), `parameters`, `results` | Saves parameters and statistical outcomes of datasets. |
| **Chart** | `charts` | `id`, `analysis_id`, `title`, `chart_type`, `data_points` | Stores coordinate mappings of plots to render client-side. |
| **Report** | `reports` | `id`, `document_id`, `file_path`, `generated_at` | Maps links to the generated ReportLab PDF documents. |
| **AgentLog** | `agent_logs` | `id`, `analysis_id`, `agent_name`, `log_message`, `level` | Stores diagnostic audit logs from backend analytical steps. |

---

## 3. Data Pipelines & Internal Mechanics

### 📂 Pipeline A: Document Ingestion & RAG Flow

When a file is uploaded, it follows a structured pathway to become queryable context:

```mermaid
sequenceDiagram
    participant User as Frontend Client
    participant API as FastAPI Backend
    participant DB as PostgreSQL Metadata
    participant Vec as ChromaDB Vector Store
    participant LLM as HuggingFace/Local Hash

    User->>API: Upload File (PDF, DOCX, CSV, XLSX)
    API->>DB: Create Document entry (Status: PROCESSING)
    
    alt File is PDF
        API->>API: Parse pages using pypdf
    else File is Tabular (CSV/Excel)
        API->>API: Load into Pandas & serialize rows to text descriptions
    end
    
    API->>API: Split text with Sliding Window (1,000 char size, 200 char overlap)
    
    API->>LLM: Request 384-d vector embeddings
    alt HuggingFace API is Active
        LLM-->>API: Return sentence-transformers vectors
    else HuggingFace Offline / No Key
        API->>API: Generate local deterministic SHA-256 hash vectors
    end

    API->>Vec: Store vectors with document_id and user_id metadata
    API->>DB: Update Document entry (Status: COMPLETED)
    API-->>User: File processed successfully
```

---

### 📈 Pipeline B: Conversational RAG Query Loop

When a user chats with a document:
1. **Query Embedding**: The system vectorizes the user's question.
2. **ChromaDB Fetch**: It queries ChromaDB for the **top 3 most similar chunks**, filtered strictly by the document's ID and the owner's user ID.
3. **Prompt Formulation**: The backend wraps the 3 context chunks inside a highly constrained system prompt instructing the LLM to reply *only* using the provided contexts.
4. **Groq API Execution**: The context prompt and chat history are sent to Groq (`llama-3.3-70b-versatile` or chosen model) for sub-second, grounded text completion.

---

### 🧠 Pipeline C: Data Cleansing & Forecasting Loop

When a user requests numerical analysis or time-series prediction:

```mermaid
flowchart TD
    A[Load Tabular Dataset in Pandas] --> B{Clean Data?}
    B -->|Yes| C[Winsorization Agent]
    C -->|Calculate IQR| D["Clip Outliers beyond [Q1 - 1.5*IQR, Q3 + 1.5*IQR]"]
    D --> E[Prepare Chronological Target Index]
    B -->|No| E
    
    E --> F{Fit ARIMA 1,1,1 Model}
    F -->|Success| G[Generate Forecast & 95% Confidence Bounds]
    F -->|Failure / Statsmodels Error| H[Linear Regression Fallback Agent]
    H -->|Fit Trendline| I[Calculate Confidence Bounds using Residual Standard Deviation]
    
    G --> J[Generate Chart coordinates & store results]
    I --> J
    J --> K[Compile PDF via ReportLab & save output]
```

---

## 4. Key Code Map

Here are the primary components of interest in the repository:

* **[backend/app/main.py](file:///c:/Users/vedaa/OneDrive/Desktop/resume-project/Rag-Data-Analysis/backend/app/main.py)**: The FastAPI bootstrapper that configures CORS, handles life-cycle DB connections, mounts routers, and serves the health checking routes.
* **[backend/app/routers/documents.py](file:///c:/Users/vedaa/OneDrive/Desktop/resume-project/Rag-Data-Analysis/backend/app/routers/documents.py)**: The core ingestion router. Contains files parsers for PDF/DOCX/TXT/CSV/XLSX, sliding window chunkers, and embedding orchestrators.
* **[backend/app/routers/analysis.py](file:///c:/Users/vedaa/OneDrive/Desktop/resume-project/Rag-Data-Analysis/backend/app/routers/analysis.py)**: Houses statistical data engines. Contains IQR outlier detection winsorization, ARIMA models, and Linear Regression fallback routines.
* **[backend/app/routers/chat.py](file:///c:/Users/vedaa/OneDrive/Desktop/resume-project/Rag-Data-Analysis/backend/app/routers/chat.py)**: Handles conversation sessions, vector similarity lookups, prompt compilation, and integration with the Groq API.
* **[backend/app/routers/reports.py](file:///c:/Users/vedaa/OneDrive/Desktop/resume-project/Rag-Data-Analysis/backend/app/routers/reports.py)**: Coordinates executive PDF compilations using `ReportLab`.
* **[frontend/app/](file:///c:/Users/vedaa/OneDrive/Desktop/resume-project/Rag-Data-Analysis/frontend/app/)**: Next.js React layout pages (auth, analysis interface, dynamic SVG chart rendering dashboards).

---

## 5. Local Setup & Production Run

### Environment Configuration (`.env`)
A `.env` file must sit at the root of the project to expose necessary credentials to Docker and local processes:
```env
APP_ENV=development # change to production in Render
SECRET_KEY=some_long_random_string_for_jwts
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql+asyncpg://postgres:password@postgres:5432/analystai
GROQ_API_KEY=gsk_...
HUGGINGFACE_API_KEY=hf_...
```

### Docker Startup
```bash
docker-compose up --build
```

### Render Production Keep-Alive Setup
To ensure your backend on the **Render Free Tier** stays awake, configure your cron job on **cron-job.org** with:
* **URL**: `https://rag-data-analyser.onrender.com/api/v1/health`
* **Schedule**: Every `12` or `14` minutes
* **Connection Timeout**: `30` or `60` seconds (to allow for spin-up/cold starts)
