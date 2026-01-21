import "./App.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  connectWallet,
  getInformationsCount,
  listAllInformations,
  submitInformationFromText,
  validateInformation,
  getMyRole,
  setModerator,
  onContractEvent, // ✅ events
} from "./services/blockchain";

const ML_API_URL = "http://127.0.0.1:5000"; // adapte si besoin

export default function App() {
  const [account, setAccount] = useState("");
  const [role, setRole] = useState({ isOwner: false, isModerator: false });

  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);

  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [score, setScore] = useState(80);

  // Admin: mod management
  const [modAddress, setModAddress] = useState("");
  const [modEnabled, setModEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingValidateIndex, setLoadingValidateIndex] = useState(null);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const roleLabel = useMemo(() => {
    if (!account) return "Non connecté";
    if (role.isOwner) return "Owner";
    if (role.isModerator) return "Moderator";
    return "User";
  }, [account, role]);

  // ✅ rendre refreshAll stable (important pour les events)
  const refreshAll = useCallback(
    async ({ keepStatus = false } = {}) => {
      try {
        if (!keepStatus) {
          setError("");
          setStatus("");
        }

        const c = await getInformationsCount();
        setCount(c);

        if (c > 0) {
          const list = await listAllInformations();
          setItems(list.slice().reverse()); // plus récents en haut
        } else {
          setItems([]);
        }

        const r = await getMyRole();
        setRole({ isOwner: r.isOwner, isModerator: r.isModerator });
        setAccount(r.account || account);
      } catch (e) {
        setError(e.message || String(e));
      }
    },
    [account],
  );

  // Connexion initiale
  useEffect(() => {
    (async () => {
      try {
        const acc = await connectWallet();
        setAccount(acc);
        await refreshAll();
      } catch (e) {
        setError(e.message || String(e));
      }
    })();
  }, [refreshAll]);

  // ✅ Listener events → refresh automatique
  useEffect(() => {
    let unsubSubmitted = null;
    let unsubValidated = null;
    let unsubModUpdated = null;

    let timer = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshAll({ keepStatus: true });
      }, 250);
    };

    (async () => {
      try {
        const handlerSubmitted = () => scheduleRefresh();
        const handlerValidated = () => scheduleRefresh();
        const handlerModUpdated = () => scheduleRefresh();

        unsubSubmitted = await onContractEvent(
          "InformationSubmitted",
          handlerSubmitted,
        );
        unsubValidated = await onContractEvent(
          "InformationValidated",
          handlerValidated,
        );

        // Optionnel: si ton contrat émet ModeratorUpdated
        unsubModUpdated = await onContractEvent(
          "ModeratorUpdated",
          handlerModUpdated,
        );
      } catch (e) {
        // ABI pas à jour / event absent → on ignore
        // console.warn("Event subscribe failed:", e);
      }
    })();

    return () => {
      if (timer) clearTimeout(timer);
      (async () => {
        try {
          if (unsubSubmitted) await unsubSubmitted();
          if (unsubValidated) await unsubValidated();
          if (unsubModUpdated) await unsubModUpdated();
        } catch (_) {
          // ignore
        }
      })();
    };
  }, [refreshAll]);

  async function analyzeWithML() {
    setError("");
    setStatus("");

    if (!text.trim()) {
      setError("Veuillez saisir un texte à analyser.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Analyse ML en cours...");

      const resp = await fetch(`${ML_API_URL}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Erreur API ML (${resp.status}): ${msg}`);
      }

      const data = await resp.json();
      const s = Number(data.score);
      if (!Number.isFinite(s))
        throw new Error("Réponse ML invalide (score manquant).");

      const bounded = Math.max(0, Math.min(100, s));
      setScore(bounded);
      setStatus(`Score ML reçu: ${bounded}`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!text.trim()) return setError("Veuillez saisir un texte.");
    if (!source.trim())
      return setError("Veuillez saisir une source (URL ou nom).");

    try {
      setLoading(true);
      setStatus("Validation MetaMask en cours...");

      const res = await submitInformationFromText({
        text,
        source,
        score: Number(score),
      });

      setStatus(`Soumis. Tx: ${res.txHash}`);
      setText("");
      setSource("");
      await refreshAll({ keepStatus: true });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onValidate(index) {
    setError("");
    setStatus("");
    try {
      setLoadingValidateIndex(index);
      setStatus(`Validation de l'index ${index}...`);

      const txHash = await validateInformation(index);
      setStatus(`Validé. Tx: ${txHash}`);
      await refreshAll({ keepStatus: true });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoadingValidateIndex(null);
    }
  }

  async function onSetModerator(e) {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!modAddress.trim())
      return setError("Veuillez saisir une adresse modérateur.");

    try {
      setLoading(true);
      setStatus("Mise à jour du modérateur (MetaMask)...");

      const txHash = await setModerator(modAddress.trim(), modEnabled);
      setStatus(`Modérateur mis à jour. Tx: ${txHash}`);
      setModAddress("");
      await refreshAll({ keepStatus: true });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const canValidate = role.isOwner || role.isModerator;

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Fake News DApp</h1>
          <p className="subtitle">
            Vérification & traçabilité décentralisées (Blockchain + ML)
          </p>
        </div>

        <div className="badges">
          <div className="badge">
            <b>Account</b>
            <span>
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "—"}
            </span>
          </div>
          <div className="badge">
            <b>Rôle</b>
            <span>{roleLabel}</span>
          </div>
          <div className="badge">
            <b>Count</b>
            <span>{count}</span>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {status && <div className="alert success">{status}</div>}

      <div className="grid">
        {/* LEFT: Submit + History */}
        <div className="card">
          <div className="cardHeader">
            <h3>Soumettre une information</h3>
            <div className="row">
              {/* Refresh optionnel (events font déjà le job) */}
              <button
                className="btn"
                type="button"
                onClick={() => refreshAll()}
                disabled={loading || loadingValidateIndex !== null}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="cardBody">
            <form className="form" onSubmit={onSubmit}>
              <label className="label">
                Texte (à hasher)
                <textarea
                  className="textarea"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ex: Une nouvelle découverte scientifique..."
                />
              </label>

              <label className="label">
                Source (URL / média)
                <input
                  className="input"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex: https://example.com/article"
                />
              </label>

              <div className="split">
                <label className="label">
                  Score fiabilité (0-100)
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                  />
                </label>

                <div
                  className="row"
                  style={{ alignSelf: "end", justifyContent: "flex-end" }}
                >
                  <button
                    className="btn"
                    type="button"
                    onClick={analyzeWithML}
                    disabled={loading}
                  >
                    {loading ? "Analyse..." : "Analyser (ML)"}
                  </button>

                  <button
                    className="btn primary"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Envoi..." : "Submit"}
                  </button>
                </div>
              </div>
            </form>

            <div className="hr" />

            <div
              className="cardHeader"
              style={{ border: "none", padding: 0, background: "transparent" }}
            >
              <h3>Historique</h3>
            </div>

            <div className="cardBody" style={{ padding: "12px 0 0" }}>
              {items.length === 0 ? (
                <p className="subtitle" style={{ margin: 0 }}>
                  Aucune information soumise.
                </p>
              ) : (
                <div className="list">
                  {items.map((it) => (
                    <div className="item" key={it.index}>
                      <div className="itemTop">
                        <div style={{ fontWeight: 700 }}>Index #{it.index}</div>
                        <div className={`pill ${it.validated ? "ok" : "no"}`}>
                          {it.validated ? "Validé" : "Non validé"}
                        </div>
                      </div>

                      <div className="kv">
                        <div className="k">Score</div>
                        <div>{it.reliabilityScore}</div>

                        <div className="k">Source</div>
                        <div>{it.source}</div>

                        <div className="k">Hash</div>
                        <div>
                          <code>{it.contentHash}</code>
                        </div>

                        <div className="k">Auteur</div>
                        <div>
                          <code>{it.author}</code>
                        </div>

                        <div className="k">Date</div>
                        <div>{it.timestamp.toLocaleString()}</div>
                      </div>

                      {canValidate && (
                        <div className="row" style={{ marginTop: 8 }}>
                          <button
                            className={`btn ${it.validated ? "" : "success"}`}
                            onClick={() => onValidate(it.index)}
                            disabled={
                              it.validated ||
                              loadingValidateIndex === it.index ||
                              loading
                            }
                          >
                            {it.validated
                              ? "Déjà validé"
                              : loadingValidateIndex === it.index
                                ? "Validation..."
                                : "Valider"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Admin */}
        <div className="card">
          <div className="cardHeader">
            <h3>Administration — Modérateurs</h3>
            <span className="pill">
              {role.isOwner ? "Owner" : "Accès restreint"}
            </span>
          </div>

          <div className="cardBody">
            {role.isOwner ? (
              <form className="form" onSubmit={onSetModerator}>
                <label className="label">
                  Adresse du modérateur
                  <input
                    className="input"
                    value={modAddress}
                    onChange={(e) => setModAddress(e.target.value)}
                    placeholder="0x..."
                  />
                </label>

                <label
                  className="label"
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={modEnabled}
                    onChange={(e) => setModEnabled(e.target.checked)}
                  />
                  <span>Activer ce modérateur</span>
                </label>

                <button
                  className="btn primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "En cours..." : "Appliquer (MetaMask)"}
                </button>
              </form>
            ) : (
              <p className="subtitle" style={{ margin: 0 }}>
                Seul le Owner peut gérer les modérateurs.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
