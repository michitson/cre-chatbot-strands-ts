# ==============================================================================
# workflow/nodes.py - LangGraph workflow nodes
# ==============================================================================

from typing import Dict, Any, List
from langchain_core.tools import tool
from models.chat_state import ChatState
from models.deal_data import DealData
from tools.field_management import (
    get_next_field_to_collect, 
    get_field_prompt,
    validate_all_collected_fields
)
from tools.field_parser import parse_field_with_context
from tools.deal_calculator import calculate_irr_analysis
import uuid

def _format_field_value(field_name: str, value) -> str:
    """Format field values for professional display"""
    if field_name in ['purchase_price', 'net_operating_income']:
        if isinstance(value, (int, float)):
            return f"${value:,.0f}"
    elif field_name in ['noi_growth_rate', 'exit_cap_rate']:
        if isinstance(value, (int, float)):
            return f"{value}%"
    elif field_name == 'hold_period':
        if isinstance(value, (int, float)):
            return f"{value} years"
    elif field_name == 'deal_name':
        return f'"{value}"'
    
    return str(value)

def property_selection_node(state: ChatState) -> ChatState:
    """Handle property type selection with enhanced UX formatting"""
    # If we already have a property type selected, don't re-process
    if state.property_type and state.step == 'data_collection':
        return state
        
    last_message = state.messages[-1] if state.messages else {}
    user_input = last_message.get('content', '').lower()
    
    # Handle exit request during property selection
    if any(phrase in user_input for phrase in ['exit', 'exit deal mode', 'quit', 'cancel']):
        response = """👋 **Exited Deal Mode**

You're now back to regular chat mode. I can help you with:

💬 General questions and conversations
🏢 Real estate analysis (just say "I want to analyze a deal")
📊 Financial calculations and advice

How can I assist you today?"""
        
        # Reset to completely clean state
        return ChatState(
            messages=[{"role": "assistant", "content": response}],
            step='property_selection'  # Ready for new analysis if requested
        )
    
    if 'office' in user_input:
        state.property_type = 'office'
        state.step = 'data_collection'
        state.deal_id = str(uuid.uuid4())
        
        # Enhanced professional response with visual formatting
        response = """✅ **Office Building Analysis Selected**

Perfect! I'll guide you through a structured analysis of this commercial office property. I'll need some key information to calculate the IRR and provide investment recommendations.

**Analysis Beginning** 📊

"""
        
        # Get first field to collect
        next_field = get_next_field_to_collect.invoke({"collected_fields": state.collected_fields})
        if next_field:
            response += get_field_prompt.invoke({"field_name": next_field})
        
        state.messages.append({"role": "assistant", "content": response})
        
    elif 'shopping' in user_input or 'retail' in user_input:
        state.property_type = 'shopping_center'
        state.step = 'data_collection'
        state.deal_id = str(uuid.uuid4())
        
        # Enhanced professional response with visual formatting
        response = """✅ **Shopping Center Analysis Selected**

Excellent! I'll guide you through a structured analysis of this retail property. I'll need some key information to calculate the IRR and provide investment recommendations.

**Analysis Beginning** 🛍️

"""
        
        # Get first field to collect
        next_field = get_next_field_to_collect.invoke({"collected_fields": state.collected_fields})
        if next_field:
            response += get_field_prompt.invoke({"field_name": next_field})
        
        state.messages.append({"role": "assistant", "content": response})
        
    else:
        response = """🏢 **Commercial Real Estate Analysis**

I can help you analyze commercial real estate deals with professional IRR calculations and investment recommendations.

**What type of property would you like to analyze?**

1️⃣ **Office Building** - Multi-tenant office properties
2️⃣ **Shopping Center** - Retail and mixed-use properties

Type **"office"** or **"shopping center"** to begin your analysis."""
        
        state.messages.append({"role": "assistant", "content": response})
    
    return state

def data_collection_node(state: ChatState) -> ChatState:
    """Handle data collection with LLM-powered parsing"""
    last_message = state.messages[-1] if state.messages else {}
    user_input = last_message.get('content', '')
    
    # Skip if the last message is from assistant (workflow just ran property_selection)
    if last_message.get('role') == 'assistant':
        return state
    
    # Skip processing property type selection messages
    if user_input.lower().strip() in ['office', 'shopping center', 'retail']:
        return state
    
    # Handle exit deal mode request at any time during data collection
    if any(phrase in user_input.lower() for phrase in ['exit', 'exit deal mode', 'quit', 'cancel']):
        response = """👋 **Exited Deal Mode**

You're now back to regular chat mode. I can help you with:

💬 General questions and conversations
🏢 Real estate analysis (just say "I want to analyze a deal")
📊 Financial calculations and advice

How can I assist you today?"""
        
        # Reset to completely clean state
        new_state = ChatState(
            messages=[{"role": "assistant", "content": response}],
            step='property_selection'  # Ready for new analysis if requested
        )
        return new_state
        
    if user_input.strip():
        next_field = get_next_field_to_collect.invoke({"collected_fields": state.collected_fields})
        
        if next_field:
            # Use LLM parsing with conversation context
            conversation_context = {
                'property_type': state.property_type,
                'deal_name': state.collected_fields.get('deal_name'),
                'collected_fields': state.collected_fields
            }
            
            success, value, error_msg = parse_field_with_context.invoke({
                "field_name": next_field, 
                "user_input": user_input, 
                "context": conversation_context
            })
            
            if success:
                state.collected_fields[next_field] = value
                
                # Format the confirmed value professionally
                formatted_value = _format_field_value(next_field, value)
                field_display = next_field.replace('_', ' ').title()
                
                # Professional confirmation with visual formatting
                response = f"✅ **{field_display}**: {formatted_value}\n\n"
                
                # Calculate progress (count required fields only)
                from tools.field_management import get_missing_required_fields
                from config.field_configs import FIELD_CONFIGS, FIELD_ORDER
                
                # Count total required fields
                total_required_fields = sum(1 for f in FIELD_ORDER if FIELD_CONFIGS[f].required)
                # Count collected required fields
                collected_required_fields = sum(1 for f in state.collected_fields.keys() 
                                               if f in FIELD_CONFIGS and FIELD_CONFIGS[f].required)
                
                # Check if we have all required fields
                is_valid, deal_data, validation_error = validate_all_collected_fields.invoke({"collected_fields": state.collected_fields})
                
                if is_valid:
                    state.deal_data = deal_data
                    state.step = 'calculation'
                    response += "🎉 **All Information Collected!**\n\nCalculating your IRR analysis..."
                else:
                    # Show progress and continue to next field
                    response += f"**Progress**: {collected_required_fields}/{total_required_fields} fields completed\n\n"
                    
                    next_next_field = get_next_field_to_collect.invoke({"collected_fields": state.collected_fields})
                    if next_next_field:
                        response += get_field_prompt.invoke({"field_name": next_next_field})
                    else:
                        response += "📋 **Validating Information...**"
                        state.step = 'validation'
                
            else:
                field_display = next_field.replace('_', ' ').title()
                response = f"❓ **I need clarification on {field_display}**\n\n{error_msg}\n\n{get_field_prompt.invoke({'field_name': next_field})}"
                
            state.messages.append({"role": "assistant", "content": response})
            
        else:
            # All fields collected, move to validation
            state.step = 'validation'
            response = "Great! Let me validate all the information you've provided..."
            state.messages.append({"role": "assistant", "content": response})
    
    return state

def validation_node(state: ChatState) -> ChatState:
    """Validate collected data and create DealData object"""
    is_valid, deal_data, error_msg = validate_all_collected_fields.invoke({"collected_fields": state.collected_fields})
    
    if is_valid:
        state.deal_data = deal_data
        state.step = 'calculation'
        
        # Create professional summary of collected data
        property_type_display = state.property_type.replace('_', ' ').title()
        response = f"""✅ **Data Validation Complete**

Perfect! Here's a summary of your {property_type_display} investment:

## 📋 **{deal_data.deal_name}**

**Financial Overview:**
💰 Purchase Price: ${deal_data.purchase_price:,}
📊 Net Operating Income: ${deal_data.net_operating_income:,}
📈 NOI Growth Rate: {deal_data.noi_growth_rate}% annually
⏰ Hold Period: {deal_data.hold_period} years
🎯 Exit Cap Rate: {deal_data.exit_cap_rate}%"""

        if deal_data.city:
            response += f"\n🌆 Location: {deal_data.city}"
        
        response += "\n\n🔄 **Calculating IRR Analysis...**"
        
    else:
        response = f"""❌ **Data Validation Issue**

{error_msg}

Let me ask for that information again..."""
        state.step = 'data_collection'
    
    state.messages.append({"role": "assistant", "content": response})
    return state

def calculation_node(state: ChatState) -> ChatState:
    """Perform IRR calculation and analysis"""
    if not state.deal_data:
        state.step = 'validation'
        response = "I need to validate the deal data first..."
        state.messages.append({"role": "assistant", "content": response})
        return state
    
    try:
        # Calculate IRR
        irr_result = calculate_irr_analysis.invoke({"deal_data": state.deal_data.model_dump()})
        state.irr_result = irr_result['irr']
        
        # Create detailed response
        response = f"""## 📊 IRR Analysis Results

**{state.deal_data.deal_name}**

### Key Metrics:
- **Internal Rate of Return (IRR): {irr_result['irr']:.2f}%**
- **Total Return: {irr_result['total_return']:.1f}%**
- **Annual Cash Flow (Year 1): ${irr_result['annual_cash_flow']:,.0f}**
- **Exit Value: ${irr_result['exit_value']:,.0f}**

### Investment Summary:
- Initial Investment: ${state.deal_data.purchase_price:,}
- Hold Period: {state.deal_data.hold_period} years
- NOI Growth: {state.deal_data.noi_growth_rate}% annually

### Analysis:
"""
        
        # Add performance assessment
        if irr_result['irr'] >= 15:
            response += "🟢 **Excellent Return** - This deal shows strong performance above typical real estate benchmarks."
        elif irr_result['irr'] >= 12:
            response += "🟡 **Good Return** - This deal meets typical commercial real estate return expectations."
        elif irr_result['irr'] >= 8:
            response += "🟠 **Moderate Return** - This deal provides moderate returns. Consider if it meets your risk-adjusted requirements."
        else:
            response += "🔴 **Below Market** - This deal shows below-market returns. Review assumptions or consider alternative investments."
        
        response += f"""

## 🎯 **Next Steps**

What would you like to do next?

1️⃣ **Analyze a New Deal** - Start fresh with property type selection
2️⃣ **Adjust Assumptions** - Modify parameters for this deal  
3️⃣ **Export Results** - Get a summary for your records
4️⃣ **Exit Deal Mode** - Return to regular chat

Just let me know your preference!"""

        state.step = 'complete'
        
    except Exception as e:
        response = f"I encountered an error calculating the IRR: {str(e)}\n\nLet me review the data again..."
        state.step = 'validation'
    
    state.messages.append({"role": "assistant", "content": response})
    return state

def complete_node(state: ChatState) -> ChatState:
    """Handle post-analysis interactions"""
    
    # Find the last USER message, not assistant message
    last_user_message = None
    for message in reversed(state.messages):
        if message.get('role') == 'user':
            last_user_message = message
            break
    
    user_input = last_user_message.get('content', '').lower() if last_user_message else ''
    
    # Check if this is the first time in complete_node (just finished calculation)
    # vs. user providing new input for post-analysis actions
    assistant_messages = [msg for msg in state.messages if msg.get('role') == 'assistant']
    last_assistant_message = assistant_messages[-1] if assistant_messages else {}
    
    # If the last assistant message contains IRR results, this is the first time in complete_node
    # We should not process any user input - just show the results and wait
    if 'irr analysis results' in last_assistant_message.get('content', '').lower():
        return state
    
    if 'new deal' in user_input or 'new' in user_input:
        # Reset for new deal
        response = """🆕 **Starting New Analysis**

Great! Let's analyze another deal. What type of property would you like to analyze?

🏢 **Commercial Real Estate Analysis**

1️⃣ **Office Building** - Multi-tenant office properties  
2️⃣ **Shopping Center** - Retail and mixed-use properties

Type **"office"** or **"shopping center"** to begin your analysis."""
        state.messages.append({"role": "assistant", "content": response})
        
        # Reset state for new deal
        return ChatState(
            messages=state.messages,
            step='property_selection'
        )
        
    elif 'exit' in user_input or 'exit deal mode' in user_input or '4' in user_input:
        # Exit deal mode entirely - return to regular chat
        response = """👋 **Exited Deal Mode**

You're now back to regular chat mode. I can help you with:

💬 General questions and conversations
🏢 Real estate analysis (just say "I want to analyze a deal")
📊 Financial calculations and advice

How can I assist you today?"""
        
        # Reset to completely clean state (like refreshing the page)
        return ChatState(
            messages=[{"role": "assistant", "content": response}],
            step='property_selection'  # Ready for new analysis if requested
        )
        
    elif 'adjust' in user_input or 'change' in user_input:
        response = """🔧 **Adjusting Deal Assumptions**

I can help you modify the parameters for this analysis. 

**What would you like to change?**

💰 Purchase price  
📊 NOI or NOI growth rate  
⏰ Hold period  
🎯 Exit cap rate

Just tell me what you'd like to adjust and the new value."""
        
        state.messages.append({"role": "assistant", "content": response})
        
    elif 'export' in user_input:
        response = f"""📄 **Deal Summary Export**

## **{state.deal_data.deal_name}**

**Key Results:**
📈 IRR: {state.irr_result:.2f}%
💰 Purchase Price: ${state.deal_data.purchase_price:,}
📊 NOI: ${state.deal_data.net_operating_income:,}
⏰ Hold Period: {state.deal_data.hold_period} years

✅ You can copy this information to your records."""
        
        state.messages.append({"role": "assistant", "content": response})
        
    else:
        response = """💡 **How can I help?**

You can:

1️⃣ **Analyze a New Deal** - Say "new deal"
2️⃣ **Adjust Assumptions** - Say "adjust [field]" 
3️⃣ **Export Results** - Say "export"
4️⃣ **Exit Deal Mode** - Say "exit"

What would you like to do next?"""
        
        state.messages.append({"role": "assistant", "content": response})
    
    return state