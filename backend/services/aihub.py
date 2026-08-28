"""
AI Hub service layer implementation.
Provides text, image, video, and audio generation, PDF analysis,
plus speech transcription capabilities.
"""

import asyncio
import base64
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple, Type, Union

import fitz
from core.config import settings
import httpx
from openai import AsyncOpenAI
from schemas.aihub import AnalyzePdfRequest, AnalyzePdfResponse
from schemas.aihub import (
    GenAudioRequest,
    GenAudioResponse,
    GenImgRequest,
    GenImgResponse,
    GenTxtRequest,
    GenTxtResponse,
    GenVideoRequest,
    GenVideoResponse,
    TranscribeAudioRequest,
    TranscribeAudioResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.platform import AIAppAssignment, AIProviderConfig, Organization, Project

logger = logging.getLogger(__name__)

PDF_ANALYSIS_MODEL = "claude-sonnet-4.6"
PDF_SYSTEM_PROMPT = """You are a careful PDF analysis assistant.

Rules:
- Answer only from the attached PDF.
- If the PDF does not contain the requested information, say so clearly.
- Do not invent or infer unsupported facts.
- Mention page numbers for important facts whenever the PDF makes that possible.
- Match the user's instruction language.
"""
PDF_MODE_PROMPTS = {
    "qa": """Task type: Question answering.
Read the attached PDF and answer the user's question directly, clearly, and only with information supported by the document.""",
    "extract": """Task type: Structured extraction.
Read the attached PDF and extract the requested information as concise Markdown with clear headings and bullets when helpful.""",
}
PDF_MAX_PAGE_WINDOW = 80
PDF_MAX_TOTAL_BYTES = 15 * 1024 * 1024
PDF_MAX_TOTAL_PAGES = 80


class InvalidImageInputError(ValueError):
    """Raised when the provided image input cannot be parsed."""


class InvalidAudioInputError(ValueError):
    """Raised when the provided audio input cannot be parsed."""


class InvalidPdfInputError(ValueError):
    """Raised when the provided PDF input is invalid or unsupported."""


# Voice mapping: (model, gender) -> voice
VOICE_MAP: Dict[Tuple[str, str], str] = {
    # qwen3-tts-flash
    ("qwen3-tts-flash", "male"): "Ethan",
    ("qwen3-tts-flash", "female"): "Cherry",
    # gemini-2.5-pro-preview-tts
    ("gemini-2.5-pro-preview-tts", "male"): "Puck",
    ("gemini-2.5-pro-preview-tts", "female"): "Zephyr",
    # eleven
    ("eleven_v3", "male"): "echo",
    ("eleven_v3", "female"): "alloy",
    ("eleven_turbo_v2", "male"): "echo",
    ("eleven_turbo_v2", "female"): "alloy",
    # OpenAI gpt-4o-mini-tts
    ("gpt-4o-mini-tts", "male"): "echo",
    ("gpt-4o-mini-tts", "female"): "nova",
}

# The customer-service expert cards use these stable style keys.  The order is
# intentional: every three experts are female, female, male.  Windows only
# exposes a small number of reliable Simplified Chinese voices, so the local
# profiles combine the preferred voice with a distinct speaking rate.  This
# still gives every expert an independent, deterministic synthesis profile.
EXPERT_TTS_PROFILES: Dict[str, Tuple[str, str, int]] = {
    "expert-01": ("female", "Huihui", -3),
    "expert-02": ("female", "Yaoyao", -3),
    "expert-03": ("male", "Kangkang", -3),
    "expert-04": ("female", "Huihui", -1),
    "expert-05": ("female", "Yaoyao", -1),
    "expert-06": ("male", "Kangkang", -1),
    "expert-07": ("female", "Huihui", 1),
    "expert-08": ("female", "Yaoyao", 1),
    "expert-09": ("male", "Kangkang", 1),
    "expert-10": ("female", "Huihui", 3),
    "expert-11": ("female", "Yaoyao", 3),
    "expert-12": ("male", "Kangkang", 3),
}

# Keep the six original frontend keys working for saved configurations and
# previously generated assets.  They resolve to the same voice families that
# were used before this twelve-profile contract was introduced.
LEGACY_LOCAL_TTS_PROFILES: Dict[str, Tuple[str, str, int]] = {
    "gentle-female": ("female", "Huihui", -2),
    "bright-female": ("female", "Yaoyao", 1),
    "standard-female": ("female", "Huihui", 0),
    "calm-male": ("male", "Kangkang", -2),
    "deep-male": ("male", "Kangkang", -1),
    "standard-male": ("male", "Kangkang", 0),
}

VOICE_STYLE_MAP: Dict[Tuple[str, str], str] = {
    # qwen3-tts-flash currently exposes a stable male/female pair.
    ("qwen3-tts-flash", "gentle-female"): "Cherry",
    ("qwen3-tts-flash", "bright-female"): "Cherry",
    ("qwen3-tts-flash", "standard-female"): "Cherry",
    ("qwen3-tts-flash", "calm-male"): "Ethan",
    ("qwen3-tts-flash", "deep-male"): "Ethan",
    ("qwen3-tts-flash", "standard-male"): "Ethan",
    # OpenAI voices allow a bit more separation between the six presets.
    ("gpt-4o-mini-tts", "gentle-female"): "nova",
    ("gpt-4o-mini-tts", "bright-female"): "shimmer",
    ("gpt-4o-mini-tts", "standard-female"): "alloy",
    ("gpt-4o-mini-tts", "calm-male"): "echo",
    ("gpt-4o-mini-tts", "deep-male"): "onyx",
    ("gpt-4o-mini-tts", "standard-male"): "ash",
}

# Remote providers expose different voice catalogs.  Use a conservative pool
# for each existing model: providers with only a known stable gender pair keep
# that pair, while models with a broader documented catalog rotate voices.
REMOTE_EXPERT_VOICE_POOLS: Dict[str, Dict[str, Tuple[str, ...]]] = {
    "qwen3-tts-flash": {
        "female": ("Cherry",),
        "male": ("Ethan",),
    },
    "gemini-2.5-pro-preview-tts": {
        "female": ("Zephyr", "Aoede", "Kore", "Leda"),
        "male": ("Puck", "Charon", "Fenrir", "Orus"),
    },
    "eleven_v3": {
        "female": ("alloy",),
        "male": ("echo",),
    },
    "eleven_turbo_v2": {
        "female": ("alloy",),
        "male": ("echo",),
    },
    "gpt-4o-mini-tts": {
        "female": ("nova", "shimmer", "coral", "sage"),
        "male": ("echo", "onyx", "ash", "fable"),
    },
}

for _model_name, _gender_voice_pools in REMOTE_EXPERT_VOICE_POOLS.items():
    _voice_pool_indexes = {"female": 0, "male": 0}
    for _style_key, (_profile_gender, _windows_voice, _local_rate) in EXPERT_TTS_PROFILES.items():
        _voice_pool = _gender_voice_pools[_profile_gender]
        _voice_index = _voice_pool_indexes[_profile_gender]
        VOICE_STYLE_MAP[(_model_name, _style_key)] = _voice_pool[_voice_index % len(_voice_pool)]
        _voice_pool_indexes[_profile_gender] += 1

DEFAULT_VOICE = {"male": "Ethan", "female": "Cherry"}
LOCAL_TTS_CACHE_DIR = Path(__file__).resolve().parents[1] / "tmp" / "local_tts_cache"
WINDOWS_TTS_VOICE_HINTS: Dict[str, Tuple[str, ...]] = {
    "male": ("Kangkang", "David", "Mark", "Male"),
    "female": ("Huihui", "Yaoyao", "Zira", "Female"),
}
LOCAL_TTS_HELPER_RESULT_PREFIX = "LOCAL_TTS_RESULT"


class AIHubService:
    """AI Hub service class that wraps AI SDK calls."""

    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        app_ai_base_url = self._read_setting("app_ai_base_url", "openai_base_url")
        app_ai_key = self._read_setting("app_ai_key", "openai_api_key", "codex_api_key")
        if app_ai_base_url and app_ai_key:
            self.client = AsyncOpenAI(
                api_key=app_ai_key,
                base_url=app_ai_base_url.rstrip("/"),
                default_headers=self._build_default_headers(app_ai_base_url),
            )

    @staticmethod
    def _read_setting(*names: str) -> Optional[str]:
        """Safely read the first configured setting value without raising AttributeError."""
        for name in names:
            try:
                value = getattr(settings, name)
            except AttributeError:
                continue
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    @staticmethod
    def _build_default_headers(base_url: Optional[str]) -> Optional[dict]:
        """Attach optional OpenRouter metadata headers for local calls."""
        if base_url and "openrouter.ai" in base_url.lower():
            return {
                "HTTP-Referer": "http://127.0.0.1:3003",
                "X-Title": "Codex B2B Local",
            }
        return None

    def _require_ai_client(self) -> AsyncOpenAI:
        """Return the configured AI client or raise a configuration error."""
        if not self.client:
            raise ValueError(
                "AI service not configured. Set APP_AI_BASE_URL and APP_AI_KEY, or configure OPENAI_API_KEY/CODEX_API_KEY."
            )
        return self.client

    @staticmethod
    def _resolve_local_tts_profile(
        gender: str,
        voice_style_key: Optional[str] = None,
    ) -> Tuple[str, str, str, int]:
        """Resolve style, effective gender, Windows voice hint, and SAPI rate."""
        normalized_gender = "male" if (gender or "").strip().lower() == "male" else "female"
        normalized_style_key = (voice_style_key or "").strip().lower()
        profile = EXPERT_TTS_PROFILES.get(normalized_style_key)
        if profile is None:
            profile = LEGACY_LOCAL_TTS_PROFILES.get(normalized_style_key)
        if profile is not None:
            profile_gender, voice_hint, rate = profile
            return normalized_style_key, profile_gender, voice_hint, rate

        default_voice_hint = "Kangkang" if normalized_gender == "male" else "Huihui"
        cache_style_key = normalized_style_key or f"default-{normalized_gender}"
        return cache_style_key, normalized_gender, default_voice_hint, 0

    @staticmethod
    def _local_tts_cache_key(
        text: str,
        gender: str,
        voice_style_key: Optional[str] = None,
    ) -> str:
        resolved_style, resolved_gender, voice_hint, rate = AIHubService._resolve_local_tts_profile(
            gender,
            voice_style_key,
        )
        payload = f"v3-strict-gender::{resolved_gender}::{resolved_style}::{voice_hint}::{rate}::{text}".encode(
            "utf-8",
            errors="ignore",
        )
        return hashlib.sha1(payload).hexdigest()

    @staticmethod
    def _parse_local_tts_helper_result(stdout: str) -> Tuple[str, str]:
        """Return the actual token gender and voice reported by the local helper."""
        for line in reversed([item.strip() for item in (stdout or "").splitlines() if item.strip()]):
            fields = line.split("\t", 2)
            if len(fields) != 3 or fields[0] != LOCAL_TTS_HELPER_RESULT_PREFIX:
                continue
            actual_gender = fields[1].strip().lower()
            voice_name = fields[2].strip()
            if actual_gender not in {"male", "female"}:
                raise RuntimeError(f"Local TTS helper reported invalid voice gender: {fields[1]!r}")
            if not voice_name:
                raise RuntimeError("Local TTS helper reported an empty voice name.")
            return actual_gender, voice_name
        raise RuntimeError("Local TTS helper did not report the selected voice gender.")

    @staticmethod
    def _pick_windows_voice_script(gender: str, voice_style_key: Optional[str] = None) -> str:
        _, resolved_gender, preferred_hint, rate = AIHubService._resolve_local_tts_profile(
            gender,
            voice_style_key,
        )
        gender_name = "Male" if resolved_gender == "male" else "Female"
        hints = (preferred_hint,) + tuple(
            hint for hint in WINDOWS_TTS_VOICE_HINTS.get(resolved_gender, ()) if hint != preferred_hint
        )
        hints_literal = ", ".join(f"'{hint}'" for hint in hints)
        return f"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$target = $args[0]
$textPath = $args[1]
$text = [System.IO.File]::ReadAllText($textPath, [System.Text.Encoding]::UTF8)
if ([string]::IsNullOrWhiteSpace($text)) {{
  throw 'Local TTS text is empty.'
}}
$genderName = '{gender_name}'
$hintNames = @({hints_literal})
$voice = New-Object -ComObject SAPI.SpVoice
$voice.Rate = {rate}
$category = New-Object -ComObject SAPI.SpObjectTokenCategory
$category.SetId('HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices', $false)
$tokens = @($category.EnumerateTokens()) | Where-Object {{
  $_.GetAttribute('Gender') -eq $genderName
}}
$token = $tokens |
  Sort-Object {{
    $score = 0
    $description = $_.GetDescription()
    $attributes = $_.GetAttribute('Language')
    $score += 60
    if ($attributes -like '804*') {{ $score += 50 }}
    elseif ($attributes -like '4*') {{ $score += 40 }}
    foreach ($hint in $hintNames) {{
      if ($description -like \"*$hint*\") {{ $score += 10 }}
    }}
    -$score
  }} |
  Select-Object -First 1
if (-not $token) {{
  throw \"No installed $genderName voice found.\"
}}
$actualGender = $token.GetAttribute('Gender')
if ($actualGender -ne $genderName) {{
  throw \"Selected voice gender $actualGender does not match requested $genderName.\"
}}
$stream = New-Object -ComObject SAPI.SpFileStream
$stream.Open($target, 3, $false)
$voice.Voice = $token
$voice.AudioOutputStream = $stream
$null = $voice.Speak($text)
$stream.Close()
Write-Output (\"LOCAL_TTS_RESULT`t\" + $actualGender + \"`t\" + $token.GetDescription())
"""

    @staticmethod
    def _ensure_local_tts_helper() -> Path:
        helper_dir = Path(tempfile.gettempdir()) / "codex_local_tts"
        helper_dir.mkdir(parents=True, exist_ok=True)
        source_path = helper_dir / "TtsOneCore.cs"
        exe_path = helper_dir / "TtsOneCore.exe"
        csc_candidates = [
            Path(os.environ.get("WINDIR", r"C:\Windows")) / "Microsoft.NET" / "Framework64" / "v4.0.30319" / "csc.exe",
            Path(os.environ.get("WINDIR", r"C:\Windows")) / "Microsoft.NET" / "Framework" / "v4.0.30319" / "csc.exe",
        ]
        csc_path = next((candidate for candidate in csc_candidates if candidate.exists()), None)
        if not csc_path:
            raise RuntimeError("Local TTS helper compiler not found.")

        local_profile_cases = "\n".join(
            (
                f'                case "{style_key}": genderName = "{profile_gender.title()}"; '
                f'preferredVoice = "{voice_hint}"; rate = {rate}; break;'
            )
            for style_key, (profile_gender, voice_hint, rate) in {
                **EXPERT_TTS_PROFILES,
                **LEGACY_LOCAL_TTS_PROFILES,
            }.items()
        )
        source_code = r"""
using System;
using System.IO;
using System.Text;

class TtsOneCore
{
    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Length < 4) throw new ArgumentException("need target textPath gender style");
            var target = args[0];
            var textPath = args[1];
            var genderName = string.Equals(args[2], "male", StringComparison.OrdinalIgnoreCase) ? "Male" : "Female";
            var styleKey = (args[3] ?? string.Empty).Trim().ToLowerInvariant();
            var preferredVoice = genderName == "Male" ? "Kangkang" : "Huihui";
            var rate = 0;
            switch (styleKey)
            {
__LOCAL_PROFILE_CASES__
            }
            var hints = genderName == "Male"
                ? new[] { preferredVoice, "Kangkang", "David", "Mark", "Male" }
                : new[] { preferredVoice, "Huihui", "Yaoyao", "Zira", "Female" };
            var text = File.ReadAllText(textPath, Encoding.UTF8);
            if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("Local TTS text is empty.");

            var voiceType = Type.GetTypeFromProgID("SAPI.SpVoice", true);
            dynamic voice = Activator.CreateInstance(voiceType);
            var categoryType = Type.GetTypeFromProgID("SAPI.SpObjectTokenCategory", true);
            dynamic category = Activator.CreateInstance(categoryType);
            category.SetId(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Speech_OneCore\Voices", false);
            dynamic tokens = category.EnumerateTokens();
            dynamic bestToken = null;
            var bestScore = int.MinValue;

            foreach (var token in tokens)
            {
                var description = Convert.ToString(token.GetDescription()) ?? string.Empty;
                var language = Convert.ToString(token.GetAttribute("Language")) ?? string.Empty;
                var gender = Convert.ToString(token.GetAttribute("Gender")) ?? string.Empty;
                if (!string.Equals(gender, genderName, StringComparison.OrdinalIgnoreCase)) continue;
                var score = 60;
                if (language.StartsWith("804", StringComparison.OrdinalIgnoreCase)) score += 50;
                else if (language.StartsWith("4", StringComparison.OrdinalIgnoreCase)) score += 40;
                if (description.IndexOf(preferredVoice, StringComparison.OrdinalIgnoreCase) >= 0) score += 100;
                foreach (var hint in hints)
                {
                    if (description.IndexOf(hint, StringComparison.OrdinalIgnoreCase) >= 0) score += 10;
                }
                if (score > bestScore)
                {
                    bestScore = score;
                    bestToken = token;
                }
            }

            if (bestToken == null) throw new InvalidOperationException("No installed " + genderName + " voice found.");
            var selectedGender = Convert.ToString(bestToken.GetAttribute("Gender")) ?? string.Empty;
            if (!string.Equals(selectedGender, genderName, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "Selected voice gender " + selectedGender + " does not match requested " + genderName + "."
                );
            }

            var fileStreamType = Type.GetTypeFromProgID("SAPI.SpFileStream", true);
            dynamic stream = Activator.CreateInstance(fileStreamType);
            stream.Open(target, 3, false);
            voice.Voice = bestToken;
            voice.Rate = Math.Max(-10, Math.Min(10, rate));
            voice.AudioOutputStream = stream;
            voice.Speak(text);
            stream.Close();

            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine(
                "LOCAL_TTS_RESULT\t" + selectedGender + "\t" +
                (Convert.ToString(bestToken.GetDescription()) ?? genderName)
            );
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 1;
        }
    }
}
""".replace("__LOCAL_PROFILE_CASES__", local_profile_cases).strip()

        if not source_path.exists() or source_path.read_text(encoding="utf-8") != source_code:
            source_path.write_text(source_code, encoding="utf-8")

        if exe_path.exists() and exe_path.stat().st_mtime >= source_path.stat().st_mtime:
            return exe_path

        completed = subprocess.run(
            [str(csc_path), "/nologo", f"/out:{exe_path}", str(source_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        if completed.returncode != 0 or not exe_path.exists():
            raise RuntimeError(
                f"Local TTS helper compile failed: {(completed.stderr or completed.stdout or '').strip() or 'unknown error'}"
            )
        return exe_path

    async def _generate_local_tts_audio(
        self,
        text: str,
        gender: str,
        voice_style_key: Optional[str] = None,
    ) -> GenAudioResponse:
        from routers.local_dev import (
            MATERIAL_ASSET_FILE_ROOT,
            _material_asset_public_url,
            _read_material_asset_index,
            _write_material_asset_index,
        )

        resolved_style, resolved_gender, preferred_voice_hint, rate = self._resolve_local_tts_profile(
            gender,
            voice_style_key,
        )
        cache_key = self._local_tts_cache_key(text, gender, voice_style_key)
        asset_id = f"local-tts-{cache_key}"
        wav_name = f"{asset_id}.wav"
        MATERIAL_ASSET_FILE_ROOT.mkdir(parents=True, exist_ok=True)
        wav_path = MATERIAL_ASSET_FILE_ROOT / wav_name
        voice_name = preferred_voice_hint

        if wav_path.exists() and wav_path.stat().st_size <= 64:
            wav_path.unlink(missing_ok=True)

        if not wav_path.exists():
            with tempfile.NamedTemporaryFile("w", suffix=".txt", encoding="utf-8", delete=False) as text_handle:
                text_handle.write(text)
                text_path = Path(text_handle.name)
            try:
                helper_exe = await asyncio.to_thread(self._ensure_local_tts_helper)
                completed = await asyncio.to_thread(
                    subprocess.run,
                    [
                        str(helper_exe),
                        str(wav_path),
                        str(text_path),
                        resolved_gender,
                        resolved_style,
                    ],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    check=False,
                )
            finally:
                text_path.unlink(missing_ok=True)

            if completed.returncode != 0 or not wav_path.exists() or wav_path.stat().st_size <= 64:
                raise RuntimeError(
                    f"Local TTS failed: {(completed.stderr or completed.stdout or '').strip() or 'unknown error'}"
                )
            try:
                actual_gender, voice_name = self._parse_local_tts_helper_result(completed.stdout or "")
            except RuntimeError:
                wav_path.unlink(missing_ok=True)
                raise
            if actual_gender != resolved_gender:
                wav_path.unlink(missing_ok=True)
                raise RuntimeError(
                    f"Local TTS selected {actual_gender} voice {voice_name!r} for requested {resolved_gender} speech."
                )

        items = _read_material_asset_index()
        updated_at = self._iso_now()
        content_hash = hashlib.sha256(wav_path.read_bytes()).hexdigest()
        exists = next((item for item in items if str(item.get("assetId") or "").strip() == asset_id), None)
        index_changed = False
        if exists:
            next_fields = {
                "sizeBytes": wav_path.stat().st_size,
                "relativePath": f"files/{wav_name}",
                "mimeType": "audio/wav",
                "contentHash": content_hash,
            }
            index_changed = any(exists.get(key) != value for key, value in next_fields.items())
            if index_changed:
                exists.update(next_fields)
                exists["updatedAt"] = updated_at
        else:
            items.append(
                {
                    "assetId": asset_id,
                    "fileName": wav_name,
                    "mimeType": "audio/wav",
                    "sizeBytes": wav_path.stat().st_size,
                    "createdAt": updated_at,
                    "updatedAt": updated_at,
                    "contentHash": content_hash,
                    "relativePath": f"files/{wav_name}",
                }
            )
            index_changed = True
        if index_changed:
            _write_material_asset_index(items)

        return GenAudioResponse(
            url=_material_asset_public_url(asset_id, content_hash),
            model="windows-local-tts",
            gender=resolved_gender,
            voice=voice_name,
        )

    @staticmethod
    def _iso_now() -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def _build_provider_client(provider: str, api_key: str, base_url: Optional[str] = None) -> AsyncOpenAI:
        """Build a provider client for ad hoc model validation and website builder requests."""
        provider_key = provider.strip().lower()
        normalized_key = api_key.strip()
        if not normalized_key:
            raise ValueError("API key is required.")

        if provider_key == "google":
            resolved_base_url = (base_url or "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/")
            return AsyncOpenAI(
                api_key=normalized_key,
                base_url=resolved_base_url,
                default_headers=AIHubService._build_default_headers(resolved_base_url),
            )

        if provider_key == "openai":
            resolved_base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
            return AsyncOpenAI(
                api_key=normalized_key,
                base_url=resolved_base_url,
                default_headers=AIHubService._build_default_headers(resolved_base_url),
            )

        raise ValueError(f"Unsupported provider: {provider}")

    @staticmethod
    def _extract_response_text(response: object) -> str:
        """Extract text from OpenAI Responses API output."""
        output_text = getattr(response, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()

        output = getattr(response, "output", None)
        if not output:
            return ""

        parts: List[str] = []
        for item in output:
            content_items = getattr(item, "content", None)
            if not content_items:
                continue
            for content in content_items:
                text = getattr(content, "text", None)
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        return "\n".join(parts).strip()

    async def test_provider_key(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: Optional[str] = None,
    ) -> str:
        """Validate whether a provider key can actually call the given model."""
        client = self._build_provider_client(provider=provider, api_key=api_key, base_url=base_url)
        provider_key = provider.strip().lower()

        if provider_key == "google":
            response = await client.responses.create(
                model=model,
                input="ping",
                max_output_tokens=16,
            )
            text = self._extract_response_text(response)
            if not text:
                raise RuntimeError("Google key test returned no content.")
            return "Provider key test succeeded."

        if provider_key == "openai":
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=16,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise RuntimeError("OpenAI/Codex key test returned no content.")
            return "Provider key test succeeded."

        raise ValueError(f"Unsupported provider: {provider}")

    async def generate_website_builder(
        self,
        provider: str,
        model: str,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None,
    ) -> str:
        """Route website builder generation through the backend using the selected provider."""
        client = self._build_provider_client(provider=provider, api_key=api_key, base_url=base_url)
        provider_key = provider.strip().lower()

        if provider_key == "google":
            response = await client.responses.create(
                model=model,
                input=prompt,
                max_output_tokens=8192,
            )
            text = self._extract_response_text(response)
            if not text:
                raise RuntimeError("AI website builder returned empty content.")
            return text

        if provider_key == "openai":
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8192,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise RuntimeError("AI website builder returned empty content.")
            return text

        raise ValueError(f"Unsupported provider: {provider}")

    @classmethod
    def _resolve_env_key_from_provider(cls, provider: AIProviderConfig) -> str:
        env_name = (provider.api_key_env or "").strip()
        if env_name:
            value = os.environ.get(env_name, "").strip()
            if value:
                return value

        provider_key = (provider.provider_key or "").strip().lower()
        if provider_key == "openai":
            if settings.openai_api_key.strip():
                return settings.openai_api_key.strip()
            if settings.app_ai_key.strip():
                return settings.app_ai_key.strip()
        if provider_key == "codex":
            if settings.codex_api_key.strip():
                return settings.codex_api_key.strip()
            if settings.app_ai_key.strip():
                return settings.app_ai_key.strip()

        if settings.app_ai_key.strip():
            return settings.app_ai_key.strip()

        return ""

    @classmethod
    def _provider_runtime_key_and_base(cls, provider: AIProviderConfig) -> tuple[str, Optional[str]]:
        api_key = cls._resolve_env_key_from_provider(provider)
        base_url = (provider.base_url or "").strip() or None
        return api_key, base_url

    @classmethod
    def _normalize_provider_key_for_runtime(cls, provider: AIProviderConfig) -> str:
        provider_key = (provider.provider_key or "").strip().lower()
        if provider_key in {"openai", "codex"}:
            return "openai"
        if provider_key in {"google", "gemini"}:
            return "google"
        return provider_key

    @staticmethod
    def _normalize_site_id(site_id: Optional[str]) -> str:
        return (site_id or "").strip()

    @staticmethod
    def _extract_builder_requirement(prompt: str) -> str:
        """Extract the user requirement portion from the AI builder prompt when present."""
        match = re.search(r"用户需求[:：]\s*(.+?)(?:\n\s*\n要求[:：]|\Z)", prompt or "", flags=re.DOTALL)
        if not match:
            return ""
        return re.sub(r"\s+", " ", match.group(1)).strip()

    @classmethod
    def _build_local_assigned_app_fallback(
        cls,
        app_key: str,
        prompt: str,
    ) -> Optional[tuple[str, str, str]]:
        """
        Provide a local fallback for selected apps when HQ provider routing is not runnable.

        `ai-chat` can continue with the frontend's local builder rules, so we return a
        readable response instead of failing the whole conversation and leaving the
        preview sandbox empty.
        """
        normalized_app_key = (app_key or "").strip().lower()
        if normalized_app_key != "ai-chat":
            return None

        requirement = cls._extract_builder_requirement(prompt)
        requirement_line = f"已根据你的需求“{requirement}”继续生成当前站点草稿。" if requirement else "已继续生成当前站点草稿。"
        content = (
            "当前总部 AI 模型暂时没有可运行的密钥配置，系统已自动切换到本地建站兜底模式。\n\n"
            f"{requirement_line}\n"
            "你可以继续调整首页结构、多语言导航、产品模块、公司介绍、FAQ、联系方式和询盘入口，右侧沙盘会继续按最新内容实时刷新。\n\n"
            "后续只要补齐总部 AI Provider 的可用密钥，系统会自动恢复真实模型生成。"
        )
        return content, "local-fallback", "builder-rule-v1"

    @staticmethod
    def _coerce_int(value: object) -> Optional[int]:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            try:
                return int(value.strip())
            except ValueError:
                return None
        return None

    @classmethod
    def _read_published_site(cls, site_id: Optional[str]) -> Optional[dict[str, Any]]:
        normalized_site_id = cls._normalize_site_id(site_id)
        if not normalized_site_id:
            return None

        try:
            from core.path_registry import get_path_registry

            store_path = get_path_registry().backend_root / "published_sites.json"
            if not store_path.exists():
                return None
            raw = json.loads(store_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        if not isinstance(raw, list):
            return None

        for item in raw:
            if isinstance(item, dict) and str(item.get("id") or "").strip() == normalized_site_id:
                return item
        return None

    @staticmethod
    async def _find_org(
        db: AsyncSession,
        org_id: Optional[int] = None,
        code: Optional[str] = None,
        allowed_types: Optional[set[str]] = None,
    ) -> Optional[Organization]:
        org: Optional[Organization] = None
        if org_id:
            org = await db.scalar(select(Organization).where(Organization.id == org_id))
        if not org and code:
            org = await db.scalar(select(Organization).where(Organization.code == code.strip().upper()))
        if org and allowed_types and org.org_type not in allowed_types:
            return None
        return org

    @classmethod
    async def _collect_org_chain_ids(cls, db: AsyncSession, start_org_id: Optional[int]) -> list[int]:
        if not start_org_id:
            return []

        ids: list[int] = []
        seen: set[int] = set()
        current_id = start_org_id

        while current_id and current_id not in seen:
            seen.add(current_id)
            org = await db.scalar(select(Organization).where(Organization.id == current_id))
            if not org:
                break
            ids.append(org.id)
            current_id = org.parent_id

        return ids

    @classmethod
    async def _resolve_assignment_scope_org_ids(
        cls,
        db: AsyncSession,
        site_id: Optional[str] = None,
        project_id: Optional[int] = None,
        org_id: Optional[int] = None,
    ) -> list[int]:
        published_site = cls._read_published_site(site_id)
        explicit_org = await cls._find_org(db, org_id=org_id)

        resolved_project: Optional[Project] = None
        candidate_project_id = project_id or cls._coerce_int((published_site or {}).get("planId"))
        if candidate_project_id:
            resolved_project = await db.scalar(select(Project).where(Project.id == candidate_project_id))

        client_org: Optional[Organization] = None
        if resolved_project:
            client_org = await cls._find_org(
                db,
                org_id=resolved_project.client_org_id,
                allowed_types={"client"},
            )

        if not client_org and explicit_org and explicit_org.org_type == "client":
            client_org = explicit_org

        if not client_org and published_site:
            client_org = await cls._find_org(
                db,
                org_id=cls._coerce_int(published_site.get("clientId")),
                code=str(published_site.get("clientCode") or "") or None,
                allowed_types={"client"},
            )

        agency_org: Optional[Organization] = None
        if client_org and client_org.parent_id:
            agency_org = await cls._find_org(
                db,
                org_id=client_org.parent_id,
                allowed_types={"agency", "sub_agency"},
            )

        if not agency_org and explicit_org and explicit_org.org_type in {"agency", "sub_agency"}:
            agency_org = explicit_org

        if not agency_org and published_site:
            agency_org = await cls._find_org(
                db,
                org_id=cls._coerce_int(published_site.get("agencyId")),
                code=str(published_site.get("agencyCode") or "") or None,
                allowed_types={"agency", "sub_agency"},
            )

        chain_ids: list[int] = []
        for start_id in (
            client_org.id if client_org else None,
            agency_org.id if agency_org else None,
            explicit_org.id if explicit_org else None,
        ):
            for candidate_id in await cls._collect_org_chain_ids(db, start_id):
                if candidate_id not in chain_ids:
                    chain_ids.append(candidate_id)

        hq_org = await db.scalar(select(Organization).where(Organization.org_type == "hq").order_by(Organization.id))
        hq_id = hq_org.id if hq_org else 1
        if hq_id not in chain_ids:
            chain_ids.append(hq_id)

        return chain_ids

    async def run_assigned_app(
        self,
        db: AsyncSession,
        app_key: str,
        prompt: str,
        history: Optional[List[dict]] = None,
        site_id: Optional[str] = None,
        project_id: Optional[int] = None,
        org_id: Optional[int] = None,
    ) -> tuple[str, str, str]:
        normalized_app_key = (app_key or "").strip()
        if not normalized_app_key:
            raise ValueError("app_key is required.")
        if not prompt.strip():
            raise ValueError("prompt is required.")

        scope_org_ids = await self._resolve_assignment_scope_org_ids(
            db=db,
            site_id=site_id,
            project_id=project_id,
            org_id=org_id,
        )

        assignments: list[AIAppAssignment] = []
        for scope_org_id in scope_org_ids:
            result = await db.execute(
                select(AIAppAssignment)
                .where(
                    AIAppAssignment.org_id == scope_org_id,
                    AIAppAssignment.app_key == normalized_app_key,
                    AIAppAssignment.enabled == True,  # noqa: E712
                )
                .order_by(
                    AIAppAssignment.sort_order.desc(),
                    AIAppAssignment.updated_at.desc(),
                    AIAppAssignment.id.desc(),
                )
            )
            assignment = result.scalars().first()
            if assignment:
                assignments.append(assignment)

        if not assignments:
            result = await db.execute(
                select(AIAppAssignment)
                .where(
                    AIAppAssignment.org_id.is_(None),
                    AIAppAssignment.app_key == normalized_app_key,
                    AIAppAssignment.enabled == True,  # noqa: E712
                )
                .order_by(
                    AIAppAssignment.sort_order.desc(),
                    AIAppAssignment.updated_at.desc(),
                    AIAppAssignment.id.desc(),
                )
            )
            fallback_assignment = result.scalars().first()
            if fallback_assignment:
                assignments.append(fallback_assignment)

        if not assignments:
            local_fallback = self._build_local_assigned_app_fallback(normalized_app_key, prompt)
            if local_fallback:
                logger.warning(
                    "Assigned AI app %s is missing or disabled; using local fallback response.",
                    normalized_app_key,
                )
                return local_fallback
            raise ValueError(f"Assigned AI app not found or disabled: {normalized_app_key}")

        for assignment in assignments:
            candidate_provider_ids = [assignment.primary_provider_id, assignment.backup_provider_id]
            candidate_models = [assignment.primary_model, assignment.backup_model]

            for provider_id, model_name in zip(candidate_provider_ids, candidate_models):
                if not provider_id or not (model_name or "").strip():
                    continue
                provider = await db.scalar(
                    select(AIProviderConfig).where(
                        AIProviderConfig.id == provider_id,
                        AIProviderConfig.is_active == True,  # noqa: E712
                    )
                )
                if not provider:
                    continue
                api_key, base_url = self._provider_runtime_key_and_base(provider)
                if not api_key:
                    continue
                runtime_provider = self._normalize_provider_key_for_runtime(provider)
                content = await self.generate_assigned_prompt(
                    provider=runtime_provider,
                    model=model_name.strip(),
                    api_key=api_key,
                    prompt=prompt,
                    history=history or [],
                    base_url=base_url,
                )
                if content.strip():
                    return content.strip(), provider.provider_key, model_name.strip()

        local_fallback = self._build_local_assigned_app_fallback(normalized_app_key, prompt)
        if local_fallback:
            logger.warning(
                "Assigned AI app %s has no runnable provider in current runtime; using local fallback response.",
                normalized_app_key,
            )
            return local_fallback

        raise ValueError(f"No runnable provider configured for assigned AI app: {normalized_app_key}")

    async def resolve_assigned_app_scope(
        self,
        db: AsyncSession,
        app_key: str,
        site_id: Optional[str] = None,
        project_id: Optional[int] = None,
        org_id: Optional[int] = None,
    ) -> dict[str, Any]:
        normalized_app_key = (app_key or "").strip()
        if not normalized_app_key:
            raise ValueError("app_key is required.")

        scope_org_ids = await self._resolve_assignment_scope_org_ids(
            db=db,
            site_id=site_id,
            project_id=project_id,
            org_id=org_id,
        )

        search_chain: list[dict[str, Any]] = []
        matched_assignment: Optional[AIAppAssignment] = None
        matched_org: Optional[Organization] = None

        for scope_org_id in scope_org_ids:
            org = await db.scalar(select(Organization).where(Organization.id == scope_org_id))
            assignment = await db.scalar(
                select(AIAppAssignment)
                .where(
                    AIAppAssignment.org_id == scope_org_id,
                    AIAppAssignment.app_key == normalized_app_key,
                    AIAppAssignment.enabled == True,  # noqa: E712
                )
                .order_by(
                    AIAppAssignment.sort_order.desc(),
                    AIAppAssignment.updated_at.desc(),
                    AIAppAssignment.id.desc(),
                )
            )
            is_match = assignment is not None and matched_assignment is None
            search_chain.append(
                {
                    "org_id": scope_org_id,
                    "org_code": org.code if org else f"ORG-{scope_org_id}",
                    "org_name": org.name if org else f"Organization {scope_org_id}",
                    "org_type": org.org_type if org else "unknown",
                    "matched": is_match,
                }
            )
            if is_match:
                matched_assignment = assignment
                matched_org = org

        if not matched_assignment:
            fallback_assignment = await db.scalar(
                select(AIAppAssignment)
                .where(
                    AIAppAssignment.org_id.is_(None),
                    AIAppAssignment.app_key == normalized_app_key,
                    AIAppAssignment.enabled == True,  # noqa: E712
                )
                .order_by(
                    AIAppAssignment.sort_order.desc(),
                    AIAppAssignment.updated_at.desc(),
                    AIAppAssignment.id.desc(),
                )
            )
            search_chain.append(
                {
                    "org_id": None,
                    "org_code": "GLOBAL",
                    "org_name": "Platform Global",
                    "org_type": "global",
                    "matched": fallback_assignment is not None,
                }
            )
            matched_assignment = fallback_assignment

        primary_provider = None
        backup_provider = None
        if matched_assignment and matched_assignment.primary_provider_id:
            primary_provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == matched_assignment.primary_provider_id))
        if matched_assignment and matched_assignment.backup_provider_id:
            backup_provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == matched_assignment.backup_provider_id))

        return {
            "app_key": normalized_app_key,
            "site_id": self._normalize_site_id(site_id) or None,
            "project_id": project_id,
            "org_id": org_id,
            "resolved": matched_assignment is not None,
            "matched_assignment_id": matched_assignment.id if matched_assignment else None,
            "matched_org_id": matched_org.id if matched_org else None,
            "matched_org_code": matched_org.code if matched_org else ("GLOBAL" if matched_assignment else ""),
            "matched_org_name": matched_org.name if matched_org else ("Platform Global" if matched_assignment else ""),
            "matched_org_type": matched_org.org_type if matched_org else ("global" if matched_assignment else ""),
            "app_name": (matched_assignment.app_name if matched_assignment else "") or normalized_app_key,
            "primary_provider_id": matched_assignment.primary_provider_id if matched_assignment else None,
            "primary_provider_key": primary_provider.provider_key if primary_provider else "",
            "primary_provider_name": primary_provider.name if primary_provider else "",
            "primary_model": matched_assignment.primary_model if matched_assignment else "",
            "backup_provider_id": matched_assignment.backup_provider_id if matched_assignment else None,
            "backup_provider_key": backup_provider.provider_key if backup_provider else "",
            "backup_provider_name": backup_provider.name if backup_provider else "",
            "backup_model": matched_assignment.backup_model if matched_assignment else "",
            "enabled": matched_assignment.enabled if matched_assignment else False,
            "sort_order": matched_assignment.sort_order if matched_assignment else 0,
            "search_chain": search_chain,
        }

    async def generate_assigned_prompt(
        self,
        provider: str,
        model: str,
        api_key: str,
        prompt: str,
        history: Optional[List[dict]] = None,
        base_url: Optional[str] = None,
    ) -> str:
        client = self._build_provider_client(provider=provider, api_key=api_key, base_url=base_url)
        provider_key = provider.strip().lower()
        history = history or []

        if provider_key == "google":
            history_lines = []
            for item in history:
                role = "assistant" if item.get("role") == "assistant" else "user"
                content = str(item.get("content") or "").strip()
                if content:
                    history_lines.append(f"{role}: {content}")
            full_prompt = prompt if not history_lines else f"{prompt}\n\nRecent history:\n" + "\n".join(history_lines)
            response = await client.responses.create(
                model=model,
                input=full_prompt,
                max_output_tokens=4096,
            )
            text = self._extract_response_text(response)
            if not text:
                raise RuntimeError("Assigned AI run returned empty content.")
            return text

        if provider_key == "openai":
            messages = []
            for item in history:
                role = str(item.get("role") or "user").strip().lower()
                if role not in {"system", "assistant", "user"}:
                    role = "user"
                content = str(item.get("content") or "").strip()
                if content:
                    messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": prompt})
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise RuntimeError("Assigned AI run returned empty content.")
            return text

        raise ValueError(f"Unsupported provider: {provider}")

    def _convert_message(self, msg) -> dict:
        """Convert message format and support multimodal content."""
        content = msg.content
        # If content is a list (multimodal), convert it to plain dicts
        if isinstance(content, list):
            content = [item.model_dump() if hasattr(item, "model_dump") else item for item in content]
        return {"role": msg.role, "content": content}

    async def gentxt(self, request: GenTxtRequest) -> GenTxtResponse:
        """
        Generate Text API (non-streaming), supports text and image input.

        Args:
            request: Generate text request parameters.

        Returns:
            Txt2TxtResponse: generated text response.
        """
        try:
            client = self._require_ai_client()
            messages = [self._convert_message(msg) for msg in request.messages]

            response = await client.chat.completions.create(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=False,
            )

            content = response.choices[0].message.content or ""
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

            return GenTxtResponse(
                content=content,
                model=request.model,
                usage=usage,
            )

        except Exception as e:
            logger.error(f"gentxt error: {e}")
            raise

    async def gentxt_stream(self, request: GenTxtRequest) -> AsyncGenerator[str, None]:
        """
        Generate Text API (streaming), supports text and image input.

        Args:
            request: Generate text request parameters.

        Yields:
            str: Generated text content chunk (plain text, not JSON).
        """
        try:
            client = self._require_ai_client()
            messages = [self._convert_message(msg) for msg in request.messages]

            stream = await client.chat.completions.create(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"gentxt_stream error: {e}")
            raise

    @staticmethod
    def _extract_image_ref(item: object) -> str:
        """
        Extract an image reference from an OpenAI-compatible genimg response item.

        Prefer `url` (to avoid huge response bodies); if url is not available, fall back to `b64_json`
        and wrap it as a base64 data URI.
        Compatible with both dict items and SDK object items.
        """
        if isinstance(item, dict):
            url = item.get("url")
            if url:
                return url
            b64_json = item.get("b64_json")
            if b64_json:
                return f"data:image/png;base64,{b64_json}"
        else:
            url = getattr(item, "url", None)
            if url:
                return url
            b64_json = getattr(item, "b64_json", None)
            if b64_json:
                return f"data:image/png;base64,{b64_json}"

        raise RuntimeError("Neither url nor b64_json found in genimg response item")

    @staticmethod
    def _parse_data_uri(data_uri: str) -> Tuple[bytes, str]:
        """Parse a base64 data URI and return (bytes, content_type)."""
        if "," not in data_uri:
            raise InvalidImageInputError("Invalid data URI: missing ',' separator.")

        header, b64_data = data_uri.split(",", 1)
        content_type = "image/png"
        if header.startswith("data:"):
            meta = header[5:]
            # Typical header: "image/png;base64"
            if ";" in meta:
                maybe_type = meta.split(";", 1)[0].strip()
                if maybe_type:
                    content_type = maybe_type
            elif meta.strip():
                content_type = meta.strip()

        try:
            return base64.b64decode(b64_data), content_type
        except Exception as e:
            raise InvalidImageInputError("Invalid base64 data in data URI.") from e

    @staticmethod
    def _filename_from_content_type(content_type: str, name_prefix: str = "file", default_ext: str = "bin") -> str:
        """Best-effort filename for in-memory uploads."""
        ct = (content_type or "").lower()
        ext = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/webp": "webp",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mp4": "m4a",
            "audio/x-m4a": "m4a",
            "audio/webm": "webm",
            "audio/ogg": "ogg",
            "audio/flac": "flac",
        }.get(ct, default_ext)
        return f"{name_prefix}.{ext}"

    @staticmethod
    def _get_source_name(source_ref: str, fallback: str = "input_file") -> str:
        """Get a readable display name from a URL/path/data URI."""
        ref = (source_ref or "").strip()
        if ref.startswith(("http://", "https://")):
            return ref.split("?")[0].rstrip("/").split("/")[-1] or fallback
        if ref.startswith("data:"):
            return fallback
        return Path(ref).name or fallback

    async def _image_str_to_upload_file(self, image: str, name_prefix: str = "image") -> io.BytesIO:
        """
        Convert image input (base64 data URI or HTTP URL) into an in-memory file object for uploads.

        The OpenAI `images.edit` endpoint expects multipart file uploads; we keep the API JSON-only
        by allowing clients to pass a base64 data URI or HTTP URL, and converting it here.
        """
        image = (image or "").strip()
        if not image:
            raise InvalidImageInputError("Input image is empty.")

        # Handle HTTP URL: download content
        if image.startswith(("http://", "https://")):
            import httpx

            try:
                async with httpx.AsyncClient(timeout=60.0, trust_env=True) as client:
                    resp = await client.get(image)
                    resp.raise_for_status()
                    image_bytes = resp.content

                # Extract filename from URL (fallback if missing)
                name = image.split("?")[0].rstrip("/").split("/")[-1] or f"{name_prefix}.png"
                upload = io.BytesIO(image_bytes)
                upload.name = name  # type: ignore[attr-defined]
                return upload
            except Exception as e:
                raise InvalidImageInputError(f"Failed to download image from URL: {e}") from e

        if not image.startswith("data:"):
            raise InvalidImageInputError(
                "Only base64 data URI or HTTP URL is supported. Example: `data:image/png;base64,...` or `https://...`."
            )

        image_bytes, content_type = self._parse_data_uri(image)

        upload = io.BytesIO(image_bytes)
        # openai SDK uses this name for multipart filename
        upload.name = self._filename_from_content_type(  # type: ignore[attr-defined]
            content_type,
            name_prefix=name_prefix,
            default_ext="png",
        )
        return upload

    async def _image_input_to_upload_files(self, image_input: Union[str, List[str]]) -> List[io.BytesIO]:
        """
        Convert image input (single data URI or list of data URIs) into uploadable file objects.

        Some OpenAI-compatible `images/edits` implementations support multiple input images.
        """
        images = [image_input] if isinstance(image_input, str) else image_input
        if not images:
            raise InvalidImageInputError("Input image list is empty.")

        upload_files: List[io.BytesIO] = []
        for idx, img in enumerate(images):
            if not isinstance(img, str):
                raise InvalidImageInputError("Each image must be a base64 data URI string.")
            upload_files.append(await self._image_str_to_upload_file(img, name_prefix=f"image_{idx + 1}"))
        return upload_files

    async def _audio_str_to_upload_file(self, audio: str, name_prefix: str = "audio") -> io.BytesIO:
        """
        Convert audio input (base64 data URI, HTTP URL, or absolute path) into an in-memory file object.

        This keeps the API JSON-only while still supporting OpenAI-compatible multipart upload semantics.
        """
        audio = (audio or "").strip()
        if not audio:
            raise InvalidAudioInputError("Input audio is empty.")

        if audio.startswith(("http://", "https://")):
            try:
                async with httpx.AsyncClient(timeout=120.0, trust_env=True) as client:
                    resp = await client.get(audio)
                    resp.raise_for_status()
                    audio_bytes = resp.content
                name = self._get_source_name(audio, fallback=f"{name_prefix}.mp3")
                upload = io.BytesIO(audio_bytes)
                upload.name = name  # type: ignore[attr-defined]
                return upload
            except Exception as e:
                raise InvalidAudioInputError(f"Failed to download audio from URL: {e}") from e

        if audio.startswith("data:"):
            audio_bytes, content_type = self._parse_data_uri(audio)
            upload = io.BytesIO(audio_bytes)
            upload.name = self._filename_from_content_type(  # type: ignore[attr-defined]
                content_type,
                name_prefix=name_prefix,
                default_ext="mp3",
            )
            return upload

        path = Path(audio).expanduser()
        if not path.is_absolute():
            raise InvalidAudioInputError(
                "Only absolute path, http(s) URL, or base64 data URI is supported for audio input."
            )
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Audio file not found: {str(path)}")

        upload = io.BytesIO(path.read_bytes())
        upload.name = path.name  # type: ignore[attr-defined]
        return upload

    @staticmethod
    def _extract_transcription_text(resp: object) -> Optional[str]:
        """Extract transcription text from SDK response."""
        if isinstance(resp, str) and resp.strip():
            return resp.strip()

        if isinstance(resp, dict):
            text = resp.get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()
            content = resp.get("content")
        else:
            text = getattr(resp, "text", None)
            if isinstance(text, str) and text.strip():
                return text.strip()
            content = getattr(resp, "content", None)

        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="ignore")

        if isinstance(content, dict):
            data = content
        elif isinstance(content, str) and content.strip():
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                return None
        else:
            return None

        text = data.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
        return None

    @staticmethod
    def _parse_base64_data_uri(data_uri: str, *, error_cls: Type[ValueError]) -> Tuple[bytes, str]:
        """Parse a base64 data URI and return decoded bytes plus content type."""
        if "," not in data_uri:
            raise error_cls("Invalid data URI: missing ',' separator.")

        header, b64_data = data_uri.split(",", 1)
        content_type = "application/octet-stream"
        if header.startswith("data:"):
            meta = header[5:]
            if ";" in meta:
                maybe_type = meta.split(";", 1)[0].strip()
                if maybe_type:
                    content_type = maybe_type
            elif meta.strip():
                content_type = meta.strip()

        try:
            return base64.b64decode(b64_data), content_type
        except Exception as exc:
            raise error_cls("Invalid base64 data in data URI.") from exc

    @staticmethod
    def _extract_chat_text_content(content: object) -> str:
        """Extract text from OpenAI-compatible chat message content."""
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                else:
                    text = getattr(item, "text", None)
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
            return "\n".join(parts).strip()

        return ""

    @classmethod
    def _extract_completion_text(cls, response: object) -> str:
        """Extract the first completion text from a chat completion response."""
        choices = getattr(response, "choices", None)
        if not choices:
            return ""
        first_choice = choices[0]
        message = getattr(first_choice, "message", None)
        content = getattr(message, "content", None) if message else None
        return cls._extract_chat_text_content(content)

    @staticmethod
    def _build_pdf_user_prompt(instruction: str, mode: str) -> str:
        return f"""{PDF_MODE_PROMPTS[mode]}

User instruction:
{instruction.strip()}
"""

    @staticmethod
    def _build_pdf_success_message(page_start: int, page_end: int, total_pages: int) -> str:
        selected_range = f"page {page_start}" if page_start == page_end else f"pages {page_start}-{page_end}"
        total_label = "page" if total_pages == 1 else "pages"
        return f"PDF analyzed successfully using {selected_range} of {total_pages} total {total_label}."

    @staticmethod
    def _resolve_pdf_page_range(
        total_pages: int,
        page_start: int = 1,
        page_end: Optional[int] = None,
    ) -> Tuple[int, int]:
        if total_pages <= 0:
            raise InvalidPdfInputError("PDF has no pages.")
        if page_start < 1:
            raise InvalidPdfInputError("page_start must be greater than or equal to 1.")
        if page_start > total_pages:
            raise InvalidPdfInputError(f"page_start {page_start} exceeds total PDF pages {total_pages}.")

        if page_end is None:
            page_end = min(total_pages, page_start + PDF_MAX_PAGE_WINDOW - 1)

        if page_end < page_start:
            raise InvalidPdfInputError("page_end must be greater than or equal to page_start.")
        if page_end > total_pages:
            raise InvalidPdfInputError(f"page_end {page_end} exceeds total PDF pages {total_pages}.")

        selected_pages = page_end - page_start + 1
        if selected_pages > PDF_MAX_PAGE_WINDOW:
            raise InvalidPdfInputError(
                f"Requested page range contains {selected_pages} pages. "
                f"The maximum supported range per request is {PDF_MAX_PAGE_WINDOW} pages."
            )

        return page_start, page_end

    @staticmethod
    def _validate_pdf_attachment_limits(pdf_bytes: bytes, page_count: int) -> None:
        if len(pdf_bytes) <= PDF_MAX_TOTAL_BYTES and page_count <= PDF_MAX_TOTAL_PAGES:
            return

        size_mb = len(pdf_bytes) / 1024 / 1024
        raise InvalidPdfInputError(
            "PDF exceeds native attachment limits: "
            f"{size_mb:.2f}MB and {page_count} pages "
            "(limits: 15MB total, 80 pages total)."
        )

    @classmethod
    def _prepare_pdf_attachment(
        cls,
        pdf_bytes: bytes,
        page_start: int = 1,
        page_end: Optional[int] = None,
    ) -> Tuple[str, int, int, int]:
        try:
            source_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise InvalidPdfInputError("Failed to read the provided PDF document.") from exc

        try:
            total_pages = source_doc.page_count
            start, end = cls._resolve_pdf_page_range(total_pages=total_pages, page_start=page_start, page_end=page_end)
            subset_doc = fitz.open()
            try:
                subset_doc.insert_pdf(source_doc, from_page=start - 1, to_page=end - 1)
                subset_bytes = subset_doc.tobytes(garbage=4, deflate=True)
            finally:
                subset_doc.close()
        finally:
            source_doc.close()

        cls._validate_pdf_attachment_limits(subset_bytes, end - start + 1)
        return base64.b64encode(subset_bytes).decode("utf-8"), start, end, total_pages

    async def _pdf_source_to_bytes(self, pdf: str) -> Tuple[bytes, str]:
        """Resolve a PDF data URI into raw bytes and a readable file name."""
        pdf = (pdf or "").strip()
        if not pdf:
            raise InvalidPdfInputError("PDF input is empty.")

        if not pdf.startswith("data:"):
            raise InvalidPdfInputError(
                "Only base64 PDF data URI is supported for PDF input. Example: `data:application/pdf;base64,...`."
            )

        pdf_bytes, content_type = self._parse_base64_data_uri(pdf, error_cls=InvalidPdfInputError)
        if content_type.lower() != "application/pdf":
            raise InvalidPdfInputError("PDF data URI must use content type `application/pdf`.")

        return pdf_bytes, self._get_source_name(pdf, fallback="document.pdf")

    async def analyze_pdf(self, request: AnalyzePdfRequest) -> AnalyzePdfResponse:
        """Analyze a single PDF with native PDF input."""
        if not request.instruction or not request.instruction.strip():
            raise InvalidPdfInputError("instruction is required for PDF analysis.")

        client = self._require_ai_client()
        pdf_bytes, pdf_name = await self._pdf_source_to_bytes(request.pdf)
        pdf_b64, start, end, total_pages = self._prepare_pdf_attachment(
            pdf_bytes=pdf_bytes,
            page_start=request.page_start,
            page_end=request.page_end,
        )
        user_prompt = self._build_pdf_user_prompt(request.instruction, request.mode)
        response = await client.chat.completions.create(
            model=PDF_ANALYSIS_MODEL,
            messages=[
                {"role": "system", "content": PDF_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_b64,
                            },
                            "citations": {"enabled": True},
                        },
                    ],
                },
            ],
            temperature=0.0,
            max_tokens=8192,
            stream=False,
        )
        result = self._extract_completion_text(response)
        if not result:
            raise RuntimeError("PDF analysis returned an empty result.")

        return AnalyzePdfResponse(
            status="success",
            result=result,
            message=self._build_pdf_success_message(start, end, total_pages),
            pdf_name=pdf_name,
            mode=request.mode,
            model=PDF_ANALYSIS_MODEL,
            page_start=start,
            page_end=end,
            total_pages=total_pages,
        )

    async def genimg(self, request: GenImgRequest) -> GenImgResponse:
        """
        Generate Image API.

        Args:
            request: Generate image request parameters.

        Returns:
            GenImgResponse: generated image response, where `images` is a list of image refs (URL preferred; fallback to base64 data URI).
        """
        try:
            client = self._require_ai_client()
            # If an input image is provided, use the image editing endpoint (img2img).
            if request.image:
                image_files = await self._image_input_to_upload_files(request.image)
                image_param = image_files[0] if len(image_files) == 1 else image_files
                response = await client.images.edit(
                    model=request.model,
                    image=image_param,
                    prompt=request.prompt,
                    size=request.size,
                    n=request.n,
                )
            else:
                response = await client.images.generate(
                    model=request.model,
                    prompt=request.prompt,
                    size=request.size,
                    quality=request.quality,
                    n=request.n,
                )

            revised_prompt = response.data[0].revised_prompt if response.data else None

            if not response.data:
                raise RuntimeError("Image generation returned empty result")

            # Prefer URL to avoid huge response bodies; fallback to base64 data URI.
            images = [self._extract_image_ref(item) for item in response.data]

            return GenImgResponse(
                images=images,
                model=request.model,
                revised_prompt=revised_prompt,
            )

        except Exception as e:
            logger.error(f"genimg error: {e}")
            raise

    @staticmethod
    def _safe_int(value: object, default: int) -> int:
        """Best-effort convert to int, fallback to default."""
        try:
            return int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _extract_cdn_url(obj: object) -> Optional[str]:
        """
        Extract CDN URL from response object (supports multiple platform formats).
        Works for both video and audio responses.
        """
        # Try: obj.url
        url = getattr(obj, "url", None)
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            return url

        # Try: obj.videos[0].url (video format)
        videos = getattr(obj, "videos", None)
        if videos and isinstance(videos, (list, tuple)) and len(videos) > 0:
            out_url = getattr(videos[0], "url", None)
            if isinstance(out_url, str) and out_url.startswith(("http://", "https://")):
                return out_url

        # Try: obj.video_url or obj.audio_url
        for attr in ("video_url", "audio_url"):
            attr_url = getattr(obj, attr, None)
            if isinstance(attr_url, str) and attr_url.startswith(("http://", "https://")):
                return attr_url

        # Try: obj.output.url
        output = getattr(obj, "output", None)
        if output:
            out_url = getattr(output, "url", None)
            if isinstance(out_url, str) and out_url.startswith(("http://", "https://")):
                return out_url

        # Try: obj.meta_data['url']
        meta_data = getattr(obj, "meta_data", None)
        if isinstance(meta_data, dict):
            meta_url = meta_data.get("url")
            if isinstance(meta_url, str) and meta_url.startswith(("http://", "https://")):
                return meta_url

        # Try parsing JSON body from HttpxBinaryResponseContent (proxy platform returns JSON instead of binary)
        try:
            data = json.loads(getattr(obj, "content", b""))
            logger.debug(f"Parsed response JSON body: {data}")
            for key in ("url", "video_url", "audio_url"):
                val = data.get(key)
                if isinstance(val, str) and val.startswith(("http://", "https://")):
                    return val
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass

        return None

    async def genvideo(self, request: GenVideoRequest) -> GenVideoResponse:
        """
        Generate Video API.

        Flow: 1) Create task -> 2) Poll until complete -> 3) Return CDN URL.
        Note: Different models have different `seconds` param support.
        """
        try:
            client = self._require_ai_client()
            create_params: Dict[str, object] = {
                "model": request.model,
                "prompt": request.prompt,
                "size": request.size,
                "seconds": request.seconds
            }

            # Image-to-Video: use input_reference as the first frame
            if request.image:
                create_params["input_reference"] = await self._image_str_to_upload_file(
                    request.image, name_prefix="input_reference"
                )

            video = await client.videos.create(**create_params)  # type: ignore[arg-type]
            video_id = getattr(video, "id", None)
            if not video_id:
                raise RuntimeError("Video generation started but missing video id")

            logger.info(f"Video generation started: {video_id}")

            # Poll for completion
            status = getattr(video, "status", None)
            while status in ("in_progress", "queued"):
                logger.info(f"Video {video_id} progress: {getattr(video, 'progress', 0)}%")
                await asyncio.sleep(2)
                video = await client.videos.retrieve(video_id)
                status = getattr(video, "status", None)

            if status == "failed":
                error_msg = getattr(getattr(video, "error", None), "message", None) or "Video generation failed"
                raise RuntimeError(error_msg)

            # Extract CDN URL
            cdn_url = self._extract_cdn_url(video)
            if not cdn_url:
                raise RuntimeError("Video generation completed but missing CDN url")

            requested_seconds = self._safe_int(request.seconds, default=4)
            actual_duration = self._safe_int(getattr(video, "seconds", None), default=requested_seconds)

            logger.info(f"Video generated: {cdn_url}")

            return GenVideoResponse(
                url=cdn_url,
                model=request.model,
                duration=actual_duration,
                revised_prompt=getattr(video, "revised_prompt", None),
            )

        except Exception as e:
            logger.error(f"genvideo error: {e}")
            raise

    @staticmethod
    def _get_voice(model: str, gender: str, voice_style_key: Optional[str] = None) -> str:
        """Get voice based on model, gender, and optional frontend style key."""
        normalized_model = (model or "").strip()
        normalized_gender = (gender or "female").strip().lower()
        normalized_style_key = (voice_style_key or "").strip().lower()

        if normalized_style_key:
            styled_voice = VOICE_STYLE_MAP.get((normalized_model, normalized_style_key))
            if styled_voice:
                return styled_voice

        voice = VOICE_MAP.get((normalized_model, normalized_gender))
        if voice:
            return voice
        return DEFAULT_VOICE.get(normalized_gender, "alloy")

    async def genaudio(self, request: GenAudioRequest) -> GenAudioResponse:
        """Generate audio and fall back to local Windows TTS when remote TTS is unavailable."""
        _, effective_gender, _local_voice_hint, _local_rate = self._resolve_local_tts_profile(
            request.gender,
            request.voice_style_key,
        )
        voice = self._get_voice(request.model, effective_gender, request.voice_style_key)

        try:
            client = self._require_ai_client()
        except Exception as exc:
            logger.error(f"genaudio error: {exc}")
            logger.info(
                "Audio generation falling back to local TTS: model=%s, gender=%s, voice_style_key=%s",
                request.model,
                effective_gender,
                request.voice_style_key or "",
            )
            return await self._generate_local_tts_audio(
                request.text,
                effective_gender,
                request.voice_style_key,
            )

        try:
            params: Dict[str, object] = {
                "model": request.model,
                "input": request.text,
                "voice": voice,
                "response_format": "mp3",
            }

            logger.info(
                "Audio generation started: model=%s, gender=%s, voice_style_key=%s, voice=%s",
                request.model,
                effective_gender,
                request.voice_style_key or "",
                voice,
            )

            resp = await client.audio.speech.create(**params)  # type: ignore[arg-type]

            cdn_url = self._extract_cdn_url(resp)
            if not cdn_url:
                try:
                    body = getattr(resp, "content", resp)
                except Exception:
                    body = str(resp)
                logger.warning(f"Failed to extract CDN URL from audio response, body={body}")
                raise RuntimeError("Audio generation completed but missing CDN url")

            logger.info(f"Audio generated: {cdn_url}")

            return GenAudioResponse(
                url=cdn_url,
                model=request.model,
                gender=effective_gender,
                voice=voice,
            )

        except Exception as exc:
            logger.error(f"genaudio error: {exc}")
            logger.info(
                "Remote audio generation failed, retrying with local TTS: model=%s, gender=%s, voice_style_key=%s",
                request.model,
                effective_gender,
                request.voice_style_key or "",
            )
            return await self._generate_local_tts_audio(
                request.text,
                effective_gender,
                request.voice_style_key,
            )

    async def transcribe(self, request: TranscribeAudioRequest) -> TranscribeAudioResponse:
        """Transcribe audio to text using OpenAI-compatible speech transcription endpoint."""
        source_name = self._get_source_name(request.audio, fallback="input_audio")
        audio_file = await self._audio_str_to_upload_file(request.audio, name_prefix="input_audio")

        try:
            client = self._require_ai_client()
            logger.info(f"Audio transcription started: model={request.model}, source={source_name}")
            resp = await client.audio.transcriptions.create(
                file=audio_file,
                model=request.model,
                response_format="json",
            )

            text = self._extract_transcription_text(resp)
            if not text:
                raise RuntimeError("Audio transcription completed but missing text in response")

            logger.info(f"Audio transcribed: {source_name}")

            return TranscribeAudioResponse(
                text=text,
                model=request.model,
                source_name=source_name,
            )
        except Exception as e:
            logger.error(f"transcribe error: {e}")
            raise
        finally:
            audio_file.close()
