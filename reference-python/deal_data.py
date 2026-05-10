# ==============================================================================
# models/deal_data.py
# ==============================================================================

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class DealData(BaseModel):
    """Pydantic model for commercial real estate deal data"""
    deal_name: str = Field(..., description="Name of the deal")
    purchase_price: int = Field(..., gt=0, description="Purchase price in dollars")
    net_operating_income: int = Field(..., gt=0, description="Net Operating Income in dollars")
    noi_growth_rate: float = Field(..., ge=0, le=100, description="NOI Growth rate as percentage")
    hold_period: int = Field(..., gt=0, le=50, description="Hold period in years")
    exit_cap_rate: float = Field(..., gt=0, le=100, description="Exit cap rate as percentage")
    city: Optional[str] = Field(None, description="City location (optional)")

class FieldConfig(BaseModel):
    """Configuration for each field with LLM context"""
    name: str
    prompt: str
    field_type: str
    required: bool = True
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    description: str = Field(description="Detailed description of what this field represents")
    examples: List[str] = Field(default_factory=list, description="Example valid inputs")
    common_formats: List[str] = Field(default_factory=list, description="Common input formats")