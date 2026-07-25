import json
import logging
from typing import Any, Literal
from enum import Enum

from app.config import settings

logger = logging.getLogger(__name__)


class ComplexityLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AIProvider(Enum):
    GEMINI = "gemini"
    GROQ = "groq"
    OPENROUTER = "openrouter"


PROVIDER_INFO = {
    AIProvider.GEMINI: {
        "name": "Google Gemini",
        "complexity_preference": [ComplexityLevel.HIGH, ComplexityLevel.MEDIUM, ComplexityLevel.LOW],
        "speed": "medium",
        "cost": "free_tier",
        "quality": "high",
        "supports_structured_output": True,
    },
    AIProvider.GROQ: {
        "name": "Groq",
        "complexity_preference": [ComplexityLevel.LOW, ComplexityLevel.MEDIUM],
        "speed": "fast",
        "cost": "free",
        "quality": "medium",
        "supports_structured_output": False,
    },
    AIProvider.OPENROUTER: {
        "name": "OpenRouter",
        "complexity_preference": [ComplexityLevel.HIGH, ComplexityLevel.MEDIUM, ComplexityLevel.LOW],
        "speed": "variable",
        "cost": "paid",
        "quality": "high",
        "supports_structured_output": True,
    },
}

DEFAULT_MODELS = {
    AIProvider.GEMINI: "gemini-2.0-flash",
    AIProvider.GROQ: "llama-3.3-70b-versatile",
    AIProvider.OPENROUTER: "meta-llama/llama-3.3-70b-instruct",
}


def get_available_providers() -> list[AIProvider]:
    available = []
    if settings.GEMINI_API_KEY:
        available.append(AIProvider.GEMINI)
    if settings.GROQ_API_KEY:
        available.append(AIProvider.GROQ)
    if settings.OPENROUTER_API_KEY:
        available.append(AIProvider.OPENROUTER)
    return available


def get_ordered_providers(complexity: ComplexityLevel) -> list[AIProvider]:
    available = get_available_providers()
    if not available:
        return []
    if settings.AI_PROVIDER != "auto":
        try:
            requested = AIProvider(settings.AI_PROVIDER)
            if requested in available:
                available.remove(requested)
                available.insert(0, requested)
        except ValueError:
            logger.warning(f"Invalid AI_PROVIDER setting: {settings.AI_PROVIDER}")
    if complexity == ComplexityLevel.LOW:
        available.sort(key=lambda p: 0 if p == AIProvider.GROQ else 1)
    elif complexity == ComplexityLevel.HIGH:
        available.sort(key=lambda p: 1 if p == AIProvider.GROQ else 0)
    return available


def get_provider_client(provider: AIProvider):
    if provider == AIProvider.GEMINI:
        from google import genai
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    elif provider == AIProvider.GROQ:
        from groq import Groq
        return Groq(api_key=settings.GROQ_API_KEY)
    elif provider == AIProvider.OPENROUTER:
        from openai import OpenAI
        return OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1"
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")


def generate_ai_response(
    prompt: str,
    complexity: ComplexityLevel = ComplexityLevel.MEDIUM,
    preferred_provider: AIProvider | None = None,
    response_format: Literal["text", "json_object"] = "json_object",
    json_schema: dict[str, Any] | None = None,
    **kwargs
) -> str:
    available = get_available_providers()
    if not available:
        raise ValueError("No AI providers available. Please configure at least one API key.")

    if preferred_provider and preferred_provider in available:
        ordered = [preferred_provider] + [p for p in get_ordered_providers(complexity) if p != preferred_provider]
    else:
        ordered = get_ordered_providers(complexity)

    if not ordered:
        ordered = available

    errors = []

    for provider in ordered:
        try:
            logger.info(f"Attempting provider: {provider.value}")
            client = get_provider_client(provider)
            response = _call_provider(client, provider, prompt, response_format, json_schema, **kwargs)
            logger.info(f"Successfully generated response using {provider.value}")
            return response
        except Exception as exc:
            error_msg = str(exc)[:200]
            logger.warning(f"Provider {provider.value} failed: {error_msg}")
            errors.append(f"{provider.value}: {error_msg}")
            continue

    raise ValueError(f"All AI providers failed. Tried: {errors}")


def _call_provider(
    client,
    provider: AIProvider,
    prompt: str,
    response_format: str,
    json_schema: dict[str, Any] | None,
    **kwargs
) -> str:
    model = kwargs.get("model", DEFAULT_MODELS[provider])

    if provider == AIProvider.GEMINI:
        genai_kwargs = {}
        if response_format == "json_object" and PROVIDER_INFO[provider]["supports_structured_output"]:
            genai_kwargs["generation_config"] = {"response_mime_type": "application/json"}
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            **genai_kwargs,
        )
        return response.text

    elif provider == AIProvider.GROQ:
        extra_kwargs = {}
        if response_format == "json_object":
            extra_kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=kwargs.get("temperature", 0.7),
            **extra_kwargs,
        )
        return response.choices[0].message.content

    elif provider == AIProvider.OPENROUTER:
        extra_kwargs = {}
        if response_format == "json_object" and json_schema:
            extra_kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "structured_response", "schema": json_schema},
            }
        elif response_format == "json_object":
            extra_kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=kwargs.get("temperature", 0.7),
            **extra_kwargs,
        )
        return response.choices[0].message.content

    else:
        raise ValueError(f"Unknown provider: {provider}")
