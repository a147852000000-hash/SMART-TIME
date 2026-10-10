from __future__ import annotations
from pathlib import Path


def analyze_cad(path: str) -> dict:
    """Analyze DXF with ezdxf. DWG requires an external converter because ezdxf is DXF-focused."""
    p = Path(path)
    ext = p.suffix.lower()
    if ext == ".dwg":
        raise RuntimeError("DWG is not directly parsed by ezdxf. Convert DWG to DXF with an installed ODA/Teigha converter, then pass the DXF here.")
    if ext != ".dxf": raise ValueError("Expected .dxf or .dwg")
    from ezdxf import readfile
    doc = readfile(str(p))
    msp = doc.modelspace()
    counts = {}
    layers = {}
    for entity in msp:
        t = entity.dxftype(); counts[t] = counts.get(t, 0) + 1
        layer = getattr(entity.dxf, "layer", "0"); layers[layer] = layers.get(layer, 0) + 1
    return {"file": str(p), "entities": sum(counts.values()), "entity_types": counts, "layers": layers}
