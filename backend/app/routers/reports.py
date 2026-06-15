import os
import uuid
import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Report Generation & Export"])

class ReportCreateRequest(BaseModel):
    analysis_id: str
    title: str

def generate_pdf_report(
    file_path: str, 
    title: str, 
    analysis_query: str, 
    logs: list[AgentLog], 
    chart_config: dict | None
) -> None:
    """Compile structured print-ready PDF using ReportLab Platypus elements."""
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
    
    # Custom high-contrast styles matching Wired guidelines
    title_style = ParagraphStyle(
        'WiredTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.black,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'WiredSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#757575'),
        spaceAfter=18
    )
    
    heading_style = ParagraphStyle(
        'WiredHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.black,
        spaceBefore=14,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'WiredBody',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        leading=14,
        textColor=colors.black,
        spaceAfter=8
    )
    
    # Document header
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(f"AnalystAI Executive Summary &bull; Compiled on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Section: Context parameter focus
    story.append(Paragraph("<b>Analysis Query Focus</b>", heading_style))
    story.append(Paragraph(analysis_query, body_style))
    story.append(Spacer(1, 10))
    
    # Section: Data Forecast Table Grid
    if chart_config:
        story.append(Paragraph("<b>Projections Summary Table</b>", heading_style))
        
        hist_dates = chart_config.get("history_dates", [])
        hist_vals = chart_config.get("history_values", [])
        fc_dates = chart_config.get("forecast_dates", [])
        fc_vals = chart_config.get("forecast_values", [])
        low_b = chart_config.get("lower_bounds", [])
        upp_b = chart_config.get("upper_bounds", [])
        
        # Grid headers
        table_data = [["Date", "Classification", "Average Value", "Confidence Lower (95%)", "Confidence Upper (95%)"]]
        
        # Add last 3 historical context points
        for i in range(max(0, len(hist_vals) - 3), len(hist_vals)):
            table_data.append([
                hist_dates[i], 
                "Historical", 
                f"{hist_vals[i]:.2f}", 
                "-", 
                "-"
            ])
            
        # Add future forecast projection steps
        for i in range(len(fc_vals)):
            table_data.append([
                fc_dates[i], 
                "Forecast", 
                f"{fc_vals[i]:.2f}", 
                f"{low_b[i]:.2f}" if i < len(low_b) else "-", 
                f"{upp_b[i]:.2f}" if i < len(upp_b) else "-"
            ])
            
        t = Table(table_data, colWidths=[100, 90, 100, 110, 110])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#000000')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 8.5),
            ('BOTTOMPADDING', (0,0), (-1,0), 5),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#fbfbfb')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0e0e0')),
            ('FONTNAME', (0,1), (-1,-1), 'Times-Roman'),
            ('FONTSIZE', (0,1), (-1,-1), 9.5),
            ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ]))
        story.append(t)
        story.append(Spacer(1, 15))
        
    # Section: Audit logs summary
    if logs:
        story.append(Paragraph("<b>Pipeline Agent Audit Logs</b>", heading_style))
        for log in logs:
            agent_title = f"<b>Agent: {log.agent_name}</b> (Duration: {log.duration_ms} ms)"
            story.append(Paragraph(agent_title, body_style))
            
            output = log.output_data or {}
            if "outliers_detected" in output:
                scrubbed_summary = (
                    f"Action: Scanned {len(output.get('numeric_columns_scanned', []))} numeric column(s). "
                    f"Identified and winsorized {output.get('outliers_detected')} data outliers."
                )
                story.append(Paragraph(scrubbed_summary, body_style))
            elif "method" in output:
                forecast_summary = (
                    f"Action: Selected model: {output.get('method')}. "
                    f"Projected {output.get('steps')} steps into future using {output.get('historical_points')} historical points."
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
            chart_config
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
