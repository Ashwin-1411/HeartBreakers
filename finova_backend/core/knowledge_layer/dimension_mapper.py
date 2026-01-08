import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)


def map_dimensions_and_impacts(ontology, critical_attrs):
    mapped = {}

    for attr_name, data in critical_attrs.items():
        logger.debug("[MAPPING] Processing attribute '%s'", attr_name)

        attr_entity = data.get("ontology_ref")

        if attr_entity is None:
            logger.warning(
                "[MAPPING] Missing ontology reference for attribute '%s'; skipping",
                attr_name,
            )
            continue

        dimensions = set()
        impacts = set()

        roles = getattr(attr_entity, "hasRole", [])

        if not roles:
            logger.info(
                "[MAPPING] Attribute '%s' has no roles to evaluate",
                attr_name,
            )

        for role in roles:
            role_name = getattr(role, "name", str(role))
            logger.debug(
                "[MAPPING] Attribute '%s' role '%s' under evaluation",
                attr_name,
                role_name,
            )

            triggered_dimensions = getattr(role, "triggersDimension", [])

            if not triggered_dimensions:
                logger.debug(
                    "[MAPPING] Role '%s' for attribute '%s' triggers no dimensions",
                    role_name,
                    attr_name,
                )

            for dim in triggered_dimensions:
                dim_name = getattr(dim, "name", str(dim))
                dimensions.add(dim_name)
                logger.debug(
                    "[MAPPING] Role '%s' triggers dimension '%s'",
                    role_name,
                    dim_name,
                )

                affected_impacts = getattr(dim, "affectsImpact", [])

                if not affected_impacts:
                    logger.debug(
                        "[MAPPING] Dimension '%s' has no impacts",
                        dim_name,
                    )

                for impact in affected_impacts:
                    impact_name = getattr(impact, "name", str(impact))
                    impacts.add(impact_name)
                    logger.debug(
                        "[MAPPING] Dimension '%s' affects impact '%s'",
                        dim_name,
                        impact_name,
                    )

        trimmed_data = {k: v for k, v in data.items() if k != "ontology_ref"}

        mapped[attr_name] = {
            **trimmed_data,
            "dimensions": sorted(dimensions),
            "impacts": sorted(impacts),
        }

        logger.debug(
            "[MAPPING] Attribute '%s' mapped to dimensions %s and impacts %s",
            attr_name,
            mapped[attr_name]["dimensions"],
            mapped[attr_name]["impacts"],
        )

        if not mapped[attr_name]["dimensions"]:
            logger.info(
                "[MAPPING] Attribute '%s' produced no dimensions",
                attr_name,
            )

    if not mapped:
        logger.warning("[MAPPING] No attributes were mapped to dimensions or impacts")

    return mapped