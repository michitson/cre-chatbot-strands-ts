 ==============================================================================
# models/chat_state.py
# ==============================================================================

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from .deal_data import DealData

class ChatState(BaseModel):
    """State management for chat conversations"""
    messages: List[Dict[str, str]] = Field(default_factory=list)
    deal_id: Optional[str] = None
    property_type: Optional[str] = None
    deal_data: Optional[DealData] = None
    collected_fields: Dict[str, Any] = Field(default_factory=dict)
    step: str = "property_selection"
    irr_result: Optional[float] = None