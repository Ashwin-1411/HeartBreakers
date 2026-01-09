import logging
import os
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd
from django.contrib.auth import get_user_model, logout
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.explanations.plain_language import (
    generate_chat_response,
    generate_structured_explanation,
)
from core.knowledge_layer.knowledge_engine import run_knowledge_layer
from core.knowledge_layer.ontology_loader import load_ontology
from core.profiler.data_profiler import profile_dataset

from .models import AnalysisResult
from .security import constant_time_check, hash_password, validate_password_strength

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

ALLOW_CREDENTIALS = False

FINANCE_KEYWORDS = {
    "account",
    "aml",
    "client",
    "compliance",
    "country",
    "customer",
    "fatf",
    "finance",
    "kyb",
    "kyc",
    "merchant",
    "onboard",
    "ownership",
    "pep",
    "risk",
    "sanction",
    "sector",
    "transaction",
}

MIN_FINANCE_MATCHES = 2
MIN_FINANCE_COLUMNS = 2


def _detect_finance_domain(columns: Iterable[str]) -> Tuple[bool, Dict[str, Any]]:
    matched_keywords: set[str] = set()
    matched_columns: List[str] = []
    normalized_columns = [str(column or "").strip() for column in columns]

    for name in normalized_columns:
        if not name:
            continue
        lowered = name.lower()
        for keyword in FINANCE_KEYWORDS:
            if keyword in lowered:
                matched_keywords.add(keyword)
                matched_columns.append(name)
                break

    is_finance = (
        len(matched_keywords) >= MIN_FINANCE_MATCHES
        and len(set(matched_columns)) >= MIN_FINANCE_COLUMNS
    )

    debug = {
        "matched_keywords": sorted(matched_keywords),
        "matched_columns": sorted(set(matched_columns)),
        "total_columns": len(normalized_columns),
    }

    return is_finance, debug


def _resolve_origin(request) -> Optional[str]:
    origin = request.headers.get("Origin") or request.META.get("HTTP_ORIGIN")
    if origin and origin in ALLOWED_CORS_ORIGINS:
        return origin
    if len(ALLOWED_CORS_ORIGINS) == 1:
        return next(iter(ALLOWED_CORS_ORIGINS))
    return None


def _corsify(request, response: Response) -> Response:
    origin = _resolve_origin(request)
    if origin:
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin"
    else:
        response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response["Access-Control-Max-Age"] = "86400"
    response["Access-Control-Allow-Credentials"] = "true" if origin and ALLOW_CREDENTIALS else "false"
    return response


def _build_response(request, payload: Dict[str, Any], status_code: int = status.HTTP_200_OK):
    response = Response(payload, status=status_code)
    return _corsify(request, response)


def _bad_request(request, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> Response:
    logger.warning("api_error", extra={"detail": message, "status": status_code})
    return _build_response(request, {"error": message}, status_code)


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


@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    payload = request.data or {}

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    email = (payload.get("email") or "").strip()

    if not username or not password:
        return _bad_request(request, "Username and password are required")

    if not _ensure_user_is_unique(username):
        return _bad_request(request, "Username already exists", status_code=status.HTTP_409_CONFLICT)

    validation = validate_password_strength(password)
    if not validation.is_valid:
        return _bad_request(request, validation.error or "Password does not meet complexity requirements")

    user_model = get_user_model()
    try:
        with transaction.atomic():
            user = user_model.objects.create_user(username=username, email=email, password=None)
            user.password = hash_password(password)
            user.save(update_fields=["password"])
    except IntegrityError:
        return _bad_request(request, "Username already exists", status_code=status.HTTP_409_CONFLICT)
    token, _ = Token.objects.get_or_create(user=user)

    # Returning a token here avoids any reliance on browser-managed cookies for new accounts.
    return _build_response(
        request,
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    payload = request.data or {}

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not username or not password:
        return _bad_request(request, "Username and password are required")

    user_model = get_user_model()
    user = user_model.objects.filter(username=username).first()
    password_ok = constant_time_check(password, user.password if user else None)
    if not user or not user.is_active or not password_ok:
        return _bad_request(request, "Invalid credentials", status_code=status.HTTP_401_UNAUTHORIZED)

    token, _ = Token.objects.get_or_create(user=user)

    # Tokens travel in Authorization headers so we can avoid third-party cookies on mobile browsers.
    return _build_response(
        request,
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_user(request):
    token = getattr(request, "auth", None)
    if token:
        try:
            token.delete()
        except AttributeError:
            Token.objects.filter(key=token).delete()
    logout(request)
    return _build_response(request, {"success": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def session_info(request):
    if request.user.is_authenticated:
        payload = {
            "authenticated": True,
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            },
        }
    else:
        payload = {"authenticated": False}

    return _build_response(request, payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def auth_me(request):
    return _build_response(
        request,
        {
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            }
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyze_dataset(request):
    logger.info("request_received", extra={"path": request.path, "user": request.user.id})

    csv_file = request.FILES.get("file")
    if not csv_file:
        return _bad_request(request, "CSV file must be uploaded with form field 'file'")

    try:
        df = pd.read_csv(csv_file)
    except Exception as exc:  # noqa: BLE001
        logger.exception("csv_parse_failed")
        return _bad_request(request, f"Unable to parse CSV: {exc}")

    finance_ok, finance_debug = _detect_finance_domain(df.columns)
    logger.info(
        "finance_domain_check",
        extra={"user": request.user.id, "is_finance": finance_ok, **finance_debug},
    )

    if not finance_ok:
        guidance = (
            "Uploaded CSV does not appear to contain financial compliance fields. "
            "Include columns referencing clients, accounts, sanctions, PEP, or similar controls."
        )
        return _bad_request(request, guidance)

    dataset_metadata = {"rows": len(df), "columns": len(df.columns)}
    logger.info("profiling_started", extra={"dataset": dataset_metadata, "user": request.user.id})

    profile = profile_dataset(df)
    logger.info("profiling_completed", extra={"dataset": dataset_metadata, "user": request.user.id})

    knowledge_output = run_knowledge_layer(profile)
    reasoned_stats = _clean_for_json(knowledge_output.get("reasoned_stats", []))
    overall_dqs = float(knowledge_output.get("overall_dqs", 1.0))
    dimension_scores = _clean_for_json(knowledge_output.get("dimension_scores", {}))
    matched_attributes = int(knowledge_output.get("matched_attributes", 0) or 0)
    logger.info(
        "violations_detected",
        extra={"violations": {"total": len(reasoned_stats)}, "user": request.user.id, "matched_attributes": matched_attributes},
    )

    if matched_attributes == 0:
        return _bad_request(
            request,
            "Dataset attributes do not match Finova's financial ontology. Provide a financial compliance dataset.",
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
        "finance_domain": finance_debug,
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
        "finance_domain": finance_debug,
        "matched_attributes": matched_attributes,
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

    return _build_response(request, response_payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_history(request):
    results = AnalysisResult.objects.filter(user=request.user).order_by("-created_at")
    payload = _serialize_results(results)

    return _build_response(request, {"results": payload})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def history_detail(request, pk: int):
    try:
        record = AnalysisResult.objects.get(pk=pk, user=request.user)
    except AnalysisResult.DoesNotExist:  # pragma: no cover - thin wrapper
        return _bad_request(request, "Analysis result not found", status_code=404)

    return _build_response(
        request,
        {
            "id": record.id,
            "dataset_name": record.dataset_name,
            "created_at": record.created_at.isoformat(),
            "overall_dqs": record.overall_dqs,
            "dimension_scores": record.dimension_scores,
            "reasoned_stats": record.reasoned_stats,
            "genai_summary": record.genai_summary,
            "genai_recommendations": record.genai_recommendations,
        },
    )


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trend_view(request):
    window_size = 5
    results = list(
        AnalysisResult.objects.filter(user=request.user)
        .order_by("-created_at")[:window_size]
    )
    if not results:
        return _build_response(
            request,
            {
                "overall_trend": "stable",
                "delta": 0.0,
                "dimension_trends": {},
                "timeline": [],
            },
        )

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

    return _build_response(
        request,
        {
            "overall_trend": trend,
            "delta": round(delta, 4),
            "dimension_trends": dimension_trends,
            "timeline": timeline,
        },
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    try:
        load_ontology()
        onto_status = True
    except Exception:  # noqa: BLE001
        logger.exception("ontology_health_failed")
        onto_status = False

    return _build_response(
        request,
        {
            "status": "ok",
            "ontology_loaded": onto_status,
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_agent(request):
    payload = request.data or {}

    message = payload.get("message", "")
    context = payload.get("context") or {}

    logger.info(
        "chat_request",
        extra={"message_preview": message[:60], "has_context": bool(context)},
    )

    response_text = generate_chat_response(message, context)

    return _build_response(request, {"response": response_text})