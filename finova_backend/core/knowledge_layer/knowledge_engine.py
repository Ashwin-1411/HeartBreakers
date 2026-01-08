import logging
from pprint import pformat

from .ontology_loader import load_ontology
from .critical_identifier import identify_critical_attributes
from .dimension_mapper import map_dimensions_and_impacts
from .violation_reasoner import reason_violations
from .dqs_calculator import compute_overall_dqs

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)


def _summarize_profile(profile):
    attributes = profile.get("attributes", {})
    summary_lines = []
    for name, stats in attributes.items():
        summary_lines.append(
            f"- {name}: null_rate={stats.get('null_rate')}, duplicate_rate={stats.get('duplicate_rate')}, data_type={stats.get('data_type')}"
        )
    return "\n".join(summary_lines)


def _strip_internal_refs(critical_attrs):
    sanitized = {}
    for attr_name, data in critical_attrs.items():
        sanitized[attr_name] = {
            "roles": data.get("roles", []),
            "stats": data.get("stats", {}),
        }
    return sanitized


def run_knowledge_layer(profile):
    logger.debug("[ENGINE] Running knowledge layer")
    logger.debug(
        "[ENGINE] Profile received with %d attributes",
        len(profile.get("attributes", {})),
    )
    logger.debug(
        "[ENGINE] Attribute stats:\n%s",
        _summarize_profile(profile) or "<no attributes>",
    )

    ontology = load_ontology()
    logger.debug(
        "[ENGINE] Ontology loaded with base IRI %s",
        getattr(ontology, "base_iri", "<unknown>"),
    )

    critical_attrs = identify_critical_attributes(ontology, profile)
    logger.debug(
        "[ENGINE] Critical attribute summary:\n%s",
        pformat(_strip_internal_refs(critical_attrs)) if critical_attrs else "<none>",
    )

    mapped = map_dimensions_and_impacts(ontology, critical_attrs)
    logger.debug(
        "[ENGINE] Dimension mapping result:\n%s",
        pformat(mapped) if mapped else "<none>",
    )

    violations = reason_violations(mapped)
    logger.debug(
        "[ENGINE] Violations produced:\n%s",
        pformat(violations) if violations else "<none>",
    )

    overall_dqs, dimension_scores = compute_overall_dqs(violations)
    logger.debug(
        "[ENGINE] DQS computed: overall=%s, dimensions=%s",
        overall_dqs,
        dimension_scores,
    )

    summary = (
        "No violations detected; dataset passes current knowledge-layer rules."
        if not violations
        else "Violations detected; inspect reasoned_stats for details."
    )

    logger.debug("[ENGINE] Summary outcome: %s", summary)

    return {
        "reasoned_stats": violations,
        "summary": summary,
        "overall_dqs": overall_dqs,
        "dimension_scores": dimension_scores,
    }