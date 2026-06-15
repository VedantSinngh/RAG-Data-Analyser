import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Chart(Base):
    __tablename__ = "charts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    chart_type = Column(String, nullable=False) # 'bar'|'pie'|'histogram'|'line'|'scatter'|'heatmap'|'kpi_cards'|'choropleth'
    config = Column(JSONB, nullable=False) # Plotly figure JSON
    storage_url = Column(String, nullable=True) # If exported to static image
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    analysis = relationship("Analysis", back_populates="charts")
