from flask import Flask, request, jsonify
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)  # autorise React (localhost:3000)

def simple_heuristic_score(text: str) -> int:
    """
    Heuristique simple (placeholder ML) :
    - pénalise certains patterns "fake"
    - bonus si texte assez long
    - clamp 0..100
    """
    t = (text or "").strip().lower()

    if len(t) == 0:
        return 0

    score = 70

    # pénalités (mots souvent associés aux fake news)
    bad_patterns = [
        r"\b(urgent|breaking|incroyable|choc|secret|révélé)\b",
        r"\b(100%|garanti|impossible)\b",
        r"\b(partage|share)\b",
    ]
    for p in bad_patterns:
        if re.search(p, t):
            score -= 10

    # bonus si texte structuré/long
    if len(t) > 120:
        score += 10
    elif len(t) < 40:
        score -= 10

    # clamp
    score = max(0, min(100, score))
    return score

@app.get("/health")
def health():
    return jsonify({"ok": True})

@app.post("/score")
def score():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    score = simple_heuristic_score(text)
    return jsonify({"score": score})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
