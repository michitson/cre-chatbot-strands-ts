 ==============================================================================
# tools/deal_calculator.py - IRR calculation tools
# ==============================================================================

from langchain_core.tools import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

@tool
def calculate_irr_analysis(deal_data: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate IRR and comprehensive deal analysis
    
    Args:
        deal_data: Dictionary containing deal parameters
        
    Returns:
        Dictionary with IRR and analysis results
    """
    try:
        # Extract deal parameters
        purchase_price = deal_data['purchase_price']
        noi_year_1 = deal_data['net_operating_income']
        noi_growth_rate = deal_data['noi_growth_rate'] / 100  # Convert to decimal
        hold_period = deal_data['hold_period']
        exit_cap_rate = deal_data['exit_cap_rate'] / 100  # Convert to decimal
        
        # Calculate cash flows for each year
        cash_flows = []
        
        # Year 0 - Initial investment (negative)
        cash_flows.append(-purchase_price)
        
        # Years 1 to hold_period - Annual NOI
        for year in range(1, hold_period + 1):
            annual_noi = noi_year_1 * ((1 + noi_growth_rate) ** (year - 1))
            cash_flows.append(annual_noi)
        
        # Final year - Add exit value
        final_year_noi = noi_year_1 * ((1 + noi_growth_rate) ** hold_period)
        exit_value = final_year_noi / exit_cap_rate
        cash_flows[-1] += exit_value  # Add to final year cash flow
        
        # Calculate IRR using manual bisection method
        irr = calculate_irr_manual(cash_flows)
        
        # Calculate additional metrics
        total_cash_inflow = sum(cash_flows[1:])
        total_return = ((total_cash_inflow / purchase_price) - 1) * 100
        
        return {
            'irr': irr * 100,  # Convert to percentage
            'total_return': total_return,
            'annual_cash_flow': noi_year_1,
            'exit_value': exit_value,
            'cash_flows': cash_flows
        }
        
    except Exception as e:
        logger.error(f"Error calculating IRR: {e}")
        raise ValueError(f"Could not calculate IRR: {str(e)}")

def calculate_irr_manual(cash_flows):
    """Manual IRR calculation using bisection method"""
    def npv(rate, cash_flows):
        return sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
    
    # Bisection method to find IRR
    low, high = -0.99, 10.0  # Search between -99% and 1000%
    
    for _ in range(100):  # Max iterations
        mid = (low + high) / 2
        if abs(npv(mid, cash_flows)) < 1e-6:
            return mid
        elif npv(mid, cash_flows) > 0:
            low = mid
        else:
            high = mid
    
    return mid

@tool  
def calculate_sensitivity_analysis(deal_data: Dict[str, Any], variable: str) -> Dict[str, Any]:
    """
    Perform sensitivity analysis on a key variable
    
    Args:
        deal_data: Base deal parameters
        variable: Variable to analyze ('noi_growth_rate', 'exit_cap_rate', etc.)
        range_percent: Percentage range to test (+/- from base)
        
    Returns:
        Dictionary with sensitivity results
    """
    base_irr = calculate_irr_analysis.invoke({"deal_data": deal_data})['irr']
    
    # Create range of values
    base_value = deal_data[variable]
    range_values = []
    irr_results = []
    
    for multiplier in [0.8, 0.9, 1.0, 1.1, 1.2]:  # -20%, -10%, base, +10%, +20%
        test_data = deal_data.copy()
        test_data[variable] = base_value * multiplier
        
        try:
            test_irr = calculate_irr_analysis.invoke({"deal_data": test_data})['irr']
            range_values.append(base_value * multiplier)
            irr_results.append(test_irr)
        except:
            continue
    
    return {
        'variable': variable,
        'base_value': base_value,
        'base_irr': base_irr,
        'range_values': range_values,
        'irr_results': irr_results
    }