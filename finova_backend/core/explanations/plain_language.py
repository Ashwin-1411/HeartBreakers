import json
import logging
import os
from string import Template
from textwrap import dedent
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

DEFAULT_SUMMARY = "No data quality issues were detected in this dataset."
DEFAULT_SAFETY_NOTE = (
    "Validate these automated insights with the responsible data owners before changing production pipelines."
)

ISSUE_DESCRIPTIONS = {
    "mandatory_missing_values": "missing required values",
    "missing_values": "missing values",
    "identifier_not_unique": "duplicate identifiers",
    "invalid_format": "values outside the expected format",
    "stale_records": "out-of-date records",
    "referential_gaps": "broken relationships",
}

DIMENSION_ACTIONS = {
    "Completeness": (
        "Tighten upstream intake validations and require key fields before loading records."
    ),
    "Uniqueness": (
        "Introduce duplicate checks or merge logic during client onboarding and integrations."
    ),
    "Integrity": (
        "Review cross-system mappings and fix reference data inconsistencies."
    ),
    "Timeliness": (
        "Accelerate refresh jobs or automate ingestion so data arrives on schedule."
    ),
    "Validity": (
        "Align format rules between source systems and apply automated validation."
    ),
}

SEVERITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}

EXPLANATION_PROMPT_TEMPLATE = Template(
        dedent(
                """
                You are Finova's data-quality advisor. Using only the findings provided, craft a concise customer-facing report.
                - Keep the tone factual and non-alarmist.
                - Never imply direct access to raw data; describe issues as automated rule results.
                - Mention typical business drivers like delayed onboarding, integration gaps, or manual processes when relevant.
                - Limit the answer to the supplied context.

                Return STRICT JSON with the shape:
                {
                    "summary": string,
                    "recommendations": [
                        {"priority": string, "dimension": string, "action": string}
                    ],
                    "safety_note": string
                }

                Context to summarise:
                Overall DQS: $overall_dqs
                Dimension Scores:
                $dimension_lines
                Findings:
                $findings_json
                Example fallback to emulate if unsure:
                $fallback_json
                """
        )
)

CHAT_PROMPT = dedent(
    """
    You are Finova's data-quality advisor. Base your reply strictly on the findings below.
    Dataset rows: {rows} | columns: {columns} | overall DQS: {overall_dqs}
    Dimension scores: {dimension_scores}
    Overall summary: {summary}
    Findings:
    {findings}
    User question: {question}

    Produce at most four sentences that:
    1. Reference the relevant dimensions, attributes, and severities.
    2. Cite typical business drivers (delayed onboarding steps, integration backlogs, manual corrections) without claiming certainty over root causes.
    3. Remind the user to validate remediation plans with data owners.
    4. Avoid discussing topics outside dataset quality.
    """
)

DATA_SCOPE_KEYWORDS = {
    "data",
    "quality",
    "score",
    "violation",
    "dimension",
    "impact",
    "dqs",
    "missing",
    "null",
    "duplicate",
    "attribute",
    "record",
    "dataset",
    "issue",
    "remediate",
    "recommendation",
    "completeness",
    "uniqueness",
    "integrity",
    "timeliness",
    "validity",
}


def _get_google_api_key() -> str:
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not configured")
    return api_key


def _should_use_genai(explicit_flag: bool | None = None) -> bool:
    if explicit_flag is not None:
        return explicit_flag

    env_flag = os.getenv("ENABLE_GENAI")
    if env_flag is not None:
        return env_flag.lower() not in {"0", "false", "no"}

    return True


def _call_google_genai(prompt: str) -> str:
    api_key = _get_google_api_key()
    model_name = os.getenv("GOOGLE_MODEL_NAME", "gemini-3-flash-preview")

    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=model_name, contents=prompt)
        text = getattr(response, "text", "")
        if text:
            return text.strip()
    except ImportError:
        genai = None  # type: ignore[assignment]
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("Failed to call Google GenAI client") from exc

    try:
        import google.generativeai as legacy_genai  # type: ignore
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("google-generativeai package not installed") from exc

    legacy_genai.configure(api_key=api_key)

    try:
        model = legacy_genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("Failed to call legacy Google Generative AI") from exc

    text = getattr(response, "text", "")
    if text:
        return text.strip()

    if hasattr(response, "candidates") and response.candidates:
        parts = []
        for cand in response.candidates:
            for part in getattr(cand, "content", []).parts:
                parts.append(getattr(part, "text", ""))
        joined = " ".join(p for p in parts if p).strip()
        if joined:
            return joined

    raise RuntimeError("Google Generative AI returned no text content")


def _rank_findings(reasoned_stats: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def sort_key(item: Dict[str, Any]) -> tuple[int, float]:
        severity = item.get("severity", "Medium")
        rate = float(item.get("violation_rate") or 0.0)
        return (SEVERITY_ORDER.get(severity, 99), -rate)

    return sorted(reasoned_stats, key=sort_key)


def _build_summary_text(
    ordered: List[Dict[str, Any]],
    dimension_scores: Dict[str, float],
    overall_dqs: float,
) -> str:
    if not ordered:
        if dimension_scores:
            dimension_details = ", ".join(
                f"{dim}={score:.2f}" for dim, score in dimension_scores.items()
            )
            suffix = f"each dimension remains strong ({dimension_details})."
        else:
            suffix = "dimension-level details were not available."
        return (
            f"Overall data quality score is {overall_dqs:.2f}. No automated rules fired; "
            f"{suffix}"
        )

    top_issue = ordered[0]
    attribute = top_issue.get("attribute", "the dataset")
    issue_key = top_issue.get("issue", "quality risk")
    issue_text = ISSUE_DESCRIPTIONS.get(issue_key, issue_key.replace("_", " "))
    severity = top_issue.get("severity", "Medium")
    rate = float(top_issue.get("violation_rate") or 0.0)
    dimensions = top_issue.get("dimensions") or []
    primary_dimension = dimensions[0] if dimensions else "Data Quality"
    rate_percent = f"{rate * 100:.1f}%" if rate else "observed"

    trailing_dimensions: List[str] = []
    if dimension_scores:
        trailing_dimensions = [
            dim for dim in dimension_scores if dim != primary_dimension
        ]

    trailing_summary = ""
    if trailing_dimensions:
        trailing_summary = ", ".join(
            f"{dim}={dimension_scores.get(dim, 1.0):.2f}" for dim in trailing_dimensions
        )
        trailing_summary = f" Other dimension scores: {trailing_summary}."

    return (
        f"Overall data quality score is {overall_dqs:.2f}. {primary_dimension} faces the highest risk "
        f"because {attribute} shows {issue_text} at approximately {rate_percent} ({severity.lower()} severity)."
        f"{trailing_summary}"
    )


def _build_recommendations(ordered: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    recommendations: List[Dict[str, str]] = []
    seen_pairs = set()

    for item in ordered:
        attribute = item.get("attribute", "This attribute")
        severity = item.get("severity", "Medium")
        dimensions = item.get("dimensions") or ["Data Quality"]
        dimension = dimensions[0]
        action_text = DIMENSION_ACTIONS.get(
            dimension,
            "Review upstream processes and coordinate remediation with the data owners.",
        )

        pair = (attribute, dimension)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        recommendations.append(
            {
                "priority": f"{severity} priority",
                "dimension": dimension,
                "action": (
                    f"{attribute}: {action_text} Typical drivers include delayed onboarding steps or manual corrections; "
                    "confirm with source system owners before remediating."
                ),
            }
        )

        if len(recommendations) == 3:
            break

    return recommendations


def _build_fallback_explanation(
    reasoned_stats: List[Dict[str, Any]],
    dimension_scores: Dict[str, float],
    overall_dqs: float,
) -> Dict[str, Any]:
    ordered = _rank_findings(reasoned_stats)
    summary_text = _build_summary_text(ordered, dimension_scores, overall_dqs)
    recommendations = _build_recommendations(ordered)

    return {
        "summary": summary_text,
        "recommendations": recommendations,
        "safety_note": DEFAULT_SAFETY_NOTE,
    }


def generate_structured_explanation(
    reasoned_stats: List[Dict[str, Any]],
    dimension_scores: Dict[str, float],
    overall_dqs: float,
    enable_genai: bool | None = None,
) -> Dict[str, Any]:
    fallback = _build_fallback_explanation(reasoned_stats, dimension_scores, overall_dqs)

    if not reasoned_stats:
        return fallback

    use_genai = _should_use_genai(enable_genai)

    if not use_genai:
        logger.info("[EXPLAIN] GenAI disabled; returning fallback explanation")
        return fallback

    ordered = _rank_findings(reasoned_stats)
    dimension_lines = "\n    ".join(
        f"- {dim}: {score:.2f}" for dim, score in dimension_scores.items()
    ) or "- No dimension scores"

    findings_payload = [
        {
            "attribute": item.get("attribute"),
            "issue": item.get("issue"),
            "severity": item.get("severity"),
            "violation_rate": item.get("violation_rate"),
            "dimensions": item.get("dimensions"),
            "impacts": item.get("impacts"),
        }
        for item in ordered
    ]

    prompt = EXPLANATION_PROMPT_TEMPLATE.substitute(
        overall_dqs=f"{overall_dqs:.2f}",
        dimension_lines=dimension_lines,
        findings_json=json.dumps(findings_payload, ensure_ascii=False, indent=2),
        fallback_json=json.dumps(fallback, ensure_ascii=False, indent=2),
    )

    try:
        response = _call_google_genai(prompt)
        parsed = json.loads(response)
        logger.info("[EXPLAIN] GenAI structured explanation generated")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[EXPLAIN] GenAI unavailable, using fallback", exc_info=exc)
        return fallback

    summary = parsed.get("summary") or fallback["summary"]
    recommendations = parsed.get("recommendations")
    if not isinstance(recommendations, list):
        recommendations = fallback["recommendations"]
    safety_note = parsed.get("safety_note") or fallback["safety_note"]

    sanitized_recs: List[Dict[str, str]] = []
    for rec in recommendations:
        if not isinstance(rec, dict):
            continue
        priority = str(rec.get("priority", "Medium priority")).strip() or "Medium priority"
        dimension = str(rec.get("dimension", "Data Quality")).strip() or "Data Quality"
        action = str(rec.get("action", "Coordinate remediation with data owners.")).strip()
        sanitized_recs.append(
            {
                "priority": priority,
                "dimension": dimension,
                "action": action,
            }
        )

    if not sanitized_recs:
        sanitized_recs = fallback["recommendations"]

    return {
        "summary": summary,
        "recommendations": sanitized_recs,
        "safety_note": safety_note,
    }


def _format_findings_multiline(reasoned_stats: List[Dict[str, Any]]) -> str:
    if not reasoned_stats:
        return "- No violations recorded"

    lines = []
    for item in reasoned_stats:
        attribute = item.get("attribute", "unknown attribute")
        issue = item.get("issue", "issue").replace("_", " ")
        severity = item.get("severity", "Unknown")
        rate = item.get("violation_rate")
        dimensions = ", ".join(item.get("dimensions") or []) or "Unspecified"
        if rate is not None:
            lines.append(
                f"- {attribute}: {issue} (severity={severity}, rate={rate:.2f}, dimensions={dimensions})"
            )
        else:
            lines.append(
                f"- {attribute}: {issue} (severity={severity}, dimensions={dimensions})"
            )

    return "\n".join(lines)


def _is_in_scope(message: str, reasoned_stats: List[Dict[str, Any]]) -> bool:
    lowered = message.lower()
    if any(keyword in lowered for keyword in DATA_SCOPE_KEYWORDS):
        return True

    for item in reasoned_stats:
        attribute = (item.get("attribute") or "").lower()
        dimensions = [dim.lower() for dim in item.get("dimensions") or []]
        if attribute and attribute in lowered:
            return True
        if any(dim in lowered for dim in dimensions):
            return True

    return False


def generate_chat_response(
    message: str,
    context: Dict[str, Any],
    enable_genai: bool | None = None,
) -> str:
    message = (message or "").strip()
    if not message:
        return "Please provide a question for the assistant."

    dataset = context.get("dataset") or {}
    summary = (
        context.get("genai_summary")
        or context.get("summary")
        or DEFAULT_SUMMARY
    )
    stats = context.get("reasoned_stats") or []
    raw_overall_dqs = context.get("overall_dqs")
    try:
        overall_dqs = f"{float(raw_overall_dqs):.2f}"
    except (TypeError, ValueError):
        overall_dqs = "unknown"
    dimension_scores = context.get("dimension_scores") or {}

    if not _is_in_scope(message, stats):
        return (
            "I can only discuss Finova's data-quality findings. Please ask about the dataset issues, scores, or remediation options."
        )

    rows = dataset.get("rows", "unknown")
    columns = dataset.get("columns", "unknown")
    findings_block = _format_findings_multiline(stats)

    use_genai = _should_use_genai(enable_genai)

    if not use_genai:
        profile = context.get("profile", {})
        attributes = profile.get("attributes", {}) if isinstance(profile, dict) else {}

        if stats:
            issues = []
            for item in _rank_findings(stats):
                attr = item.get("attribute", "attribute")
                issue = item.get("issue", "issue").replace("_", " ")
                severity = item.get("severity", "Medium")
                rate = item.get("violation_rate")
                if rate is not None:
                    issues.append(
                        f"- {attr}: {issue} (severity {severity}, rate {rate:.2f})"
                    )
                else:
                    issues.append(f"- {attr}: {issue} (severity {severity})")

            issues_text = "\n".join(issues)
            return (
                f"Overall DQS is {overall_dqs}. The dataset has {rows} rows and {columns} columns."
                " Key data quality findings were:\n"
                f"{issues_text}\n"
                "Enable GenAI (set ENABLE_GENAI=true) for conversational follow-ups."
            )

        monitored = []
        for attr_name, metrics in attributes.items():
            null_rate = metrics.get("null_rate")
            dup_rate = metrics.get("duplicate_rate")
            if null_rate is not None:
                monitored.append(f"{attr_name} null_rate={null_rate:.3f}")
            if dup_rate is not None:
                monitored.append(f"{attr_name} duplicate_rate={dup_rate:.3f}")

        monitored_text = ", ".join(monitored[:6]) + ("..." if len(monitored) > 6 else "")

        explanation = (
            "The knowledge layer checks mandatory attributes for missing values and identifier fields for duplicates. "
            "All monitored metrics met their thresholds, so no violations were produced."
        )

        if monitored_text:
            explanation += f" Recent metrics snapshot: {monitored_text}."

        return (
            f"Overall DQS is {overall_dqs}. The dataset has {rows} rows and {columns} columns and no rules were triggered. "
            f"{explanation}"
        )

    prompt = CHAT_PROMPT.format(
        rows=rows,
        columns=columns,
        overall_dqs=overall_dqs,
        dimension_scores=json.dumps(dimension_scores, ensure_ascii=False),
        summary=summary,
        findings=findings_block,
        question=message,
    )

    try:
        reply = _call_google_genai(prompt)
        logger.info("[EXPLAIN] Chat response generated")
        return reply
    except Exception as exc:  # noqa: BLE001
        logger.warning("[EXPLAIN] Chat agent unavailable, falling back", exc_info=exc)
        if stats:
            impacted = ", ".join(
                sorted({item.get("attribute", "attributes") for item in stats})
            )
            return (
                "GenAI is unavailable. Based on the findings, focus on remediation for "
                f"{impacted}."
            )
        return "GenAI is unavailable and there are no recorded issues to report."
