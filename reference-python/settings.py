# ==============================================================================
# config/settings.py - Application settings
# ==============================================================================

import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # OpenAI Configuration
    openai_api_key: str
    openai_model: str = "gpt-4"
    
    # Database Configuration  
    database_path: str = "./data/chatbot.db"
    sql_debug: bool = False
    
    # Flask Configuration
    flask_env: str = "development"
    flask_debug: bool = True
    secret_key: str = "dev-secret-key-change-in-production"
    
    # Logging Configuration
    log_level: str = "INFO"
    log_file: str = "./logs/chatbot.log"
    
    # LLM Configuration
    llm_temperature: float = 0.0
    llm_confidence_threshold: float = 0.7
    
    # Field Parsing Configuration
    max_field_retries: int = 3
    field_timeout_seconds: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()