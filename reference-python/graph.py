# ==============================================================================
# workflow/graph.py - LangGraph workflow construction
# ==============================================================================

from langgraph.graph import StateGraph, END
from models.chat_state import ChatState
from workflow.nodes import (
    property_selection_node,
    data_collection_node,
    validation_node,
    calculation_node,
    complete_node
)

def create_workflow():
    """Create the LangGraph workflow for CRE chatbot"""
    
    # Create the state graph
    workflow = StateGraph(ChatState)
    
    # Add nodes
    workflow.add_node("property_selection", property_selection_node)
    workflow.add_node("data_collection", data_collection_node)
    workflow.add_node("validation", validation_node)
    workflow.add_node("calculation", calculation_node)
    workflow.add_node("complete", complete_node)
    
    # Define conditional routing logic
    def route_from_property_selection(state: ChatState):
        if state.step == 'data_collection':
            return 'data_collection'
        return END
    
    def route_from_data_collection(state: ChatState):
        if state.step == 'calculation':
            return 'calculation'
        elif state.step == 'validation':
            return 'validation'
        return END
    
    def route_from_validation(state: ChatState):
        if state.step == 'calculation':
            return 'calculation'
        elif state.step == 'data_collection':
            return 'data_collection'
        return END
    
    def route_from_calculation(state: ChatState):
        if state.step == 'complete':
            return 'complete'
        elif state.step == 'validation':
            return 'validation'
        return END
    
    def route_from_complete(state: ChatState):
        if state.step == 'property_selection':
            return 'property_selection'
        return END
    
    # Add conditional edges
    workflow.add_conditional_edges(
        "property_selection",
        route_from_property_selection,
        {
            "data_collection": "data_collection",
            END: END
        }
    )
    
    workflow.add_conditional_edges(
        "data_collection", 
        route_from_data_collection,
        {
            "validation": "validation",
            "calculation": "calculation",
            END: END
        }
    )
    
    workflow.add_conditional_edges(
        "validation",
        route_from_validation,
        {
            "data_collection": "data_collection", 
            "calculation": "calculation",
            END: END
        }
    )
    
    workflow.add_conditional_edges(
        "calculation",
        route_from_calculation,
        {
            "complete": "complete",
            "validation": "validation",
            END: END
        }
    )
    
    workflow.add_conditional_edges(
        "complete",
        route_from_complete,
        {
            "property_selection": "property_selection",
            END: END
        }
    )
    
    # Set entry point
    workflow.set_entry_point("property_selection")
    
    # Compile the workflow with recursion limit
    return workflow.compile()