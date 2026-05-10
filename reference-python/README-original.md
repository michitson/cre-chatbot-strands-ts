# 🏢 Commercial Real Estate (CRE) Chatbot

> **A sophisticated AI-powered chatbot for commercial real estate investment analysis using LangChain, LangGraph, and advanced agentic design patterns.**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org)
[![LangChain](https://img.shields.io/badge/LangChain-0.3.9-green.svg)](https://langchain.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Workflow-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-red.svg)](https://flask.palletsprojects.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-purple.svg)](https://www.sqlalchemy.org/)

---

## 🎯 **Project Overview**

This is a **production-ready CRE investment analysis chatbot** that demonstrates advanced **agentic AI patterns** using LangChain and LangGraph. The bot guides users through structured commercial real estate deal analysis via natural conversation, automatically collecting property data and calculating Internal Rate of Return (IRR) with professional-grade accuracy.

### 🌟 **Key Capabilities**

- 🤖 **Natural Language Understanding**: Parse complex inputs like "$5.2M", "ten years", "3.5% annually"
- 📊 **IRR Calculation**: Complete cash flow analysis with exit value and total return metrics
- 🏗️ **Agentic Workflow**: Multi-step decision making using LangGraph state machines
- 💾 **Persistent Sessions**: SQLite-based chat history and deal storage
- 🎨 **Enhanced UX**: LLM-driven UI signals with professional formatting and emojis
- 🧪 **Comprehensive Testing**: 70+ tests covering workflow, parsing, persistence, and edge cases

---

## 🏛️ **Architecture & Design Philosophy**

This project exemplifies **"Agentic Design Purity"** - a paradigm where the LLM maintains full autonomy over conversation flow, content generation, and user experience while the application provides structured tools and guardrails.

### 🎭 **Core Design Principles**

#### 1. **🤖 Agentic Autonomy**
The LLM has complete control over:
- **Conversation flow and timing** - When to collect fields, validate data, or transition states
- **Content generation** - All user-facing text, formatting, emojis, and professional tone
- **Error handling** - Natural language explanations and recovery strategies
- **UX decisions** - Progress indicators, visual formatting, and interaction patterns

#### 2. **🛠️ Tool-Mediated Interactions**
All LLM capabilities are exposed through **LangChain tools** that provide:
- **Structured data parsing** via `parse_field_with_context`
- **Dynamic field discovery** via `get_next_field_to_collect` 
- **Validation logic** via `validate_all_collected_fields`
- **Financial calculations** via `calculate_irr_analysis`

#### 3. **🌊 State Machine Workflow**
**LangGraph** orchestrates a deterministic workflow while preserving LLM autonomy:
```
Property Selection → Data Collection → Validation → Calculation → Complete
        ↓                ↓              ↓           ↓          ↓
     LLM Guided      LLM Parsed    LLM Validated LLM Presented LLM Controlled
```

---

## 🔧 **Technical Implementation**

### 📚 **LangChain & LangGraph Integration**

#### **LangChain Tools Architecture**
The system leverages **LangChain's `@tool` decorator** to expose Python functions as LLM-callable tools:

```python
@tool
def parse_field_with_context(field_name: str, user_input: str, context: Dict) -> Tuple[bool, Any, str]:
    """LLM-powered natural language parsing with conversation context"""
    # Uses LLM to understand: "$5.2M" → 5200000, "ten years" → 10, "3.5%" → 3.5
```

**Key Tool Categories:**
- 🔍 **Field Management Tools** (`tools/field_management.py`)
  - `get_next_field_to_collect` - Dynamic field discovery
  - `get_missing_required_fields` - Validation support  
  - `validate_all_collected_fields` - Complete data validation
  - `get_field_prompt` - Context-aware prompting

- 🧠 **LLM Parsing Tools** (`tools/field_parser.py`)
  - `parse_field_with_context` - Natural language understanding
  - `parse_field_value_with_llm` - Core LLM parsing logic

- 💰 **Financial Tools** (`tools/deal_calculator.py`)
  - `calculate_irr_analysis` - IRR calculation with cash flow analysis
  - `calculate_sensitivity_analysis` - Parameter sensitivity testing

#### **LangGraph Workflow Engine**
**LangGraph** provides the state machine backbone with **conditional routing**:

```python
def create_workflow():
    workflow = StateGraph(ChatState)
    
    # Nodes represent workflow stages
    workflow.add_node("property_selection", property_selection_node)
    workflow.add_node("data_collection", data_collection_node) 
    workflow.add_node("validation", validation_node)
    workflow.add_node("calculation", calculation_node)
    workflow.add_node("complete", complete_node)
    
    # Conditional edges enable dynamic routing
    workflow.add_conditional_edges("data_collection", route_from_data_collection, {
        "validation": "validation",
        "calculation": "calculation", 
        END: END
    })
```

**Workflow State Management:**
- **ChatState** - Pydantic model tracking conversation state, collected fields, and workflow step
- **Deterministic routing** - LLM decisions influence state transitions via structured outputs
- **Recursion limiting** - Prevents infinite loops while allowing complex multi-turn interactions

#### **Tool Integration Patterns**

**1. Dynamic Field Discovery**
```python
# System automatically adapts to field configuration changes
next_field = get_next_field_to_collect.invoke({"collected_fields": state.collected_fields})
total_required = sum(1 for f in FIELD_ORDER if FIELD_CONFIGS[f].required)  # No magic numbers
```

**2. Context-Aware Parsing**
```python
# LLM receives conversation context for intelligent parsing
conversation_context = {
    'property_type': state.property_type,
    'deal_name': state.collected_fields.get('deal_name'),
    'collected_fields': state.collected_fields
}
success, value, error = parse_field_with_context.invoke({
    "field_name": field_name,
    "user_input": user_input,
    "context": conversation_context
})
```

**3. LLM-Driven UX Signals**
```python
# LLM responses contain natural signals that UI can interpret
agent_response = LLMResponseParser.parse_response_for_ui_signals(llm_response, state)
# Extracts: ui_state, analysis_phase, progress, deal_mode from LLM's natural language
```

---

## 🗄️ **Data Architecture**

### **Persistence Layer** (`database/`)

**SQLAlchemy 2.0** with **SQLite** backend:

```python
# Optimized for concurrent access and data integrity
class ChatSessionDB(Base):
    __tablename__ = 'chat_sessions'
    session_id = Column(String, primary_key=True)
    state_data = Column(JSON)  # Complete ChatState serialization
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

class CompletedDealDB(Base):
    __tablename__ = 'completed_deals'
    deal_id = Column(String, primary_key=True)
    # Denormalized for fast querying and analytics
    deal_name = Column(String)
    purchase_price = Column(Float)
    irr_result = Column(Float)
```

**Repository Pattern:**
- `ChatSessionRepository` - Session CRUD with ChatState serialization
- `DealRepository` - Completed deal storage and analytics queries
- `SessionManager` - Connection pooling and health monitoring

### **Domain Models** (`models/`)

**Pydantic v2** for robust data validation:

```python
class DealData(BaseModel):
    """Validated deal parameters with business logic"""
    deal_name: str
    purchase_price: int = Field(gt=0)  # Enforces positive values
    net_operating_income: int = Field(gt=0)
    noi_growth_rate: float = Field(ge=0, le=100)  # Percentage validation
    hold_period: int = Field(ge=1, le=50)
    exit_cap_rate: float = Field(gt=0, le=100)
    city: Optional[str] = None

class ChatState(BaseModel):
    """Workflow state with message history"""
    messages: List[Dict[str, str]] = Field(default_factory=list)
    deal_id: Optional[str] = None
    property_type: Optional[str] = None
    deal_data: Optional[DealData] = None
    collected_fields: Dict[str, Any] = Field(default_factory=dict)
    step: str = "property_selection"
    irr_result: Optional[float] = None
```

---

## 🎨 **Enhanced User Experience**

### **LLM-Driven UX Architecture**

The system achieves professional UX through **LLM autonomy** rather than hardcoded templates:

#### **Professional Formatting**
```python
# LLM generates rich, contextual responses with visual hierarchy
response = f"""✅ **Deal Name**: "{deal_name}"

**Progress**: {collected_count}/{total_required} fields completed

📋 **Next: Purchase Price**
Please provide the total acquisition cost...
"""
```

#### **Dynamic Progress Calculation**
```python
# No magic numbers - fully configurable
total_required_fields = sum(1 for f in FIELD_ORDER if FIELD_CONFIGS[f].required)
collected_required = sum(1 for f in state.collected_fields.keys() 
                        if f in FIELD_CONFIGS and FIELD_CONFIGS[f].required)
```

#### **Smart UI State Detection**
```python
class LLMResponseParser:
    @staticmethod
    def parse_response_for_ui_signals(response_text: str, current_state) -> AgentResponse:
        """Extract UI signals from LLM's natural language patterns"""
        # Detects: analysis mode, completion state, error conditions, progress updates
        # Based on LLM's word choices: "✅", "calculating", "analysis complete"
```

---

## 🌐 **API Reference**

### **RESTful Flask API**

#### **Core Chat Endpoint**
```http
POST /chat
Content-Type: application/json

{
  "session_id": "optional-uuid",
  "message": "I want to analyze an office building"
}
```

**Response Schema:**
```json
{
  "response": "✅ **Office Building Analysis Selected**\n\nPerfect! I'll guide you...",
  "session_id": "uuid-string",
  "deal_id": "deal-uuid",
  "property_type": "office",
  "step": "data_collection", 
  "irr_result": null,
  "collected_fields": ["deal_name", "purchase_price"],
  "ui_state": "analysis_mode",
  "analysis_phase": "data_collection",
  "deal_mode": true,
  "progress": {
    "current": 2,
    "total": 6,
    "field_name": "net_operating_income"
  }
}
```

#### **Session Management**
```http
GET /session/{session_id}     # Retrieve session state
DELETE /session/{session_id}  # Clear session
GET /deals?limit=10           # Recent completed deals  
GET /health                   # System health check
```

### **Configuration Management**

**Environment-based Settings** (`config/settings.py`):
```python
class Settings(BaseSettings):
    openai_api_key: str
    database_url: str = "sqlite:///./data/cre_chatbot.db"
    log_level: str = "INFO"
    flask_debug: bool = False
    secret_key: str = Field(default_factory=lambda: secrets.token_hex(32))
```

**Dynamic Field Configuration** (`config/field_configs.py`):
```python
FIELD_CONFIGS = {
    'purchase_price': FieldConfig(
        name='purchase_price',
        prompt="What's the purchase price?",
        field_type='currency',
        required=True,
        examples=["$5,000,000", "5M", "5.5 million"]
    )
}
```

---

## 🧪 **Testing Strategy**

### **Comprehensive Test Suite**

**70+ Tests** across multiple categories:

#### **🔄 Regression Tests** (`tests/test_workflow_regression.py`)
Critical workflow bug prevention:
```python
def test_workflow_progresses_to_complete_with_all_required_fields():
    """Ensures workflow moves data_collection → calculation → complete"""
    # Tests the complete happy path with all required fields
    
def test_complete_node_ignores_assistant_messages():
    """Prevents bug where IRR results were processed as user input"""
    # Critical fix for workflow state reset issue
```

#### **🧠 Natural Language Tests** (`tests/test_natural_language_parsing.py`)
LLM parsing validation:
```python
def test_purchase_price_variations():
    """Tests: '$5.2M', '5200000', 'five point two million'"""
    
def test_hold_period_variations():
    """Tests: '10 years', '10y', 'a decade', 'ten years'"""
```

#### **🔗 Integration Tests** (`tests/test_integration_natural_language.py`)
End-to-end workflow validation:
```python
def test_complete_office_deal_with_natural_language():
    """Full workflow with realistic natural language inputs"""
```

#### **⚡ Performance Tests**
- **Concurrent session handling**
- **Database connection pooling**
- **Memory usage optimization**
- **LLM response time monitoring**

---

## 🚀 **Getting Started**

### **Prerequisites**
```bash
# Python 3.11+ required
python --version

# OpenAI API access
export OPENAI_API_KEY="your-api-key"
```

### **Installation**
```bash
# Clone and setup
git clone <repository-url>
cd cre_chatbot

# Virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Environment configuration
cp .env.example .env
# Edit .env with your OpenAI API key
```

### **Running the Application**
```bash
# Development server
python app.py

# Production deployment
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app

# Docker deployment
docker-compose up -d
```

### **API Testing**
```bash
# Health check
curl http://localhost:5000/health

# Start a conversation
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to analyze an office building"}'
```

### **Running Tests**
```bash
# Full test suite
python -m pytest tests/ -v

# Specific test categories
python -m pytest tests/test_workflow_regression.py -v
python -m pytest tests/test_natural_language_parsing.py -v

# Coverage report
python -m pytest tests/ --cov=. --cov-report=html
```

---

## 📈 **Future Enhancements**

### **FastAPI Migration Analysis**

**Current Flask vs. Future FastAPI:**

| **Aspect** | **Flask (Current)** | **FastAPI (Future)** |
|------------|--------------------|--------------------|
| **Performance** | WSGI, synchronous | ASGI, async/await support |
| **Type Safety** | Manual validation | Automatic Pydantic integration |
| **API Docs** | Manual documentation | Auto-generated OpenAPI/Swagger |
| **WebSocket Support** | Requires extensions | Native async WebSocket |
| **Dependency Injection** | Manual implementation | Built-in DI system |
| **Testing** | Flask-Testing | TestClient with async support |

**Migration Benefits:**
- 🚀 **Performance**: 2-3x faster for I/O-bound operations (LLM calls)
- 📝 **Auto-documentation**: Interactive API docs at `/docs`
- 🔒 **Type safety**: Automatic request/response validation
- 🌐 **Modern async**: Better handling of concurrent LLM requests
- 🧪 **Testing**: Superior async test capabilities

**Migration Path:**
```python
# Current Flask endpoint
@app.route('/chat', methods=['POST']) 
def chat():
    data = request.json
    # Manual validation and processing

# Future FastAPI endpoint  
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Automatic validation, async LLM calls
    async with aiohttp.ClientSession() as session:
        result = await llm_service.process_async(request.message)
```

### **Planned Enhancements**

#### **🔮 Advanced Analytics**
- **Deal comparison dashboards**
- **Market trend analysis**  
- **Portfolio optimization**
- **Sensitivity scenario modeling**

#### **🤖 Multi-Agent Architecture**
- **Specialized agents**: Market research, legal compliance, financial modeling
- **Agent orchestration**: LangGraph multi-agent workflows
- **Knowledge integration**: RAG with market data and regulations

#### **🌍 Enterprise Features**
- **Multi-tenant architecture**
- **Role-based access control**
- **Audit trails and compliance**
- **Advanced caching strategies**

#### **📱 Client Integrations**
- **React/Next.js dashboard**
- **Mobile application**
- **Excel/Google Sheets plugins**
- **Slack/Teams integrations**

---

## 🏗️ **Project Structure**

```
cre_chatbot/
├── 🏠 app.py                          # Flask application & API endpoints
├── 📦 requirements.txt                # Dependencies
├── 🐳 Dockerfile                      # Container configuration
├── 🐳 docker-compose.yml              # Multi-service deployment
├── ⚙️  config/
│   ├── 📋 field_configs.py            # Dynamic field definitions
│   └── ⚙️  settings.py                # Environment configuration
├── 🗄️ database/
│   ├── 📊 models.py                   # SQLAlchemy models
│   ├── 📚 repositories.py             # Data access layer
│   └── 🔗 session_manager.py          # Connection management
├── 🧠 models/
│   ├── 💼 deal_data.py                # Domain models & validation
│   ├── 💬 chat_state.py               # Workflow state management
│   └── 🎨 agent_response.py           # UX signal extraction
├── 🛠️ tools/
│   ├── 💰 deal_calculator.py          # IRR calculation tools
│   ├── 🔍 field_management.py         # Dynamic field operations
│   └── 🧠 field_parser.py             # LLM parsing tools
├── 🌊 workflow/
│   ├── 📊 graph.py                    # LangGraph workflow definition
│   └── 🔄 nodes.py                    # Workflow node implementations
├── 🧪 tests/
│   ├── 🔄 test_workflow_regression.py  # Critical bug prevention
│   ├── 🧠 test_natural_language_parsing.py # LLM parsing validation
│   ├── 🔗 test_integration_natural_language.py # E2E testing
│   ├── ⚡ test_api.py                  # API endpoint testing
│   ├── 🗄️ test_database.py            # Persistence testing
│   ├── 🛠️ test_tools.py               # Tool validation
│   └── 🌊 test_workflow.py            # Workflow unit tests
├── 📊 data/                           # SQLite database storage
└── 📝 logs/                           # Application logs
```

---

## 🤝 **Contributing**

### **Development Guidelines**
1. **Maintain agentic design purity** - LLM should control UX decisions
2. **Add LangChain tools** for new capabilities rather than hardcoded logic
3. **Test natural language variations** for all new input fields
4. **Update field configurations** rather than modifying parsing logic
5. **Preserve workflow state integrity** in all modifications

### **Code Quality Standards**
- **Type hints** for all functions and methods
- **Comprehensive docstrings** with examples
- **Unit tests** for all new functionality  
- **Integration tests** for workflow changes
- **Performance benchmarks** for LLM interactions

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **LangChain Team** - For the powerful LLM orchestration framework
- **LangGraph Contributors** - For the sophisticated state machine capabilities
- **OpenAI** - For the advanced language model APIs
- **Pydantic** - For robust data validation and serialization
- **SQLAlchemy** - For the excellent ORM and database management

---

**🏢 Built with ❤️ for Commercial Real Estate Professionals**

*This project demonstrates production-ready agentic AI patterns that can be adapted for any domain requiring structured data collection and analysis through natural conversation.*