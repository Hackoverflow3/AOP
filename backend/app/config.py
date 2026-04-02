from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str = ""
    gemini_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    groq_model: str = "llama-3.3-70b-versatile"
    database_url: str = "./aop.db"
    artifacts_dir: str = "./artifacts"

    class Config:
        env_file = ".env"


settings = Settings()
