import { useEffect, useMemo, useState } from "react";

const API_BASE = "/api/shortages";

function Spinner() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "2px solid #cbd5e1",
          borderTopColor: "#0f766e",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span>Loading...</span>
    </div>
  );
}

function formatMaturityDiff(value) {
  if (value == null) {
    return "Maturity difference unavailable";
  }
  if (value === 0) {
    return "Same maturity timing";
  }
  return value > 0 ? `+${value} days later` : `${value} days earlier`;
}

function formatYieldDiff(value) {
  if (value == null) {
    return "Yield difference unavailable";
  }
  if (value === 0) {
    return "Same yield potential";
  }
  return value > 0
    ? `+${value.toFixed(2)} t/ha higher`
    : `${value.toFixed(2)} t/ha lower`;
}

function ShortagesSuggestions() {
  const [seeds, setSeeds] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState("");

  const [fertSeedId, setFertSeedId] = useState("");
  const [shortageFertId, setShortageFertId] = useState("");
  const [fertResult, setFertResult] = useState(null);
  const [fertLoading, setFertLoading] = useState(false);
  const [fertError, setFertError] = useState("");

  const [seedShortageId, setSeedShortageId] = useState("");
  const [seedResult, setSeedResult] = useState(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState("");

  const tier1Fertilizers = useMemo(
    () => fertilizers.filter((fertilizer) => fertilizer.tier === 1),
    [fertilizers],
  );

  useEffect(() => {
    let active = true;

    async function loadReferenceData() {
      setInitialLoading(true);
      setInitialError("");

      try {
        const [seedsRes, fertilizersRes] = await Promise.all([
          fetch(`${API_BASE}/seeds`),
          fetch(`${API_BASE}/fertilizers`),
        ]);

        if (!seedsRes.ok) {
          throw new Error("Failed to load seeds list.");
        }
        if (!fertilizersRes.ok) {
          throw new Error("Failed to load fertilizers list.");
        }

        const [seedsJson, fertilizersJson] = await Promise.all([
          seedsRes.json(),
          fertilizersRes.json(),
        ]);

        if (!active) {
          return;
        }

        setSeeds(Array.isArray(seedsJson) ? seedsJson : []);
        setFertilizers(Array.isArray(fertilizersJson) ? fertilizersJson : []);
      } catch (error) {
        if (active) {
          setInitialError(
            error.message || "Failed to load shortages reference data.",
          );
        }
      } finally {
        if (active) {
          setInitialLoading(false);
        }
      }
    }

    loadReferenceData();

    return () => {
      active = false;
    };
  }, []);

  async function handleFertilizerResolve() {
    setFertError("");
    setFertResult(null);

    if (!fertSeedId || !shortageFertId) {
      setFertError("Please select both the seed and the shortage fertilizer.");
      return;
    }

    setFertLoading(true);
    try {
      const res = await fetch(`${API_BASE}/fertilizer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedId: fertSeedId,
          shortageFertId,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Failed to resolve fertilizer shortage.",
        );
      }

      setFertResult(payload);
    } catch (error) {
      setFertError(error.message || "Failed to resolve fertilizer shortage.");
    } finally {
      setFertLoading(false);
    }
  }

  async function handleSeedResolve() {
    setSeedError("");
    setSeedResult(null);

    if (!seedShortageId) {
      setSeedError("Please select a seed shortage item first.");
      return;
    }

    setSeedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedId: seedShortageId }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            "Failed to resolve seed shortage.",
        );
      }

      setSeedResult(payload);
    } catch (error) {
      setSeedError(error.message || "Failed to resolve seed shortage.");
    } finally {
      setSeedLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h1 style={{ marginBottom: 8 }}>Shortages & Suggestions</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Get practical substitute recommendations for fertilizer and seed
        shortages.
      </p>

      {initialLoading && <Spinner />}
      {initialError && (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 8,
            marginTop: 12,
          }}
        >
          {initialError}
        </div>
      )}

      {!initialLoading && !initialError && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            marginTop: 20,
          }}
        >
          <section
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              background: "#f8fafc",
            }}
          >
            <h2 style={{ marginTop: 0 }}>A. Fertilizer Shortage</h2>

            <label style={{ display: "block", marginBottom: 10 }}>
              Seed Being Grown
              <select
                value={fertSeedId}
                onChange={(event) => setFertSeedId(event.target.value)}
                style={{ width: "100%", marginTop: 6, padding: 8 }}
              >
                <option value="">Select a seed...</option>
                {seeds.map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.name} ({seed.category}, {seed.environment})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 12 }}>
              Fertilizer In Shortage (Tier 1)
              <select
                value={shortageFertId}
                onChange={(event) => setShortageFertId(event.target.value)}
                style={{ width: "100%", marginTop: 6, padding: 8 }}
              >
                <option value="">Select a fertilizer...</option>
                {tier1Fertilizers.map((fertilizer) => (
                  <option key={fertilizer.id} value={fertilizer.id}>
                    {fertilizer.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={handleFertilizerResolve}
              disabled={fertLoading}
              style={{ padding: "8px 14px", cursor: "pointer" }}
            >
              Find Substitute
            </button>
            {fertLoading && (
              <div style={{ marginTop: 10 }}>
                <Spinner />
              </div>
            )}
            {fertError && <p style={{ color: "#b91c1c" }}>{fertError}</p>}

            {fertResult && (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: 12,
                  background: "#fff",
                }}
              >
                {fertResult.status === "unresolvable" ? (
                  <div style={{ color: "#b91c1c" }}>{fertResult.message}</div>
                ) : (
                  <>
                    <p>
                      <strong>Shortage:</strong> {fertResult.shortage?.name}
                    </p>
                    <p>
                      <strong>Suggested:</strong> {fertResult.suggestion?.name}
                    </p>
                    <p>
                      <strong>Rank on seed:</strong>{" "}
                      {fertResult.suggestion?.rank_on_seed ??
                        "N/A (Tier 2 fallback)"}
                    </p>
                    <p>
                      <strong>Why it works:</strong>{" "}
                      {fertResult.suggestion?.reason}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background:
                          fertResult.status === "resolved"
                            ? "#dcfce7"
                            : "#ffedd5",
                        color:
                          fertResult.status === "resolved"
                            ? "#166534"
                            : "#9a3412",
                      }}
                    >
                      {fertResult.status === "resolved"
                        ? "Best Alternative"
                        : "Last Resort"}
                    </span>
                    <p style={{ marginTop: 10 }}>{fertResult.message}</p>
                  </>
                )}
              </div>
            )}
          </section>

          <section
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              background: "#f8fafc",
            }}
          >
            <h2 style={{ marginTop: 0 }}>B. Seed Shortage</h2>

            <label style={{ display: "block", marginBottom: 12 }}>
              Seed In Shortage
              <select
                value={seedShortageId}
                onChange={(event) => setSeedShortageId(event.target.value)}
                style={{ width: "100%", marginTop: 6, padding: 8 }}
              >
                <option value="">Select a seed...</option>
                {seeds.map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.name} ({seed.category}, {seed.environment})
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={handleSeedResolve}
              disabled={seedLoading}
              style={{ padding: "8px 14px", cursor: "pointer" }}
            >
              Find Substitute
            </button>
            {seedLoading && (
              <div style={{ marginTop: 10 }}>
                <Spinner />
              </div>
            )}
            {seedError && <p style={{ color: "#b91c1c" }}>{seedError}</p>}

            {seedResult && seedResult.status === "unresolvable" && (
              <div style={{ marginTop: 12, color: "#b91c1c" }}>
                {seedResult.message}
              </div>
            )}

            {seedResult && seedResult.status === "resolved" && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {seedResult.substitutes.map((substitute) => (
                  <div
                    key={substitute.id}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <h3 style={{ margin: "0 0 6px" }}>{substitute.name}</h3>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Category:</strong> {substitute.category} |{" "}
                      <strong>Environment:</strong> {substitute.environment}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Maturity:</strong>{" "}
                      {formatMaturityDiff(substitute.maturity_diff_days)}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Yield:</strong>{" "}
                      {formatYieldDiff(substitute.yield_diff_tha)}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Top 3 Fertilizers:</strong>{" "}
                      {(substitute.top_3_fertilizers || []).join(", ")}
                    </p>

                    {substitute.fertilizer_shift?.has_shift && (
                      <div
                        style={{
                          marginTop: 8,
                          background: "#fef3c7",
                          color: "#92400e",
                          borderRadius: 8,
                          padding: 8,
                        }}
                      >
                        <strong>Warning:</strong>{" "}
                        {substitute.fertilizer_shift.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default ShortagesSuggestions;
