import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class Chart(Base):
    __tablename__ = "charts"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(PortableUUID(), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    chart_type = Column(String, nullable=False)  # 'bar'|'pie'|'histogram'|'line'|'scatter'|'heatmap'|'kpi_cards'|'choropleth'
    config = Column(JSON, nullable=False)  # Plotly figure JSON
    storage_url = Column(String, nullable=True)  # If exported to static image
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    analysis = relationship("Analysis", back_populates="charts")
