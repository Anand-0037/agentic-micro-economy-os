from __future__ import annotations

import json
from typing import List

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate

from ..models import ActionPlan, ObservationSnapshot
from ..settings import Settings
from .llm_provider import get_llm_provider, invoke_with_provider_errors
from .prompt_registry import load_prompt


def _system_prompt(settings: Settings) -> str:
    full_text = load_prompt("P-001", settings)
    if "---" in full_text:
        parts = full_text.split("---")
        if len(parts) >= 3:
            return "---".join(parts[2:]).strip()
    return full_text.strip()


async def _run_plan_chain(
    llm,
    observation: ObservationSnapshot,
    settings: Settings,
    allowed_assets: List[str],
    allowed_protocols: List[str],
    lessons: List[str],
) -> ActionPlan:
    parser = PydanticOutputParser(pydantic_object=ActionPlan)
    system_prompt = _system_prompt(settings)
    user_prompt = (
        "Observation JSON:\n{observation_json}\n\n"
        "Lessons Learned (recent failures):\n{lessons}\n\n"
        "IMPORTANT: Check `observation_quality`. If it is low (e.g., < 0.7), prioritize 'no_op' "
        "or extremely low-risk actions due to degraded state.\n\n"
        "Provide a valid ActionPlan JSON with `idempotency_key` and `correlation_id`. "
        "Include a short `rationale` (2-4 sentences) that explains why the action is safe "
        "and compliant. If possible, set `metadata_uri` to a short rationale reference.\n\n"
        "{format_instructions}"
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("user", user_prompt),
        ]
    )
    observation_json = json.dumps(observation.model_dump(), default=str)
    invoke_input = {
        "observation_json": observation_json,
        "policy_json": json.dumps(
            {
                "allowed_assets": allowed_assets,
                "allowed_protocols": allowed_protocols,
            }
        ),
        "allowed_assets": ", ".join(allowed_assets),
        "allowed_protocols": ", ".join(allowed_protocols),
        "lessons": "\n".join(lessons) if lessons else "None",
        "format_instructions": parser.get_format_instructions(),
    }
    chain = prompt | llm | parser
    result = await chain.ainvoke(invoke_input)
    if result.rationale and not result.rationale_summary:
        result.rationale_summary = result.rationale[:280]
    return result


async def reason_action_plan(
    observation: ObservationSnapshot,
    settings: Settings,
    allowed_assets: List[str],
    allowed_protocols: List[str],
    lessons: List[str],
    *,
    cycle_id: str = "unknown",
) -> ActionPlan:
    from .llm_provider import generate_plan

    return await generate_plan(
        observation,
        settings,
        allowed_assets,
        allowed_protocols,
        lessons,
        cycle_id=cycle_id,
    )


async def reason_action_plan_single_provider(
    observation: ObservationSnapshot,
    settings: Settings,
    allowed_assets: List[str],
    allowed_protocols: List[str],
    lessons: List[str],
) -> ActionPlan:
    """Legacy single-provider path for diagnostics."""
    provider = get_llm_provider(settings)

    async def _run(llm):
        plan = await _run_plan_chain(
            llm, observation, settings, allowed_assets, allowed_protocols, lessons
        )
        plan.planner = f"{provider.provider}@{provider.model}"
        return plan

    return await invoke_with_provider_errors(provider, _run)
