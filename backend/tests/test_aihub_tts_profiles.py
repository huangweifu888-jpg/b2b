import asyncio

import pytest

from schemas.aihub import GenAudioRequest, GenAudioResponse
from services.aihub import (
    AIHubService,
    EXPERT_TTS_PROFILES,
    LEGACY_LOCAL_TTS_PROFILES,
    REMOTE_EXPERT_VOICE_POOLS,
    VOICE_STYLE_MAP,
)


def test_twelve_expert_profiles_follow_female_female_male_contract():
    expected_keys = [f"expert-{index:02d}" for index in range(1, 13)]
    expected_genders = ["female", "female", "male"] * 4

    assert list(EXPERT_TTS_PROFILES) == expected_keys
    assert [EXPERT_TTS_PROFILES[key][0] for key in expected_keys] == expected_genders


def test_twelve_local_profiles_have_independent_voice_and_rate_pairs():
    synthesis_profiles = {
        (voice_hint, rate)
        for _gender, voice_hint, rate in EXPERT_TTS_PROFILES.values()
    }

    assert len(synthesis_profiles) == 12
    assert {profile[1] for profile in EXPERT_TTS_PROFILES.values()} == {
        "Huihui",
        "Yaoyao",
        "Kangkang",
    }


def test_remote_models_map_every_expert_style_to_a_compatible_pool_voice():
    for model, gender_voice_pools in REMOTE_EXPERT_VOICE_POOLS.items():
        for style_key, (gender, _voice_hint, _rate) in EXPERT_TTS_PROFILES.items():
            mapped_voice = VOICE_STYLE_MAP[(model, style_key)]
            assert mapped_voice in gender_voice_pools[gender]
            assert AIHubService._get_voice(model, gender, style_key) == mapped_voice


def test_legacy_six_style_keys_remain_resolvable():
    assert set(LEGACY_LOCAL_TTS_PROFILES) == {
        "gentle-female",
        "bright-female",
        "standard-female",
        "calm-male",
        "deep-male",
        "standard-male",
    }

    for style_key, expected_profile in LEGACY_LOCAL_TTS_PROFILES.items():
        assert AIHubService._resolve_local_tts_profile(expected_profile[0], style_key)[1:] == expected_profile

    assert AIHubService._get_voice("qwen3-tts-flash", "female", "gentle-female") == "Cherry"
    assert AIHubService._get_voice("qwen3-tts-flash", "male", "calm-male") == "Ethan"
    assert AIHubService._get_voice("gpt-4o-mini-tts", "female", "bright-female") == "shimmer"
    assert AIHubService._get_voice("gpt-4o-mini-tts", "male", "deep-male") == "onyx"


def test_local_cache_key_is_style_scoped_for_identical_text():
    keys = {
        AIHubService._local_tts_cache_key("同一段专家朗音", gender, style_key)
        for style_key, (gender, _voice_hint, _rate) in EXPERT_TTS_PROFILES.items()
    }

    assert len(keys) == 12
    assert AIHubService._local_tts_cache_key("相同文本", "female", "EXPERT-01") == (
        AIHubService._local_tts_cache_key("相同文本", "female", "expert-01")
    )
    assert AIHubService._local_tts_cache_key("相同文本", "female", "custom-a") != (
        AIHubService._local_tts_cache_key("相同文本", "female", "custom-b")
    )


def test_windows_script_uses_style_voice_and_rate():
    female_script = AIHubService._pick_windows_voice_script("male", "expert-02")
    male_script = AIHubService._pick_windows_voice_script("female", "expert-12")

    assert "$genderName = 'Female'" in female_script
    assert "'Yaoyao'" in female_script
    assert "$voice.Rate = -3" in female_script
    assert "$genderName = 'Male'" in male_script
    assert "'Kangkang'" in male_script
    assert "$voice.Rate = 3" in male_script


def test_windows_script_hard_filters_and_reports_the_actual_voice_gender():
    male_script = AIHubService._pick_windows_voice_script("female", "expert-03")

    assert "Where-Object" in male_script
    assert "$_.GetAttribute('Gender') -eq $genderName" in male_script
    assert "score -= 1000" not in male_script
    assert "LOCAL_TTS_RESULT" in male_script
    assert "$actualGender" in male_script


def test_local_tts_helper_result_requires_an_explicit_valid_gender():
    assert AIHubService._parse_local_tts_helper_result(
        "compiler note\nLOCAL_TTS_RESULT\tMale\tMicrosoft Kangkang\n"
    ) == ("male", "Microsoft Kangkang")

    with pytest.raises(RuntimeError, match="selected voice gender"):
        AIHubService._parse_local_tts_helper_result("Microsoft Kangkang")

    with pytest.raises(RuntimeError, match="invalid voice gender"):
        AIHubService._parse_local_tts_helper_result("LOCAL_TTS_RESULT\tUnknown\tMystery voice")


def test_unconfigured_remote_service_passes_style_to_local_fallback(monkeypatch):
    service = AIHubService()
    service.client = None
    captured = {}

    async def fake_local_tts(text, gender, voice_style_key=None):
        captured.update(text=text, gender=gender, voice_style_key=voice_style_key)
        return GenAudioResponse(
            url="/api/local-dev/material-assets/local-tts-test/file",
            model="windows-local-tts",
            gender=gender,
            voice="Huihui",
        )

    monkeypatch.setattr(service, "_generate_local_tts_audio", fake_local_tts)
    response = asyncio.run(
        service.genaudio(
            GenAudioRequest(
                text="测试朗音",
                gender="female",
                voice_style_key="expert-03",
            )
        )
    )

    assert response.model == "windows-local-tts"
    assert captured == {
        "text": "测试朗音",
        "gender": "male",
        "voice_style_key": "expert-03",
    }
