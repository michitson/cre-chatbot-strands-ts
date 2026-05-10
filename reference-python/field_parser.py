# ==============================================================================
# tools/field_parser.py
# ==============================================================================

from langchain_core.tools import tool
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from typing import Dict, Any, Tuple, Union, Optional
from config.field_configs import FIELD_CONFIGS
import json

# Initialize LLM for field parsing
field_parser_llm = ChatOpenAI(temperature=0, model="gpt-4")

class FieldParseResult(BaseModel):
    """Result of LLM field parsing"""
    success: bool = Field(description="Whether parsing was successful")
    parsed_value: Optional[Union[str, int, float]] = Field(description="The parsed value in the correct type")
    error_message: Optional[str] = Field(description="Error message if parsing failed")
    confidence: float = Field(description="Confidence level (0-1) in the parsing result")
    interpretation: str = Field(description="How the LLM interpreted the user input")

# Parsing prompt template
FIELD_PARSING_PROMPT = PromptTemplate(
    template="""You are an expert at interpreting user input for commercial real estate deal analysis.

FIELD INFORMATION:
- Field Name: {field_name}
- Field Type: {field_type}
- Description: {description}
- Expected Range: {min_value} to {max_value}
- Original Prompt: "{original_prompt}"

EXAMPLES OF VALID INPUT:
{examples}

COMMON INPUT FORMATS:
{common_formats}

USER INPUT TO PARSE:
"{user_input}"

INSTRUCTIONS:
1. Interpret the user's input in the context of this specific field
2. Convert it to the appropriate data type ({field_type})
3. Consider common abbreviations, written-out numbers, and informal expressions
4. For currency: convert to integer dollars (no decimals for whole amounts)
5. For percentages: convert to float (e.g., "3.5%" becomes 3.5)
6. For integers: extract the numeric value
7. For strings: clean and standardize the text

VALIDATION:
- Check if the value is within the specified range
- Ensure the data type is correct
- Flag any ambiguous or unclear inputs

{format_instructions}
""",
    input_variables=["field_name", "field_type", "description", "min_value", "max_value", 
                    "original_prompt", "examples", "common_formats", "user_input"],
    partial_variables={"format_instructions": PydanticOutputParser(pydantic_object=FieldParseResult).get_format_instructions()}
)

@tool
def parse_field_value_with_llm(field_name: str, user_input: str) -> Tuple[bool, Any, str]:
    """Use LLM to parse and interpret user input for a specific field"""
    if field_name not in FIELD_CONFIGS:
        return False, None, f"Unknown field: {field_name}"
    
    config = FIELD_CONFIGS[field_name]
    
    # Use structured prompt without Pydantic parser to avoid parsing issues
    prompt = f"""
You are an expert at interpreting user input for commercial real estate deal analysis.

FIELD INFORMATION:
- Field Name: {field_name}
- Field Type: {config.field_type}
- Description: {config.description}
- Expected Range: {config.min_value or "No minimum"} to {config.max_value or "No maximum"}

EXAMPLES OF VALID INPUT:
{chr(10).join([f"- {ex}" for ex in config.examples])}

COMMON INPUT FORMATS:
{chr(10).join([f"- {fmt}" for fmt in config.common_formats])}

USER INPUT TO PARSE: "{user_input}"

INSTRUCTIONS:
- Parse the user input and convert it to the appropriate {config.field_type}
- Handle human-like variations (e.g., "10 years" → 10, "5M" → 5000000, "3.5%" → 3.5)
- Be generous in interpretation but ensure accuracy
- Return ONLY a JSON object with this exact format:

{{"success": true, "parsed_value": <the_parsed_value>, "confidence": <0.0_to_1.0>, "interpretation": "<how_you_interpreted_it>"}}

OR if parsing fails:

{{"success": false, "error_message": "<reason_why_parsing_failed>", "confidence": 0.0, "interpretation": "<what_you_attempted>"}}
"""
    
    try:
        response = field_parser_llm.invoke(prompt)
        content = response.content.strip()
        
        # Parse the JSON response manually to avoid Pydantic issues
        import json
        result = json.loads(content)
        
        if result.get("success") and result.get("confidence", 0) >= 0.7:
            return True, result["parsed_value"], ""
        else:
            error_msg = result.get("error_message", f"Could not interpret '{user_input}' for {field_name}.")
            return False, None, error_msg
            
    except json.JSONDecodeError as e:
        return False, None, f"LLM returned invalid JSON: {content}"
    except Exception as e:
        return False, None, f"Error parsing input: {str(e)}"

@tool
def parse_field_with_context(field_name: str, user_input: str, context: Dict[str, Any]) -> Tuple[bool, Any, str]:
    """Parse field value with conversational context"""
    return parse_field_value_with_llm.invoke({"field_name": field_name, "user_input": user_input})