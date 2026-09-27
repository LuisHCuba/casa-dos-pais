"""Normaliza data/raw-extract.json (export HomeByMe) em data/house.json.
- desloca a origem para o canto mínimo da planta (mm)
- calcula o polígono de cada cômodo (polygonize de paredes + separadores)
Uso: python3 scripts/build_model.py
"""
import json, math
from pathlib import Path
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / "data/raw-extract.json").read_text())

segs = [(w["id"], w["a"], w["b"]) for w in raw["walls"]] + \
       [(s["id"], s["a"], s["b"]) for s in raw["separators"]]
xs = [p[0] for _, a, b in segs for p in (a, b)]
ys = [p[1] for _, a, b in segs for p in (a, b)]
ox, oy = min(xs), min(ys)
sh = lambda p: [p[0] - ox, p[1] - oy]

lines = [LineString([a, b]) for _, a, b in segs]
faces = list(polygonize(unary_union(lines)))

def edges_on(face):
    ids = set()
    ring = face.exterior.buffer(5)
    for sid, a, b in segs:
        if ring.contains(LineString([a, b])):
            ids.add(sid)
    return ids

face_edges = [(f, edges_on(f)) for f in faces]
rooms = []
for r in raw["rooms"]:
    bset = {b["id"] for b in r["boundary"]}
    best = max(face_edges, key=lambda fe: len(fe[1] & bset) / len(fe[1] | bset))
    poly = best[0].simplify(1)
    coords = [sh([round(x), round(y)]) for x, y in list(poly.exterior.coords)[:-1]]
    r2 = dict(r)
    r2["polygon"] = coords
    r2["areaCenterline"] = round(poly.area / 1e6, 2)
    rooms.append(r2)
    print(f'{r["label"]:8} areaFloor={r["areaFloor"]:6} centerline={r2["areaCenterline"]:6} pts={len(coords)}')

def shift_item(it):
    it = dict(it); it["pos"] = sh(it["pos"][:2]) + [it["pos"][2]]; return it

out = {
    "source": raw["source"] | {"originOffsetMM": [ox, oy], "coords": "mm; x = leste(direita) na planta, y = HomeByMe y - offset, z = altura"},
    "level": raw["level"],
    "walls": [w | {"a": sh(w["a"]), "b": sh(w["b"])} for w in raw["walls"]],
    "separators": [s | {"a": sh(s["a"]), "b": sh(s["b"])} for s in raw["separators"]],
    "rooms": rooms,
    "openings": [shift_item(o) for o in raw["openings"]],
    "furniture": [shift_item(f) for f in raw["furniture"]],
}
(ROOT / "data/house.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print("ok ->", ROOT / "data/house.json", "offset", ox, oy)
