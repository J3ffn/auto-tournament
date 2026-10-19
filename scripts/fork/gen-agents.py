#!/usr/bin/env python3
"""Regenerate api/src/integrations/cs2/skins/agents.json (fork: free-mode agents).

Source: ByMykel/CSGO-API public/api/en/agents.json. Run from the repo root:
    python3 scripts/fork/gen-agents.py
"""
import json
import urllib.request

URL = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/agents.json"
OUT = "api/src/integrations/cs2/skins/agents.json"
GRADES = {"Master": 0, "Superior": 1, "Exceptional": 2, "Distinguished": 3}

import os
src = os.environ.get("AGENTS_SRC")
with (open(src) if src else urllib.request.urlopen(URL, timeout=30)) as resp:
    data = json.load(resp)

rows = []
for a in data:
    model = a.get("model_player") or ""
    if not model.startswith("agents/models/"):
        continue
    rows.append({
        "team": 2 if a["team"]["id"] == "terrorists" else 3,
        "name": a["name"],
        "model": model,
        "image": a["image"],
        "color": a["rarity"]["color"],
        "_grade": GRADES.get(a["rarity"]["name"], 9),
    })
rows.sort(key=lambda r: (r["team"], r["_grade"], r["name"]))
for r in rows:
    del r["_grade"]
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"{len(rows)} agents -> {OUT}")
