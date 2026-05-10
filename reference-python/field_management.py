# ==============================================================================
# tools/field_management.py
# ==============================================================================

from langchain_core.tools import tool
from typing import Dict, Any, List, Optional, Tuple
from config.field_configs import FIELD_CONFIGS, FIELD_ORDER
from models.deal_data import DealData
from pydantic import ValidationError

@tool
def get_missing_required_fields(collected_fields: Dict[str, Any]) -> List[str]:
    """Determine which required fields are still missing"""
    missing = []
    for field_name in FIELD_ORDER:
        config = FIELD_CONFIGS[field_name]
        if config.required and field_name not in collected_fields:
            missing.append(field_name)
    return missing

@tool
def get_next_field_to_collect(collected_fields: Dict[str, Any]) -> Optional[str]:
    """Get the next field that should be collected"""
    missing_required = get_missing_required_fields.invoke({"collected_fields": collected_fields})
    if missing_required:
        return missing_required[0]
    
    for field_name in FIELD_ORDER:
        config = FIELD_CONFIGS[field_name]
        if not config.required and field_name not in collected_fields:
            return field_name
    return None

@tool
def get_field_prompt(field_name: str) -> str:
    """Get the professionally formatted prompt text for a specific field"""
    if field_name in FIELD_CONFIGS:
        config = FIELD_CONFIGS[field_name]
        field_display = field_name.replace('_', ' ').title()
        
        # Add appropriate emoji based on field type
        emoji = _get_field_emoji(field_name)
        
        # Format the prompt professionally
        prompt = f"{emoji} **{field_display}**\n\n{config.prompt}"
        
        # Add examples if available
        if config.examples:
            prompt += f"\n\n*Examples: {', '.join(config.examples)}*"
            
        return prompt
    
    # Fallback for unknown fields
    field_display = field_name.replace('_', ' ').title()
    return f"📝 **{field_display}**\n\nPlease provide the {field_display.lower()}:"

def _get_field_emoji(field_name: str) -> str:
    """Get appropriate emoji for field type"""
    emoji_map = {
        'deal_name': '📝',
        'purchase_price': '💰',
        'net_operating_income': '📊',
        'noi_growth_rate': '📈',
        'hold_period': '⏰',
        'exit_cap_rate': '🎯',
        'city': '🌆',
        'address': '📍'
    }
    return emoji_map.get(field_name, '📋')

@tool
def validate_all_collected_fields(collected_fields: Dict[str, Any]) -> Tuple[bool, Optional[DealData], str]:
    """Validate that all required fields are collected and create DealData object"""
    missing_required = get_missing_required_fields.invoke({"collected_fields": collected_fields})
    if missing_required:
        return False, None, f"Missing required fields: {', '.join(missing_required)}"
    
    try:
        deal_data = DealData(**collected_fields)
        return True, deal_data, ""
    except ValidationError as e:
        error_details = e.errors()[0]
        field_name = error_details['loc'][0]
        error_msg = error_details['msg']
        return False, None, f"Validation error for {field_name}: {error_msg}"