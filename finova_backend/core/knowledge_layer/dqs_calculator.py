from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

DIMENSION_WEIGHTS: Dict[str, float] = {
    "Completeness": 0.35,
    "Uniqueness": 0.25,
    "Integrity": 0.15,
    "Timeliness": 0.15,
    "Validity": 0.10,
}

SEVERITY_ORDER: Tuple[str, ...] = ("High", "Medium", "Low")


def _collect_max_violation_by_dimension(reasoned_stats: Iterable[Dict]) -> Dict[str, float]:
    max_rates: Dict[str, float] = {dimension: 0.0 for dimension in DIMENSION_WEIGHTS}

    for record in reasoned_stats:
        rate = float(record.get("violation_rate", 0.0) or 0.0)
        for dimension in record.get("dimensions", []) or []:
            if dimension in max_rates:
                max_rates[dimension] = max(max_rates[dimension], rate)

    return max_rates


def compute_dimension_scores(reasoned_stats: List[Dict]) -> Dict[str, float]:
    """Return per-dimension data quality scores scaled 0-1."""
    max_rates = _collect_max_violation_by_dimension(reasoned_stats)
    scores: Dict[str, float] = {}

    for dimension, weight in DIMENSION_WEIGHTS.items():  # weight unused but enforces ordering
        max_rate = max_rates.get(dimension, 0.0)
        score = max(0.0, min(1.0, 1.0 - max_rate))
        scores[dimension] = round(score, 2)

    return scores


def compute_overall_dqs(reasoned_stats: List[Dict]) -> Tuple[float, Dict[str, float]]:
    """Return overall DQS (rounded to 2 decimals) and per-dimension scores."""
    dimension_scores = compute_dimension_scores(reasoned_stats)
    overall = 0.0

    for dimension, weight in DIMENSION_WEIGHTS.items():
        overall += dimension_scores.get(dimension, 1.0) * weight

    return round(overall, 2), dimension_scores
