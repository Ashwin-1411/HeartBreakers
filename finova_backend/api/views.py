import json
import logging
import os

import pandas as pd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.explanations.plain_language import (
    generate_chat_response,
    generate_structured_explanation,
)
from core.knowledge_layer.knowledge_engine import run_knowledge_layer
from core.knowledge_layer.ontology_loader import load_ontology
from core.profiler.data_profiler import profile_dataset

logger = logging.getLogger(__name__)

DEFAULT_CORS_ORIGIN = os.getenv("CORS_ALLOW_ORIGIN", "*")


def _corsify(response: JsonResponse) -> JsonResponse:
    response["Access-Control-Allow-Origin"] = DEFAULT_CORS_ORIGIN
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


def _bad_request(message: str, status_code: int = 400) -> JsonResponse:
    logger.warning("api_error", extra={"detail": message, "status": status_code})
    response = JsonResponse({"error": message}, status=status_code)
    return _corsify(response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def analyze_dataset(request):
    if request.method == "OPTIONS":
        response = JsonResponse({"status": "ok"})
        return _corsify(response)

    logger.info("request_received", extra={"path": request.path})

    csv_file = request.FILES.get("file")
    if not csv_file:
        return _bad_request("CSV file must be uploaded with form field 'file'")

    try:
        df = pd.read_csv(csv_file)
    except Exception as exc:  # noqa: BLE001
        logger.exception("csv_parse_failed")
        return _bad_request(f"Unable to parse CSV: {exc}")

    dataset_metadata = {"rows": len(df), "columns": len(df.columns)}
    logger.info("profiling_started", extra={"dataset": dataset_metadata})

    profile = profile_dataset(df)
    logger.info("profiling_completed", extra={"dataset": dataset_metadata})

    knowledge_output = run_knowledge_layer(profile)
    reasoned_stats = knowledge_output.get("reasoned_stats", [])
    overall_dqs = knowledge_output.get("overall_dqs", 1.0)
    dimension_scores = knowledge_output.get("dimension_scores", {})
    logger.info(
        "violations_detected",
        extra={"violations": {"total": len(reasoned_stats)}},
    )

    explain_flag = request.GET.get("explain")
    include_explanation = bool(explain_flag and explain_flag.lower() in {"1", "true", "yes"})
    structured_explanation = None
    if include_explanation:
        structured_explanation = generate_structured_explanation(
            reasoned_stats,
            dimension_scores,
            float(overall_dqs),
        )

    response_payload = {
        "dataset": dataset_metadata,
        "reasoned_stats": reasoned_stats,
        "summary": knowledge_output.get("summary"),
        "overall_dqs": overall_dqs,
        "dimension_scores": dimension_scores,
    }

    if structured_explanation:
        response_payload["genai_summary"] = structured_explanation.get("summary")
        response_payload["genai_recommendations"] = structured_explanation.get("recommendations", [])
        safety_note = structured_explanation.get("safety_note")
        if safety_note:
            response_payload["genai_safety_note"] = safety_note
        # Preserve legacy key for existing consumers.
        response_payload["explanation"] = structured_explanation.get("summary")

    context_bundle = {
        "dataset": dataset_metadata,
        "summary": response_payload["summary"],
        "reasoned_stats": reasoned_stats,
        "profile": profile,
        "overall_dqs": overall_dqs,
        "dimension_scores": dimension_scores,
    }

    if structured_explanation:
        context_bundle["genai_summary"] = structured_explanation.get("summary")
        context_bundle["genai_recommendations"] = structured_explanation.get("recommendations", [])
        safety_note = structured_explanation.get("safety_note")
        if safety_note:
            context_bundle["genai_safety_note"] = safety_note

    response_payload["context_bundle"] = context_bundle

    response = JsonResponse(response_payload, status=200)
    return _corsify(response)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def health_check(request):
    if request.method == "OPTIONS":
        response = JsonResponse({"status": "ok"})
        return _corsify(response)

    try:
        load_ontology()
        onto_status = True
    except Exception:  # noqa: BLE001
        logger.exception("ontology_health_failed")
        onto_status = False

    response = JsonResponse({"status": "ok", "ontology_loaded": onto_status})
    return _corsify(response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def chat_agent(request):
    if request.method == "OPTIONS":
        response = JsonResponse({"status": "ok"})
        return _corsify(response)

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return _bad_request("Request body must be valid JSON")

    message = payload.get("message", "")
    context = payload.get("context") or {}

    logger.info(
        "chat_request",
        extra={"message_preview": message[:60], "has_context": bool(context)},
    )

    response_text = generate_chat_response(message, context)

    response = JsonResponse({"response": response_text})
    return _corsify(response)