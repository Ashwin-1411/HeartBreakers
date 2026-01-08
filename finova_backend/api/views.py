import json
import logging
import os
from decimal import Decimal
from importlib import import_module
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.explanations.plain_language import (
    generate_chat_response,
    generate_structured_explanation,
)
from core.knowledge_layer.knowledge_engine import run_knowledge_layer
from core.knowledge_layer.ontology_loader import load_ontology
from core.profiler.data_profiler import profile_dataset

from .models import AnalysisResult

logger = logging.getLogger(__name__)

_default_origin = os.getenv("CORS_ALLOW_ORIGIN", "")
_additional_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
ALLOWED_CORS_ORIGINS = {
    origin.strip()
    for origin in (_additional_origins.split(",") if _additional_origins else [])
    if origin.strip()
}
if _default_origin:
    ALLOWED_CORS_ORIGINS.add(_default_origin.strip())
if not ALLOWED_CORS_ORIGINS:
    ALLOWED_CORS_ORIGINS = {"http://localhost:3000"}

ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() != "false"


SessionStore = import_module(settings.SESSION_ENGINE).SessionStore


def _ensure_session_key(request) -> Optional[str]:
    session_key = getattr(request.session, "session_key", None)
    if session_key:
        return session_key
    try:
        request.session.save()
    except Exception:  # noqa: BLE001 - defensive fallback
        return None
    return getattr(request.session, "session_key", None)


def _extract_session_key(request) -> Optional[str]:
    header = request.headers.get("X-Session-Key")
    if not header:
        authorization = request.headers.get("Authorization")
        if authorization:
            parts = authorization.strip().split(" ", 1)
            if len(parts) == 2 and parts[0].lower() in {"bearer", "session"}:
                header = parts[1]
            else:
                header = authorization
    if not header:
        return None
    return header.strip() or None


def _hydrate_user_from_header(request) -> bool:
    if getattr(request, "user", None) and request.user.is_authenticated:
        return True

    session_key = _extract_session_key(request)
    if not session_key:
        return False

    session = SessionStore(session_key=session_key)
    try:
        session_data = session.load()
    except Exception:  # noqa: BLE001 - treat invalid session as unauthenticated
        return False

    user_id = session_data.get("_auth_user_id")
    if not user_id:
        return False

    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        return False

    request.session = session
    request._session = session  # type: ignore[attr-defined]
    request.user = user  # type: ignore[attr-defined]
    request._cached_user = user  # type: ignore[attr-defined]
    return True


def _require_authenticated_user(request) -> bool:
    if getattr(request, "user", None) and request.user.is_authenticated:
        return True
    return _hydrate_user_from_header(request)


def _resolve_origin(request) -> Optional[str]:
    origin = request.headers.get("Origin") or request.META.get("HTTP_ORIGIN")
    if origin and origin in ALLOWED_CORS_ORIGINS:
        return origin
    if len(ALLOWED_CORS_ORIGINS) == 1:
        return next(iter(ALLOWED_CORS_ORIGINS))
    return None


def _corsify(request, response: JsonResponse) -> JsonResponse:
    origin = _resolve_origin(request)
    if origin:
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin"
    else:
        response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRFToken, X-Session-Key"
    response["Access-Control-Max-Age"] = "86400"
    response["Access-Control-Allow-Credentials"] = "true" if origin and ALLOW_CREDENTIALS else "false"
    return response


def _options_response(request) -> JsonResponse:
    response = JsonResponse({"status": "ok"})
    return _corsify(request, response)


def _bad_request(request, message: str, status_code: int = 400) -> JsonResponse:
    logger.warning("api_error", extra={"detail": message, "status": status_code})
    response = JsonResponse({"error": message}, status=status_code)
    return _corsify(request, response)


def _unauthorized(request) -> JsonResponse:
    response = JsonResponse({"error": "Authentication required"}, status=401)
    return _corsify(request, response)


def _parse_json_body(request) -> Dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValueError("Request body must be valid JSON") from None


def _clean_for_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _clean_for_json(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean_for_json(item) for item in value]
    return value


def _serialize_results(results: Iterable[AnalysisResult]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for record in results:
        payload.append(
            {
                "id": record.id,
                "dataset_name": record.dataset_name,
                "created_at": record.created_at.isoformat(),
                "overall_dqs": record.overall_dqs,
            }
        )
    return payload


def _ensure_user_is_unique(username: str) -> bool:
    user_model = get_user_model()
    return not user_model.objects.filter(username=username).exists()


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def register_user(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _bad_request(request, str(exc))

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    email = (payload.get("email") or "").strip()

    if not username or not password:
        return _bad_request(request, "Username and password are required")

    if not _ensure_user_is_unique(username):
        return _bad_request(request, "Username already exists", status_code=409)

    user_model = get_user_model()
    user = user_model.objects.create_user(username=username, email=email, password=password)

    login(request, user)

    session_key = _ensure_session_key(request)

    response = JsonResponse(
        {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            "sessionKey": session_key,
        },
        status=201,
    )
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def login_user(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _bad_request(request, str(exc))

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return _bad_request(request, "Username and password are required")

    user = authenticate(request, username=username, password=password)
    if not user:
        return _bad_request(request, "Invalid credentials", status_code=401)

    login(request, user)
    session_key = _ensure_session_key(request)

    response = JsonResponse(
        {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            "sessionKey": session_key,
        }
    )
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def logout_user(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    _hydrate_user_from_header(request)

    if request.user.is_authenticated:
        logout(request)

    response = JsonResponse({"success": True})
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def session_info(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    _hydrate_user_from_header(request)

    csrf_token = get_token(request)
    session_key = _ensure_session_key(request)
    if request.user.is_authenticated:
        payload = {
            "authenticated": True,
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            },
            "csrfToken": csrf_token,
            "sessionKey": session_key,
        }
    else:
        payload = {"authenticated": False, "csrfToken": csrf_token, "sessionKey": session_key}

    response = JsonResponse(payload)
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def analyze_dataset(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    if not _require_authenticated_user(request):
        return _unauthorized(request)

    logger.info("request_received", extra={"path": request.path, "user": request.user.id})

    csv_file = request.FILES.get("file")
    if not csv_file:
        return _bad_request(request, "CSV file must be uploaded with form field 'file'")

    try:
        df = pd.read_csv(csv_file)
    except Exception as exc:  # noqa: BLE001
        logger.exception("csv_parse_failed")
        return _bad_request(request, f"Unable to parse CSV: {exc}")

    dataset_metadata = {"rows": len(df), "columns": len(df.columns)}
    logger.info("profiling_started", extra={"dataset": dataset_metadata, "user": request.user.id})

    profile = profile_dataset(df)
    logger.info("profiling_completed", extra={"dataset": dataset_metadata, "user": request.user.id})

    knowledge_output = run_knowledge_layer(profile)
    reasoned_stats = _clean_for_json(knowledge_output.get("reasoned_stats", []))
    overall_dqs = float(knowledge_output.get("overall_dqs", 1.0))
    dimension_scores = _clean_for_json(knowledge_output.get("dimension_scores", {}))
    logger.info(
        "violations_detected",
        extra={"violations": {"total": len(reasoned_stats)}, "user": request.user.id},
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

    response_payload: Dict[str, Any] = {
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
        response_payload["explanation"] = structured_explanation.get("summary")

    context_bundle = {
        "dataset": dataset_metadata,
        "summary": response_payload.get("summary"),
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

    dataset_name = os.path.basename(getattr(csv_file, "name", "uploaded.csv"))
    stored_summary = response_payload.get("genai_summary") or response_payload.get("summary") or ""
    stored_recommendations = response_payload.get("genai_recommendations") or []

    record = AnalysisResult.objects.create(
        user=request.user,
        dataset_name=dataset_name,
        overall_dqs=overall_dqs,
        dimension_scores=dimension_scores,
        reasoned_stats=reasoned_stats,
        genai_summary=stored_summary,
        genai_recommendations=stored_recommendations,
    )

    response_payload["analysis_id"] = record.id

    response = JsonResponse(response_payload, status=200)
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def list_history(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    if not _require_authenticated_user(request):
        return _unauthorized(request)

    results = AnalysisResult.objects.filter(user=request.user).order_by("-created_at")
    payload = _serialize_results(results)

    response = JsonResponse({"results": payload})
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def history_detail(request, pk: int):
    if request.method == "OPTIONS":
        return _options_response(request)

    if not _require_authenticated_user(request):
        return _unauthorized(request)

    try:
        record = AnalysisResult.objects.get(pk=pk, user=request.user)
    except AnalysisResult.DoesNotExist:  # pragma: no cover - thin wrapper
        return _bad_request(request, "Analysis result not found", status_code=404)

    response = JsonResponse(
        {
            "id": record.id,
            "dataset_name": record.dataset_name,
            "created_at": record.created_at.isoformat(),
            "overall_dqs": record.overall_dqs,
            "dimension_scores": record.dimension_scores,
            "reasoned_stats": record.reasoned_stats,
            "genai_summary": record.genai_summary,
            "genai_recommendations": record.genai_recommendations,
        }
    )
    return _corsify(request, response)


def _dimension_trend(series: List[Dict[str, Any]]) -> Dict[str, str]:
    if len(series) < 2:
        return {}

    latest = series[-1]
    earliest = series[0]
    trends: Dict[str, str] = {}
    tolerance = 0.005
    all_dimensions = set(earliest.keys()) | set(latest.keys())
    for dimension in all_dimensions:
        first_value = float(earliest.get(dimension, 0.0) or 0.0)
        last_value = float(latest.get(dimension, 0.0) or 0.0)
        delta = last_value - first_value
        if delta > tolerance:
            trends[dimension] = "up"
        elif delta < -tolerance:
            trends[dimension] = "down"
        else:
            trends[dimension] = "same"
    return trends


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def trend_view(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    if not _require_authenticated_user(request):
        return _unauthorized(request)

    window_size = 5
    results = list(
        AnalysisResult.objects.filter(user=request.user)
        .order_by("-created_at")[:window_size]
    )
    if not results:
        response = JsonResponse(
            {
                "overall_trend": "stable",
                "delta": 0.0,
                "dimension_trends": {},
                "timeline": [],
            }
        )
        return _corsify(request, response)

    timeline = [
        {
            "id": record.id,
            "dataset_name": record.dataset_name,
            "created_at": record.created_at.isoformat(),
            "overall_dqs": record.overall_dqs,
        }
        for record in reversed(results)
    ]

    overall_scores = [entry["overall_dqs"] for entry in timeline]
    tolerance = 0.005
    delta = overall_scores[-1] - overall_scores[0]
    if delta > tolerance:
        trend = "improving"
    elif delta < -tolerance:
        trend = "degrading"
    else:
        trend = "stable"

    dimension_series = [record.dimension_scores for record in reversed(results)]
    dimension_trends = _dimension_trend(dimension_series)

    response = JsonResponse(
        {
            "overall_trend": trend,
            "delta": round(delta, 4),
            "dimension_trends": dimension_trends,
            "timeline": timeline,
        }
    )
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def health_check(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    try:
        load_ontology()
        onto_status = True
    except Exception:  # noqa: BLE001
        logger.exception("ontology_health_failed")
        onto_status = False

    response = JsonResponse(
        {
            "status": "ok",
            "ontology_loaded": onto_status,
        }
    )
    return _corsify(request, response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def chat_agent(request):
    if request.method == "OPTIONS":
        return _options_response(request)

    try:
        payload = _parse_json_body(request)
    except ValueError as exc:
        return _bad_request(request, str(exc))

    message = payload.get("message", "")
    context = payload.get("context") or {}

    logger.info(
        "chat_request",
        extra={"message_preview": message[:60], "has_context": bool(context)},
    )

    response_text = generate_chat_response(message, context)

    response = JsonResponse({"response": response_text})
    return _corsify(request, response)