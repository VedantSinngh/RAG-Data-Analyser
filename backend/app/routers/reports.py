import os
import uuid
import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import httpx

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.database import get_db
from app.models.user import User
from app.models.analysis import Analysis
from app.models.report import Report
from app.models.agent_log import AgentLog
from app.models.chart import Chart
from app.routers.auth import get_current_user
from app.config import settings
from app.routers.chat import get_query_embedding, run_llm_completion
from app.routers.documents import get_chroma_collection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Report Generation & Export"])

class ReportCreateRequest(BaseModel):
    analysis_id: str
    title: str
    include_chart: bool = True
    include_metrics: bool = True
    include_logs: bool = True
    chart_explanation: str | None = None

class ExplainChartRequest(BaseModel):
    analysis_id: str
    chart_type: str

def generate_pdf_report(
    file_path: str, 
    title: str, 
    analysis_query: str, 
    logs: list[AgentLog], 
    chart_config: dict | None,
    include_chart: bool,
    include_metrics: bool,
    include_logs: bool,
    chart_explanation: str | None = None
) -> None:
    """Compile structured print-ready PDF using ReportLab Platypus elements with a formal business design."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    doc = SimpleDocTemplate(
        file_path, 
        pagesize=letter, 
        rightMargin=54, 
        leftMargin=54, 
        topMargin=54, 
        bottomMargin=54
    )
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom formal corporate-style typography styles
    title_style = ParagraphStyle(
        'FormalTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'FormalSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        spaceAfter=14
    )
    
    heading_style = ParagraphStyle(
        'FormalHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'FormalBody',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=8
    )

    caption_style = ParagraphStyle(
        'FormalCaption',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=6
    )
    
    # Document header
    story.append(Paragraph(title.upper(), title_style))
    story.append(Paragraph(f"CONFIDENTIAL BUSINESS INTELLIGENCE BRIEFING &bull; GENERATED ON {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC", subtitle_style))
    
    # Elegant divider line
    d_table = Table([[""]], colWidths=[504])
    d_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1.5, colors.HexColor('#0f172a')),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(d_table)
    
    # Section: Executive Scope
    story.append(Paragraph("1. EXECUTIVE ANALYTICAL SCOPE", heading_style))
    formal_scope_desc = (
        f"This document presents the formal analytical results and statistical evaluations compiled "
        f"by the database processing node in response to the primary query: <i>\"{analysis_query}\"</i>. "
        f"The data ingestion pipeline has completed standard verification, error checking, and outlier "
        f"mitigation protocols to ensure mathematical precision and model consistency."
    )
    story.append(Paragraph(formal_scope_desc, body_style))
    story.append(Spacer(1, 10))
    
    # Section: Data Forecast Table Grid
    if chart_config and include_metrics:
        story.append(Paragraph("2. STATISTICAL PROJECTIONS & HISTORICAL SAMPLE DATA", heading_style))
        
        hist_dates = chart_config.get("history_dates", [])
        hist_vals = chart_config.get("history_values", [])
        fc_dates = chart_config.get("forecast_dates", [])
        fc_vals = chart_config.get("forecast_values", [])
        low_b = chart_config.get("lower_bounds", [])
        upp_b = chart_config.get("upper_bounds", [])
        
        # Grid headers
        table_data = [["Period Date", "Data Classification", "Evaluated Value", "95% Lower Margin", "95% Upper Margin"]]
        
        # Add last 4 historical context points
        for i in range(max(0, len(hist_vals) - 4), len(hist_vals)):
            table_data.append([
                hist_dates[i], 
                "Historical Observed", 
                f"{hist_vals[i]:,.2f}", 
                "N/A (Observed)", 
                "N/A (Observed)"
            ])
            
        # Add future forecast projection steps
        for i in range(len(fc_vals)):
            table_data.append([
                fc_dates[i], 
                f"Model Forecast (+{i+1})", 
                f"{fc_vals[i]:,.2f}", 
                f"{low_b[i]:,.2f}" if i < len(low_b) else "N/A", 
                f"{upp_b[i]:,.2f}" if i < len(upp_b) else "N/A"
            ])
            
        t = Table(table_data, colWidths=[90, 110, 94, 105, 105])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 8),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('FONTNAME', (0,1), (-1,-1), 'Times-Roman'),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    # Section: Drawn Vector Trendline Chart
    if chart_config and include_chart:
        story.append(Paragraph("3. VISUALIZED PROJECTIONS TREND LINE", heading_style))
        story.append(Paragraph("The chart below illustrates the historical observations followed by the forecasted mathematical trajectory.", caption_style))
        
        # ReportLab custom vector drawing
        from reportlab.graphics.shapes import Drawing, Rect, Line, Circle, String
        
        hist_vals = chart_config.get("history_values", [])
        fc_vals = chart_config.get("forecast_values", [])
        all_vals = hist_vals + fc_vals
        
        if all_vals:
            y_min_val = min(all_vals)
            y_max_val = max(all_vals)
            y_range_val = (y_max_val - y_min_val) if y_max_val != y_min_val else 1.0
            
            draw_w = 480
            draw_h = 120
            d = Drawing(draw_w, draw_h)
            
            # Border & Grid background
            d.add(Rect(0, 0, draw_w, draw_h, fillColor=colors.HexColor('#f8fafc'), strokeColor=colors.HexColor('#e2e8f0'), strokeWidth=1))
            
            # Draw simple coordinate lines
            pts = []
            hist_len = len(hist_vals)
            total_len = len(all_vals)
            
            for idx, val in enumerate(all_vals):
                x = 10 + (idx / (total_len - 1)) * (draw_w - 20) if total_len > 1 else 240
                y = 10 + ((val - y_min_val) / y_range_val) * (draw_h - 20)
                pts.append((x, y))
            
            # Draw line segments
            for idx in range(len(pts) - 1):
                p1 = pts[idx]
                p2 = pts[idx + 1]
                line_color = colors.HexColor('#2563eb') if idx < hist_len - 1 else colors.HexColor('#dc2626')
                line_stroke = 1.5 if idx < hist_len - 1 else 2.0
                d.add(Line(p1[0], p1[1], p2[0], p2[1], strokeColor=line_color, strokeWidth=line_stroke))
                
            # Draw separating vertical line between history and forecast
            if hist_len > 0 and hist_len < total_len:
                sep_x = pts[hist_len - 1][0]
                d.add(Line(sep_x, 0, sep_x, draw_h, strokeColor=colors.HexColor('#64748b'), strokeWidth=0.8, strokeDashArray=[2, 2]))
                d.add(String(sep_x + 4, draw_h - 12, "Forecast Boundary", fontName="Helvetica-Bold", fontSize=7, fillColor=colors.HexColor('#475569')))
            
            # Label limits
            d.add(String(12, draw_h - 12, f"Max: {y_max_val:,.2f}", fontName="Helvetica", fontSize=7, fillColor=colors.HexColor('#64748b')))
            d.add(String(12, 6, f"Min: {y_min_val:,.2f}", fontName="Helvetica", fontSize=7, fillColor=colors.HexColor('#64748b')))
            
            story.append(d)
            story.append(Spacer(1, 12))
            
    # Section: AI Chart Explanation
    if chart_explanation:
        story.append(Paragraph("4. AI CHART EXPLANATION & CONTEXT", heading_style))
        for line in chart_explanation.split('\n'):
            line = line.strip()
            if not line:
                story.append(Spacer(1, 4))
                continue
            # Simple markdown bullet point parsing
            if line.startswith('- ') or line.startswith('* '):
                story.append(Paragraph(f"&bull; {line[2:]}", body_style))
            elif line.startswith('**') and line.endswith('**'):
                story.append(Paragraph(f"<b>{line[2:-2]}</b>", body_style))
            else:
                story.append(Paragraph(line, body_style))
        story.append(Spacer(1, 10))
        
    # Section: Audit logs summary
    if logs and include_logs:
        story.append(Paragraph("5. MULTI-AGENT EXECUTION AUDIT", heading_style))
        for log in logs:
            agent_title = f"<b>Agent: {log.agent_name.upper()}</b> (Diagnostic execution: {log.duration_ms} ms)"
            story.append(Paragraph(agent_title, body_style))
            
            output = log.output_data or {}
            if "outliers_detected" in output:
                scrubbed_summary = (
                    f"Operational Protocol: Evaluated {len(output.get('numeric_columns_scanned', []))} column vector(s) for variance stability. "
                    f"Identified and winsorized {output.get('outliers_detected')} extreme value anomalies using the standard "
                    f"Interquartile Range (IQR) method. Adjusted boundaries: "
                    f"[{output.get('lower_limit'):.2f}, {output.get('upper_limit'):.2f}]."
                )
                story.append(Paragraph(scrubbed_summary, body_style))
            elif "method" in output:
                forecast_summary = (
                    f"Operational Protocol: Implemented time-series predictive modeling using the "
                    f"\"{output.get('method')}\" framework. Fitted parameters against "
                    f"{output.get('historical_points')} historical observed data coordinates "
                    f"to generate {output.get('steps')} future interval predictions."
                )
                story.append(Paragraph(forecast_summary, body_style))
                
            story.append(Spacer(1, 4))
            
    doc.build(story)

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_report(
    req: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Compile PDF from historical analysis run."""
    try:
        run_uuid = uuid.UUID(req.analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format.")
        
    # Fetch analysis run
    result = await db.execute(
        select(Analysis)
        .filter(Analysis.id == run_uuid, Analysis.user_id == current_user.id)
        .options(
            selectinload(Analysis.agent_logs),
            selectinload(Analysis.charts)
        )
    )
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
        
    report_id = uuid.uuid4()
    pdf_filename = f"{report_id}.pdf"
    pdf_path = os.path.join("/app/uploads/reports", pdf_filename)
    
    # Extract chart config coordinates
    chart_config = run.charts[0].config if run.charts else None
    
    # Compile ReportLab PDF
    try:
        generate_pdf_report(
            pdf_path, 
            req.title.strip() or f"Executive Report: {run.query[:30]}", 
            run.query, 
            run.agent_logs, 
            chart_config,
            req.include_chart,
            req.include_metrics,
            req.include_logs,
            req.chart_explanation
        )
    except Exception as e:
        logger.error(f"Error compiling PDF: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile PDF document: {str(e)}"
        )
        
    # Create Report record in Postgres
    summary_str = f"Forecast report compiled from run ID {str(run.id)[:8]} using model: {chart_config.get('method', 'ARIMA') if chart_config else 'Unknown'}."
    new_report = Report(
        id=report_id,
        user_id=current_user.id,
        analysis_id=run_uuid,
        title=req.title.strip() or f"Report: {run.query[:30]}",
        storage_url=pdf_path,
        summary=summary_str
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    
    return {
        "message": "Report successfully compiled.",
        "id": str(new_report.id),
        "title": new_report.title,
        "summary": new_report.summary,
        "created_at": new_report.created_at
    }

@router.get("")
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all previously compiled PDFs."""
    result = await db.execute(
        select(Report)
        .filter(Report.user_id == current_user.id)
        .order_by(Report.created_at.desc())
    )
    reps = result.scalars().all()
    return [
        {
            "id": str(rep.id),
            "analysis_id": str(rep.analysis_id) if rep.analysis_id else None,
            "title": rep.title,
            "summary": rep.summary,
            "created_at": rep.created_at
        }
        for rep in reps
    ]

@router.get("/{report_id}/download")
async def download_report_pdf(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stream PDF file as attachment download."""
    try:
        rep_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format.")
        
    result = await db.execute(
        select(Report).filter(Report.id == rep_uuid, Report.user_id == current_user.id)
    )
    rep = result.scalars().first()
    if not rep:
        raise HTTPException(status_code=404, detail="Report record not found.")
        
    if not rep.storage_url or not os.path.exists(rep.storage_url):
        raise HTTPException(status_code=404, detail="PDF file missing from storage nodes.")
        
    return FileResponse(
        path=rep.storage_url,
        media_type="application/pdf",
        filename=f"{rep.title.replace(' ', '_')}.pdf"
    )

@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete report from storage and Postgres database."""
    try:
        rep_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report ID format.")
        
    result = await db.execute(
        select(Report).filter(Report.id == rep_uuid, Report.user_id == current_user.id)
    )
    rep = result.scalars().first()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
        
    # Delete PDF file
    if rep.storage_url and os.path.exists(rep.storage_url):
        try:
            os.remove(rep.storage_url)
        except Exception as e:
            logger.error(f"Error removing PDF from disk: {e}")
            
    await db.delete(rep)
    await db.commit()
    
    return {"message": "Report successfully deleted."}

@router.post("/explain-chart")
async def explain_chart(
    req: ExplainChartRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate an AI explanation for a specific chart based on run context."""
    try:
        run_uuid = uuid.UUID(req.analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format.")
        
    result = await db.execute(
        select(Analysis)
        .filter(Analysis.id == run_uuid, Analysis.user_id == current_user.id)
    )
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found.")
        
    # Extract dynamic override headers if sent by frontend settings client
    hf_api_key = request.headers.get("X-HuggingFace-Api-Key")
    groq_api_key = request.headers.get("X-Groq-Api-Key")
    groq_model = request.headers.get("X-Groq-Model")
    
    # RAG vector context search
    query_vector = await get_query_embedding(run.query, hf_api_key=hf_api_key)
    
    where_filter = {"user_id": str(current_user.id)}
    if run.document_id:
        where_filter["document_id"] = str(run.document_id)
        
    retrieved_chunks = []
    try:
        search_results = get_chroma_collection().query(
            query_embeddings=[query_vector],
            n_results=3,
            where=where_filter
        )
        if search_results and "documents" in search_results and search_results["documents"]:
            docs = search_results["documents"][0]
            retrieved_chunks.extend(docs)
    except Exception as e:
        logger.error(f"Error querying ChromaDB inside explain-chart: {e}")
        
    context_str = "\n\n".join(retrieved_chunks)
    
    system_prompt = (
        "You are an expert Data Analyst assistant.\n"
        f"The user wants an explanation for a '{req.chart_type}' chart that was generated from the query: '{run.query}'.\n"
        "Provide a very brief, sharp 3-4 sentence explanation of what this chart likely shows and what the key takeaways are based on the context provided below.\n"
        "Do NOT include conversational filler like 'Here is the explanation'. Just the insights.\n\n"
        "CONTEXT:\n"
        f"{context_str or 'No relevant passages found.'}"
    )
    
    # 3. Compute LLM Response
    reply = await run_llm_completion(
        system_prompt, 
        [], 
        f"Explain the {req.chart_type} chart.",
        groq_api_key=groq_api_key,
        groq_model=groq_model
    )
    
    if not reply.strip():
        reply = "No insights could be generated. Please ensure your Groq API key is configured."
        
    return {"explanation": reply}
