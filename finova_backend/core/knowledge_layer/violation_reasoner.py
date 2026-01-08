import logging
from typing import Dict, List

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

MANDATORY_NULL_THRESHOLD = 0.0
IDENTIFIER_DUPLICATE_THRESHOLD = 0.0
HIGH_SEVERITY_THRESHOLD = 0.2


def reason_violations(mapped_data: Dict[str, Dict]) -> List[Dict]:
    logger.debug(
        "[VIOLATION] Beginning reasoning for %d attributes",
        len(mapped_data),
    )

    results: List[Dict] = []

    for attr_name, data in mapped_data.items():
        stats = data.get("stats", {})
        roles = data.get("roles", [])
        dimensions = data.get("dimensions", [])
        impacts = data.get("impacts", [])
        logger.debug(
            "[VIOLATION] Evaluating attribute '%s' with stats %s and roles %s",
            attr_name,
            stats,
            roles,
        )

        null_rate = stats.get("null_rate")
        dup_rate = stats.get("duplicate_rate")

        rule_triggered = False

        # Mandatory completeness rule
        if null_rate is None:
            logger.warning(
                "[VIOLATION] Missing null_rate for attribute '%s'; cannot evaluate mandatory rule",
                attr_name,
            )
        elif any(role == "Mandatory" for role in roles):
            if null_rate > MANDATORY_NULL_THRESHOLD:
                severity = "High" if null_rate > HIGH_SEVERITY_THRESHOLD else "Medium"
                violation = {
                    "attribute": attr_name,
                    "issue": "mandatory_missing_values",
                    "violation_rate": null_rate,
                    "dimensions": dimensions,
                    "impacts": impacts,
                    "severity": severity,
                    "roles": roles,
                }
                results.append(violation)
                rule_triggered = True
                logger.debug(
                    "[VIOLATION] Mandatory rule triggered for '%s' (null_rate=%.4f)",
                    attr_name,
                    null_rate,
                )
            else:
                logger.debug(
                    "[VIOLATION] Mandatory rule not triggered for '%s'; null_rate %.4f <= threshold %.4f",
                    attr_name,
                    null_rate,
                    MANDATORY_NULL_THRESHOLD,
                )
        else:
            logger.debug(
                "[VIOLATION] Attribute '%s' is not Mandatory; skipping mandatory rule",
                attr_name,
            )

        # Identifier uniqueness rule
        if dup_rate is None:
            logger.warning(
                "[VIOLATION] Missing duplicate_rate for attribute '%s'; cannot evaluate identifier rule",
                attr_name,
            )
        elif any(role == "Identifier" for role in roles):
            if dup_rate > IDENTIFIER_DUPLICATE_THRESHOLD:
                severity = "High" if dup_rate > HIGH_SEVERITY_THRESHOLD else "Medium"
                violation = {
                    "attribute": attr_name,
                    "issue": "identifier_not_unique",
                    "violation_rate": dup_rate,
                    "dimensions": dimensions,
                    "impacts": impacts,
                    "severity": severity,
                    "roles": roles,
                }
                results.append(violation)
                rule_triggered = True
                logger.debug(
                    "[VIOLATION] Identifier rule triggered for '%s' (duplicate_rate=%.4f)",
                    attr_name,
                    dup_rate,
                )
            else:
                logger.debug(
                    "[VIOLATION] Identifier rule not triggered for '%s'; duplicate_rate %.4f <= threshold %.4f",
                    attr_name,
                    dup_rate,
                    IDENTIFIER_DUPLICATE_THRESHOLD,
                )
        else:
            logger.debug(
                "[VIOLATION] Attribute '%s' is not Identifier; skipping identifier rule",
                attr_name,
            )

        # Fallback completeness insight for visibility even if not mandatory
        if null_rate is not None and null_rate > 0:
            severity = "High" if null_rate > HIGH_SEVERITY_THRESHOLD else "Low"
            violation = {
                "attribute": attr_name,
                "issue": "missing_values",
                "violation_rate": null_rate,
                "dimensions": dimensions,
                "impacts": impacts,
                "severity": severity,
                "roles": roles,
            }
            results.append(violation)
            logger.debug(
                "[VIOLATION] General completeness flag for '%s' recorded",
                attr_name,
            )
            rule_triggered = True

        if not rule_triggered:
            logger.info(
                "[VIOLATION] No rules fired for attribute '%s'",
                attr_name,
            )

    if not results:
        logger.warning("[VIOLATION] No violations produced; check ontology mappings and thresholds")
    else:
        logger.debug(
            "[VIOLATION] Generated %d violation records",
            len(results),
        )

    return results