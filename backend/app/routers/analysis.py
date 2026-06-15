import os
import time
import uuid
import logging
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.arima.model import ARIMA

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.analysis import Analysis
from app.models.agent_log import AgentLog
from app.models.chart import Chart
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["Analytics & Forecasting"])

class AnalysisRequest(BaseModel):
    document_id: str
    target_column: str
    date_column: str
    clean_outliers: bool = True
    forecast_steps: int = 12

def parse_dataset(file_path: str, extension: str) -> pd.DataFrame:
    """Read local file into Pandas DataFrame."""
    if not os.path.exists(file_path):
        raise FileNotFoundError("The document data file does not exist in local storage.")
        
    if extension == "csv":
        return pd.read_csv(file_path)
    elif extension in ["xlsx", "xls"]:
        return pd.read_excel(file_path)
    else:
        # Fallback to csv
        try:
            return pd.read_csv(file_path)
        except Exception:
            return pd.read_excel(file_path)

def clean_data_agent(df: pd.DataFrame, clean_outliers: bool) -> tuple[pd.DataFrame, dict]:
    """IQR winsorizing cleansing agent."""
    start_time = time.time()
    initial_rows = len(df)
    outliers_detected = 0
    outliers_details = {}
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if clean_outliers:
        for col in numeric_cols:
            # Drop NaN rows temporarily for quantile calculations
            series_clean = df[col].dropna()
            if len(series_clean) < 4:
                continue
                
            q1 = series_clean.quantile(0.25)
            q3 = series_clean.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            outliers_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
            count = int(outliers_mask.sum())
            
            if count > 0:
                outliers_detected += count
                outliers_details[col] = {
                    "count": count,
                    "lower_limit": float(lower_bound),
                    "upper_limit": float(upper_bound),
                    "mean_before": float(series_clean.mean())
                }
                # Winsorize / clip outliers
                df[col] = df[col].clip(lower=lower_bound, upper=upper_bound)
                
    duration_ms = int((time.time() - start_time) * 1000)
    
    log = {
        "status": "success",
        "duration_ms": duration_ms,
        "initial_rows": initial_rows,
        "outliers_detected": outliers_detected,
        "outliers_details": outliers_details,
        "numeric_columns_scanned": numeric_cols
    }
    return df, log

def forecast_agent(df: pd.DataFrame, date_col: str, target_col: str, steps: int) -> tuple[dict, dict]:
    """Time-series forecasting agent (ARIMA or regression fallback)."""
    start_time = time.time()
    
    # 1. Clean dates and targets
    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
    df = df.dropna(subset=[date_col, target_col])
    
    # Enforce numeric conversion on target
    df[target_col] = pd.to_numeric(df[target_col], errors='coerce')
    df = df.dropna(subset=[target_col])
    
    df = df.sort_values(by=date_col)
    
    # Group duplicates
    series = df.groupby(date_col)[target_col].mean()
    
    if len(series) < 5:
        raise ValueError("At least 5 valid historical data points are required to generate time-series projections.")
        
    history_dates = series.index.strftime('%Y-%m-%d').tolist()
    history_values = [float(v) for v in series.values]
    
    predictions = []
    lower_bounds = []
    upper_bounds = []
    method = "ARIMA"
    coefficients = {}
    
    try:
        # Simple ARIMA(1,1,1)
        model = ARIMA(series.values, order=(1, 1, 1))
        model_fit = model.fit()
        
        # Save coefficients for logs
        coefficients = {k: float(v) for k, v in model_fit.params.items()}
        
        forecast = model_fit.get_forecast(steps=steps)
        predictions = [float(v) for v in forecast.predicted_mean]
        
        conf_int = forecast.conf_int(alpha=0.05)
        lower_bounds = [float(v) for v in conf_int[:, 0]]
        upper_bounds = [float(v) for v in conf_int[:, 1]]
    except Exception as e:
        logger.warning(f"ARIMA fit failed, falling back to Trend Linear Regression: {e}")
        method = "Linear Regression (Trend)"
        
        X = np.arange(len(history_values)).reshape(-1, 1)
        y = np.array(history_values)
        reg = LinearRegression().fit(X, y)
        
        coefficients = {
            "slope": float(reg.coef_[0]),
            "intercept": float(reg.intercept_)
        }
        
        future_X = np.arange(len(history_values), len(history_values) + steps).reshape(-1, 1)
        predictions = [float(v) for v in reg.predict(future_X)]
        
        y_pred = reg.predict(X)
        residuals = y - y_pred
        std_err = float(np.std(residuals)) if len(residuals) > 1 else 1.0
        
        lower_bounds = [float(p - 1.96 * std_err) for p in predictions]
        upper_bounds = [float(p + 1.96 * std_err) for p in predictions]

    # Generate future dates
    diffs = pd.Series(series.index).diff().dropna()
    # Fallback to 1 day if not calculable
    median_diff = diffs.median() if len(diffs) > 0 else pd.Timedelta(days=1)
    
    future_dates = []
    last_date = series.index[-1]
    for i in range(1, steps + 1):
        next_date = last_date + (median_diff * i)
        future_dates.append(next_date.strftime('%Y-%m-%d'))
        
    duration_ms = int((time.time() - start_time) * 1000)
    
    result_data = {
        "method": method,
        "history_dates": history_dates,
        "history_values": history_values,
        "forecast_dates": future_dates,
        "forecast_values": predictions,
        "lower_bounds": lower_bounds,
        "upper_bounds": upper_bounds
    }
    
    log = {
        "status": "success",
        "duration_ms": duration_ms,
        "method": method,
        "steps": steps,
        "coefficients": coefficients,
        "historical_points": len(history_values)
    }
    
    return result_data, log

@router.post("/run", status_code=status.HTTP_201_CREATED)
async def run_analytics(
    req: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    start_run_time = time.time()
    
    # 1. Fetch document and verify ownership
    try:
        doc_uuid = uuid.UUID(req.document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format.")
        
    doc_result = await db.execute(
        select(Document).filter(Document.id == doc_uuid, Document.user_id == current_user.id)
    )
    doc = doc_result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    if not doc.storage_url or not os.path.exists(doc.storage_url):
        raise HTTPException(status_code=404, detail="Raw data file missing from storage nodes.")
        
    # 2. Parse file into DataFrame
    try:
        df = parse_dataset(doc.storage_url, doc.file_type)
    except Exception as e:
        logger.error(f"Error reading dataset: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load dataset: {str(e)}")
        
    # Verify columns exist
    if req.date_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Date column '{req.date_column}' not found in dataset.")
    if req.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{req.target_column}' not found in dataset.")
        
    # Create Analysis record
    analysis_id = uuid.uuid4()
    new_analysis = Analysis(
        id=analysis_id,
        user_id=current_user.id,
        document_id=doc_uuid,
        query=f"Clean outlier metrics and forecast '{req.target_column}' by date '{req.date_column}' for {req.forecast_steps} periods.",
        status="processing"
    )
    db.add(new_analysis)
    await db.commit()
    
    # 3. Clean outliers
    try:
        cleaned_df, clean_log = clean_data_agent(df, req.clean_outliers)
    except Exception as e:
        new_analysis.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Data scrubbing agent failed: {str(e)}")
        
    # 4. Generate forecasts
    try:
        forecast_results, forecast_log = forecast_agent(
            cleaned_df, req.date_column, req.target_column, req.forecast_steps
        )
    except Exception as e:
        new_analysis.status = "error"
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Forecasting agent simulation failed: {str(e)}")
        
    duration_ms = int((time.time() - start_run_time) * 1000)
    
    # Update Analysis
    new_analysis.status = "completed"
    new_analysis.result = {
        "outlier_summary": clean_log,
        "forecast_summary": forecast_log,
        "target_column": req.target_column,
        "date_column": req.date_column
    }
    new_analysis.duration_ms = duration_ms
    
    # Record Agent Logs
    clean_log_uuid = uuid.uuid4()
    db_clean_log = AgentLog(
        id=clean_log_uuid,
        analysis_id=analysis_id,
        agent_name="Data Cleansing Agent",
        input_data={"clean_outliers": req.clean_outliers, "numeric_columns": clean_log["numeric_columns_scanned"]},
        output_data=clean_log,
        duration_ms=clean_log["duration_ms"]
    )
    db.add(db_clean_log)
    
    forecast_log_uuid = uuid.uuid4()
    db_forecast_log = AgentLog(
        id=forecast_log_uuid,
        analysis_id=analysis_id,
        agent_name="Time-Series Forecasting Agent",
        input_data={"target_column": req.target_column, "date_column": req.date_column, "steps": req.forecast_steps},
        output_data=forecast_log,
        duration_ms=forecast_log["duration_ms"]
    )
    db.add(db_forecast_log)
    
    # Create Chart config
    chart_id = uuid.uuid4()
    db_chart = Chart(
        id=chart_id,
        analysis_id=analysis_id,
        chart_type="line",
        config=forecast_results
    )
    db.add(db_chart)
    
    await db.commit()
    
    return {
        "analysis_id": str(analysis_id),
        "status": "completed",
        "duration_ms": duration_ms,
        "results": forecast_results,
        "logs": {
            "cleansing": clean_log,
            "forecasting": forecast_log
        }
    }

@router.get("")
async def list_analyses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Analysis)
        .filter(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
    )
    runs = result.scalars().all()
    return [
        {
            "id": str(run.id),
            "document_id": str(run.document_id) if run.document_id else None,
            "query": run.query,
            "status": run.status,
            "duration_ms": run.duration_ms,
            "created_at": run.created_at
        }
        for run in runs
    ]

@router.get("/{analysis_id}")
async def get_analysis_details(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        run_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format.")
        
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
        
    # Extract chart config
    chart_data = None
    if run.charts:
        chart_data = {
            "id": str(run.charts[0].id),
            "chart_type": run.charts[0].chart_type,
            "config": run.charts[0].config
        }
        
    return {
        "id": str(run.id),
        "document_id": str(run.document_id) if run.document_id else None,
        "query": run.query,
        "status": run.status,
        "duration_ms": run.duration_ms,
        "result_metadata": run.result,
        "created_at": run.created_at,
        "logs": [
            {
                "agent_name": log.agent_name,
                "input": log.input_data,
                "output": log.output_data,
                "duration_ms": log.duration_ms,
                "error": log.error,
                "created_at": log.created_at
            }
            for log in run.agent_logs
        ],
        "chart": chart_data
    }
