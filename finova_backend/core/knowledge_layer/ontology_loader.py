import logging
import os
from owlready2 import get_ontology

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ONTOLOGY_PATH = os.path.join(BASE_DIR, "Finova.rdf")

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

def load_ontology():
    if not os.path.exists(ONTOLOGY_PATH):
        logger.error("[ONTOLOGY] Ontology file missing at %s", ONTOLOGY_PATH)
        raise FileNotFoundError(f"Ontology not found at {ONTOLOGY_PATH}")

    logger.debug("[ONTOLOGY] Loading ontology from %s", ONTOLOGY_PATH)

    try:
        onto = get_ontology(f"file://{ONTOLOGY_PATH}").load()
    except Exception:
        logger.exception("[ONTOLOGY] Failed to load ontology")
        raise

    classes = list(onto.classes())
    individuals = list(onto.individuals())

    logger.debug(
        "[ONTOLOGY] Loaded ontology base IRI: %s | classes: %d | individuals: %d",
        getattr(onto, "base_iri", "unknown"),
        len(classes),
        len(individuals),
    )

    if not classes:
        logger.warning("[ONTOLOGY] No classes discovered in ontology")
    if not individuals:
        logger.warning("[ONTOLOGY] No individuals discovered in ontology")

    return onto