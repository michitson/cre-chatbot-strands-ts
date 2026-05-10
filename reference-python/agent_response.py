# ==============================================================================
# models/agent_response.py - Structured response schema for LLM-driven UX
# ==============================================================================

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from enum import Enum

class UIState(Enum):
    """UI state indicators for frontend"""
    CHAT = "chat"
    ANALYSIS_MODE = "analysis_mode"
    COMPLETE = "complete"

class AnalysisPhase(Enum):
    """Analysis phase indicators"""
    PROPERTY_SELECTION = "property_selection"
    DATA_COLLECTION = "data_collection"
    VALIDATION = "validation"
    CALCULATION = "calculation"
    COMPLETE = "complete"

class ProgressInfo(BaseModel):
    """Progress tracking information"""
    current: int = Field(description="Current step number")
    total: int = Field(description="Total number of steps")
    field_name: Optional[str] = Field(default=None, description="Current field being collected")
    
class AgentResponse(BaseModel):
    """
    Structured response schema that LLM can populate to provide UX signals
    while maintaining full control over content and formatting
    """
    message: str = Field(description="LLM-generated response with professional formatting")
    ui_state: Optional[UIState] = Field(default=None, description="UI state signal for frontend")
    analysis_phase: Optional[AnalysisPhase] = Field(default=None, description="Current analysis phase")
    progress: Optional[ProgressInfo] = Field(default=None, description="Progress information")
    deal_mode: Optional[bool] = Field(default=None, description="Whether we're in deal analysis mode")
    
    class Config:
        use_enum_values = True

class LLMResponseParser:
    """Helper class to extract UX signals from LLM responses"""
    
    @staticmethod
    def parse_response_for_ui_signals(response_text: str, current_state) -> AgentResponse:
        """
        Parse LLM response text to extract UI signals while preserving the message
        This allows the LLM to control UX through its natural language output
        """
        
        # Initialize with the LLM's message
        agent_response = AgentResponse(message=response_text)
        
        # Detect UI state transitions based on LLM's language choices
        response_lower = response_text.lower()
        
        # Property type selection phase
        if any(phrase in response_lower for phrase in [
            "what type of property", "property type", "office building", "shopping center"
        ]) and current_state.step == 'property_selection':
            agent_response.ui_state = UIState.CHAT
            agent_response.analysis_phase = AnalysisPhase.PROPERTY_SELECTION
            
        # Analysis mode beginning - LLM uses specific formatting
        elif any(phrase in response_lower for phrase in [
            "✅", "analysis selected", "let's analyze", "i'll need some information"
        ]) and current_state.step == 'data_collection':
            agent_response.ui_state = UIState.ANALYSIS_MODE
            agent_response.analysis_phase = AnalysisPhase.DATA_COLLECTION
            agent_response.deal_mode = True
            
            # Extract progress if LLM included it
            progress_info = LLMResponseParser._extract_progress(response_text, current_state)
            if progress_info:
                agent_response.progress = progress_info
                
        # Data collection in progress
        elif current_state.step == 'data_collection' and current_state.collected_fields:
            agent_response.ui_state = UIState.ANALYSIS_MODE
            agent_response.analysis_phase = AnalysisPhase.DATA_COLLECTION
            agent_response.deal_mode = True
            
            # Extract progress
            progress_info = LLMResponseParser._extract_progress(response_text, current_state)
            if progress_info:
                agent_response.progress = progress_info
                
        # Validation phase
        elif current_state.step == 'validation':
            agent_response.ui_state = UIState.ANALYSIS_MODE
            agent_response.analysis_phase = AnalysisPhase.VALIDATION
            agent_response.deal_mode = True
            
        # Calculation phase
        elif current_state.step == 'calculation' or 'calculating' in response_lower:
            agent_response.ui_state = UIState.ANALYSIS_MODE
            agent_response.analysis_phase = AnalysisPhase.CALCULATION
            agent_response.deal_mode = True
            
        # Exit deal mode - return to chat
        elif any(phrase in response_lower for phrase in [
            "exited deal mode", "back to regular chat", "regular chat mode"
        ]):
            agent_response.ui_state = UIState.CHAT
            agent_response.analysis_phase = None
            agent_response.deal_mode = False
            
        # Complete phase - LLM shows results
        elif current_state.step == 'complete' or any(phrase in response_lower for phrase in [
            "irr analysis results", "analysis complete", "recommendation"
        ]):
            agent_response.ui_state = UIState.COMPLETE
            agent_response.analysis_phase = AnalysisPhase.COMPLETE
            agent_response.deal_mode = True
            
        return agent_response
    
    @staticmethod
    def _extract_progress(response_text: str, current_state) -> Optional[ProgressInfo]:
        """Extract progress information from LLM response"""
        try:
            # Import here to avoid circular imports
            from config.field_configs import FIELD_CONFIGS, FIELD_ORDER
            
            # Count total required fields dynamically
            total_required_fields = sum(1 for f in FIELD_ORDER if FIELD_CONFIGS[f].required)
            
            # Count collected required fields only
            collected_required_count = sum(1 for f in current_state.collected_fields.keys() 
                                         if f in FIELD_CONFIGS and FIELD_CONFIGS[f].required)
                
            # Try to find current field name from field management
            current_field = None
            if hasattr(current_state, 'collected_fields'):
                from tools.field_management import get_next_field_to_collect
                next_field = get_next_field_to_collect.invoke({"collected_fields": current_state.collected_fields})
                current_field = next_field
            
            return ProgressInfo(
                current=collected_required_count,
                total=total_required_fields,
                field_name=current_field
            )
            
        except Exception:
            return None