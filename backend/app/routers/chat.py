import os
import uuid
import datetime
import logging
import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import chromadb

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.conversation import Conversation
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Conversational Agent & Memory"])

from app.routers.documents import get_chroma_collection, chroma_client

class MessageRequest(BaseModel):
    message: str
    document_id: str | None = None

async def get_query_embedding(text: str, hf_api_key: str | None = None) -> list[float]:
    """Calculate vector embedding for RAG queries.
    
    Groq does not offer an embeddings endpoint.
    Fallback chain:
      1. HuggingFace Inference API (free tier, if key is set via environment or header)
      2. Local deterministic hash-based vector (offline, always works)
    """
    api_key = hf_api_key or settings.HUGGINGFACE_API_KEY
    # 1. Try HuggingFace free embeddings if key is configured
    if api_key and api_key.strip():
        try:
            headers = {
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json"
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
                    headers=headers,
                    json={"inputs": text, "options": {"wait_for_model": True}},
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        embedding = data if isinstance(data[0], float) else data[0]
                        logger.info("Using HuggingFace embeddings for chat query")
                        return embedding
        except Exception as e:
            logger.warning(f"HuggingFace embedding failed, falling back to local hash: {e}")

    # 2. Local deterministic fallback (always works, no external calls)
    logger.info("Using local deterministic hash embeddings for chat query")
    dim = 384  # all-MiniLM-L6-v2 dimension
    h = hashlib.sha256(text.encode('utf-8')).digest()
    vector = []
    for i in range(dim):
        byte_idx = (i * 3) % len(h)
        val = (h[byte_idx] / 127.5) - 1.0
        vector.append(val)
    return vector

async def run_llm_completion(
    system_prompt: str, 
    chat_history: list[dict], 
    user_message: str,
    groq_api_key: str | None = None,
    groq_model: str | None = None
) -> str:
    """Call Groq Chat Completions API with RAG context injected.
    
    Groq API is OpenAI-compatible — same request/response format,
    just using GROQ_API_KEY and GROQ_BASE_URL instead.
    """
    api_key = groq_api_key or settings.GROQ_API_KEY
    model = groq_model or settings.GROQ_MODEL
    
    is_groq_configured = (
        api_key
        and api_key != "your-groq-api-key-here"
    )
    
    if is_groq_configured:
        try:
            headers = {
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json"
            }
            messages = [{"role": "system", "content": system_prompt}]
            
            # Limit to last 10 turns to stay within Groq context limits
            for turn in chat_history[-10:]:
                messages.append({
                    "role": turn.get("role", "user"),
                    "content": turn.get("content", "")
                })
                
            messages.append({"role": "user", "content": user_message})

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.GROQ_BASE_URL}/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 2048
                    },
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    logger.warning(f"Groq chat completion failed ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"Error during Groq completion: {e}")

    # Offline local fallback when no Groq key is configured
    logger.info("Groq API key not configured — running local RAG fallback mode")
    return ""

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a new chat thread."""
    new_conv = Conversation(
        user_id=current_user.id,
        messages=[],
        context_ids=[]
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    return {
        "id": str(new_conv.id),
        "messages": new_conv.messages,
        "created_at": new_conv.updated_at
    }

@router.get("")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List previous chat history threads."""
    result = await db.execute(
        select(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "updated_at": c.updated_at,
            "preview": c.messages[0]["content"][:40] + "..." if c.messages else "New Conversation"
        }
        for c in convs
    ]

@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chat logs for a specific thread."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID format.")

    result = await db.execute(
        select(Conversation).filter(Conversation.id == conv_uuid, Conversation.user_id == current_user.id)
    )
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
        
    return {
        "id": str(conv.id),
        "messages": conv.messages,
        "updated_at": conv.updated_at
    }

@router.post("/{conversation_id}/message")
async def send_chat_message(
    conversation_id: str,
    req: MessageRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Process user message, retrieve RAG context, and generate agent completions."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID format.")

    result = await db.execute(
        select(Conversation).filter(Conversation.id == conv_uuid, Conversation.user_id == current_user.id)
    )
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation thread not found.")

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # Extract dynamic override headers if sent by frontend settings client
    hf_api_key = request.headers.get("X-HuggingFace-Api-Key")
    groq_api_key = request.headers.get("X-Groq-Api-Key")
    groq_model = request.headers.get("X-Groq-Model")

    # 1. RAG vector context search
    query_vector = await get_query_embedding(req.message, hf_api_key=hf_api_key)
    
    where_filter = {"user_id": str(current_user.id)}
    if req.document_id:
        try:
            # Confirm document exists and is owned by active user
            doc_uuid = uuid.UUID(req.document_id)
            doc_res = await db.execute(
                select(Document).filter(Document.id == doc_uuid, Document.user_id == current_user.id)
            )
            if doc_res.scalars().first():
                where_filter["document_id"] = str(req.document_id)
        except ValueError:
            pass

    retrieved_chunks = []
    sources = []
    
    try:
        # Search top 3 passages in ChromaDB
        search_results = get_chroma_collection().query(
            query_embeddings=[query_vector],
            n_results=3,
            where=where_filter
        )
        
        if search_results and "documents" in search_results and search_results["documents"]:
            docs = search_results["documents"][0]
            metadatas = search_results["metadatas"][0]
            
            for text, meta in zip(docs, metadatas):
                retrieved_chunks.append(text)
                sources.append({
                    "filename": meta.get("filename", "Unknown file"),
                    "chunk_index": meta.get("chunk_index", 0)
                })
    except Exception as e:
        logger.error(f"Error querying ChromaDB inside chat: {e}")

    # Assemble RAG System Prompt
    context_str = "\n\n".join([f"--- SOURCE: {s['filename']} (chunk {s['chunk_index']}) ---\n{text}" for text, s in zip(retrieved_chunks, sources)])
    
    system_prompt = (
        "You are AnalystAI, a senior data analyst and AI assistant combined. Your job is to help users understand, analyze, visualize, and derive insights from their data using natural language — no coding required.\n"
        "Think step-by-step, explain your reasoning clearly, and always provide actionable insights — not just raw numbers. Handle structured data (CSV, Excel, JSON, databases) and unstructured documents (PDF, Word, reports) equally well.\n\n"
        "RULES OF ENGAGEMENT:\n"
        "1. NATURAL LANGUAGE QUERYING:\n"
        "   - Identify relevant columns/fields and perform required analysis operations (aggregation, filtering, trends, statistics).\n"
        "   - Return results in plain English with actual numbers/data and explain what was done and why.\n\n"
        "2. DATA CLEANING:\n"
        "   - Report data quality issues found: missing values (count + % per column), duplicates, incorrect data types, outliers, formatting inconsistencies.\n"
        "   - Suggest fixes but do not perform destructive modifications without user confirmation.\n\n"
        "3. DATA VISUALIZATION:\n"
        "   - Automatically choose the best chart types (Line, Bar, Donut, Scatter, Box-Plot, Map).\n"
        "   - Describe the chart, and provide a 3-5 sentence explanation of what it shows, the single most important takeaway, and any anomalies/spikes worth investigating.\n\n"
        "4. BUSINESS INSIGHTS GENERATION:\n"
        "   - After any analysis, always provide: Key Findings (bulleted), Root Cause Hypothesis, Risk Factors, Recommendations (2-3 concrete, actionable steps), and Confidence Level.\n\n"
        "5. RAG DOCUMENT REASONING:\n"
        "   - Base answers on the retrieved context below. Cite sources (document name + section/page if available).\n"
        "   - Synthesize across multiple chunks/documents. State whether an answer is directly stated or inferred. Flag if not found.\n\n"
        "6. PREDICTIVE ANALYTICS:\n"
        "   - For forecasts, list predicted values, confidence intervals, model assumptions, and metrics (MAE, RMSE).\n\n"
        "7. RESPONSE FORMAT:\n"
        "   - Be concise but complete. Use bullet points for lists, markdown tables for comparisons, and bold key numbers/findings.\n"
        "   - Never return raw code unless explicitly requested.\n"
        "   - **CRITICAL**: Always end analytical responses with exactly: 'What would you like to explore next?'\n\n"
        "CONTEXT RETRIEVED FROM USER'S DOCUMENT VECTOR STORE:\n"
        f"{context_str or 'No relevant passages found.'}\n"
    )

    # 2. Add User message to thread
    user_turn = {
        "role": "user",
        "content": req.message,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    # Mutating lists in SQL JSONB requires reassignment or copying
    updated_messages = list(conv.messages)
    updated_messages.append(user_turn)

    # 3. Compute LLM Response
    reply = await run_llm_completion(
        system_prompt, 
        updated_messages[:-1], 
        req.message,
        groq_api_key=groq_api_key,
        groq_model=groq_model
    )
    
    # Offline fallback generator if LLM API completed empty
    if not reply.strip():
        if retrieved_chunks:
            passages = "\n\n".join([f"&bull; **{s['filename']}** (chunk #{s['chunk_index'] + 1}):\n> {text[:250]}..." for text, s in zip(retrieved_chunks, sources)])
            reply = (
                "### AnalystAI local RAG Response (Offline Fallback)\n\n"
                "I searched your document library and located these matching text passages:\n\n"
                f"{passages}\n\n"
                "*(Note: Since no Groq API key is configured in the environment settings, "
                "I am running in local keyword retrieval mode. To enable full synthesis and conversations, "
                "please configure `GROQ_API_KEY` in your `.env` file.)*"
            )
        else:
            reply = (
                "### AnalystAI local RAG Response (Offline Fallback)\n\n"
                "I searched your document library but could not find any passages matching your question. "
                "Try checking that your target files have completed indexing successfully, or try adjusting "
                "your query search terms.\n\n"
                "*(Note: Since no Groq API key is configured, I am running in local fallback mode.)*"
            )

    # 4. Add Assistant message to thread
    assistant_turn = {
        "role": "assistant",
        "content": reply,
        "sources": sources,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    updated_messages.append(assistant_turn)
    
    # Save back to database
    conv.messages = updated_messages
    conv.updated_at = datetime.datetime.now(datetime.timezone.utc)
    
    # Update context_ids if document queried
    if req.document_id and req.document_id not in conv.context_ids:
        # Array columns need copying or re-assignment
        conv.context_ids = list(conv.context_ids) + [str(req.document_id)]
        
    await db.commit()
    
    return {
        "reply": reply,
        "sources": sources,
        "conversation": {
            "id": str(conv.id),
            "messages": conv.messages,
            "updated_at": conv.updated_at
        }
    }
