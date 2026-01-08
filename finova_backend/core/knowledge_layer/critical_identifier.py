import logging
from typing import Dict, Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)


def _build_search_attempts(attribute: str) -> List[Dict[str, str]]:
    """Create a list of ontology search patterns for a given attribute."""
    normalized_variants = {
        attribute,
        attribute.strip(),
        attribute.replace(" ", "_"),
        attribute.lower(),
        attribute.lower().replace(" ", "_"),
    }

    attempts: List[Dict[str, str]] = []
    seen: set = set()

    for variant in normalized_variants:
        if not variant:
            continue

        for pattern in (f"*#{variant}", f"*{variant}"):
            attempt = ("iri", pattern)
            if attempt not in seen:
                attempts.append({"iri": pattern})
                seen.add(attempt)

        label_attempt = ("label", variant)
        if label_attempt not in seen:
            attempts.append({"label": variant})
            seen.add(label_attempt)

    return attempts


def _resolve_attribute_entity(ontology, attribute: str) -> Tuple[Optional[object], Optional[Dict[str, str]], List[Dict[str, str]]]:
    attempts = _build_search_attempts(attribute)

    for attempt in attempts:
        try:
            entity = ontology.search_one(**attempt)
        except Exception:
            logger.exception("[CRITICAL] search_one failed for attribute '%s' using %s", attribute, attempt)
            continue

        if entity is not None:
            return entity, attempt, attempts

    return None, None, attempts


def _extract_roles(entity: object) -> List[str]:
    try:
        raw_roles: Iterable = getattr(entity, "hasRole", [])
    except Exception:
        logger.exception("[CRITICAL] Unable to access roles for entity %s", getattr(entity, "iri", entity))
        return []

    return [getattr(role, "name", str(role)) for role in raw_roles]


def identify_critical_attributes(ontology, profile):
    critical = {}

    for attr_name, stats in profile.get("attributes", {}).items():
        logger.debug("[CRITICAL] Processing attribute '%s'", attr_name)

        entity, successful_attempt, attempts = _resolve_attribute_entity(ontology, attr_name)

        if entity is None:
            attempt_summaries = ", ".join(str(a) for a in attempts) or "<none>"
            logger.warning(
                "[CRITICAL] Attribute '%s' not found in ontology; tried: %s",
                attr_name,
                attempt_summaries,
            )
            continue

        logger.debug(
            "[CRITICAL] Matched attribute '%s' to ontology entity '%s' via %s",
            attr_name,
            getattr(entity, "iri", getattr(entity, "name", "<unnamed>")),
            successful_attempt,
        )

        roles = _extract_roles(entity)

        if not roles:
            logger.info(
                "[CRITICAL] Attribute '%s' has no roles and will be skipped",
                attr_name,
            )
            continue

        logger.debug(
            "[CRITICAL] Attribute '%s' roles detected: %s",
            attr_name,
            roles,
        )

        if any(role in ["Mandatory", "Identifier", "Reference"] for role in roles):
            critical[attr_name] = {
                "roles": roles,
                "stats": stats,
                "ontology_ref": entity,
            }
            logger.debug(
                "[CRITICAL] Attribute '%s' marked critical with stats %s",
                attr_name,
                stats,
            )
        else:
            logger.info(
                "[CRITICAL] Attribute '%s' roles %s do not meet critical criteria",
                attr_name,
                roles,
            )

    if not critical:
        logger.warning("[CRITICAL] No critical attributes detected in profile")

    return critical