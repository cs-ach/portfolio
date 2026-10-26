"use client";

import { useId, useState } from "react";
import styles from "./Vault.module.css";

/* The zero-trust vault, rebuilt in HTML as a model a reader can operate.
   Nothing here is cryptography: there is no WebCrypto call, no network, no
   storage, and no value on screen is a secret. It is the shape of the real
   system: key material derived in the browser, a threshold deciding what
   each request must prove, and a server that only ever holds ciphertext and
   public keys, made available to a visitor who has never seen it before.
   A real interface fragment, so its root carries data-ui. */

type Action = {
  id: string;
  label: string;
  risk: string;
  /* the trust score this request must clear; null means no score grants it */
  threshold: number | null;
};

const ACTIONS: Action[] = [
  { id: "list", label: "List a folder", risk: "low", threshold: 20 },
  { id: "read", label: "Read a file", risk: "medium", threshold: 40 },
  { id: "share", label: "Share a file", risk: "high", threshold: 60 },
  { id: "delete", label: "Delete the account", risk: "severe", threshold: 85 },
  { id: "export", label: "Export the private keys", risk: "impossible", threshold: null },
];

/* The five stages of derivation, each revealed as the passphrase grows, so the
   chain is something the visitor builds rather than reads. */
const STAGES: { at: number; name: string; note: string }[] = [
  { at: 1, name: "Salt", note: "public, fetched from the server" },
  { at: 2, name: "PBKDF2", note: "200,000 iterations · SHA-256" },
  { at: 3, name: "Derived key", note: "256-bit · in memory only" },
  { at: 4, name: "RSA-OAEP keypair", note: "encrypt / decrypt" },
  { at: 4, name: "RSA-PSS keypair", note: "sign / verify, a separate pair" },
];

const START_TRUST = 40;
const START_BLOBS = 3;

type Entry = { id: number; verdict: "allowed" | "refused" | "note"; line: string };

export default function Vault() {
  const passId = useId();
  const [pass, setPass] = useState("");
  const [trust, setTrust] = useState(START_TRUST);
  const [stepUp, setStepUp] = useState(false);
  const [blobs, setBlobs] = useState(START_BLOBS);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [serverLog, setServerLog] = useState<string[]>([]);
  const [seq, setSeq] = useState(0);
  const [wiped, setWiped] = useState(false);

  const typed = pass.trim().length;
  const unlocked = typed >= 4;

  function record(verdict: Entry["verdict"], line: string, server?: string) {
    setSeq((n) => n + 1);
    setEntries((prev) => [{ id: seq, verdict, line }, ...prev].slice(0, 4));
    if (server) setServerLog((prev) => [server, ...prev].slice(0, 5));
  }

  function attempt(a: Action) {
    /* No score grants key export: there is nothing on the server to return and
       the browser will not emit what it derived. */
    if (a.threshold === null) {
      record(
        "refused",
        "Export the private keys was refused. No trust score grants this: the server has no copy to return, and the browser does not emit the keys it derived.",
        "no request made",
      );
      return;
    }

    /* A step-up in flight does not queue sensitive work. The request dies here
       and must be made again, deliberately, after the challenge. */
    if (stepUp && a.threshold >= 40) {
      record(
        "refused",
        `${a.label} was refused while a step-up is pending. It is not queued: satisfy the challenge, then ask again.`,
        `POST /${a.id} → 403 step_up_pending`,
      );
      return;
    }

    if (trust < a.threshold) {
      setStepUp(true);
      record(
        "refused",
        `${a.label} was refused. Trust is ${trust}, this request needs ${a.threshold}. A step-up challenge is now pending.`,
        `POST /${a.id} → 403 step_up_required`,
      );
      return;
    }

    if (a.id === "list") {
      record(
        "allowed",
        `List a folder was allowed at trust ${trust}. The index comes back encrypted; the file names are decrypted here.`,
        "GET /index → encrypted index returned",
      );
    } else if (a.id === "read") {
      record(
        "allowed",
        `Read a file was allowed at trust ${trust}. The server returns a ciphertext blob and the RSA-OAEP private key in this browser opens it.`,
        "GET /blob_02 → ciphertext returned",
      );
    } else if (a.id === "share") {
      setBlobs((n) => n + 1);
      record(
        "allowed",
        `Share a file was allowed at trust ${trust}. The file key is re-wrapped to the recipient's public key here, then signed with RSA-PSS. The server stores the result without reading it.`,
        `PUT /blob_0${blobs + 1} ← ciphertext stored`,
      );
    } else if (a.id === "delete") {
      setBlobs(0);
      setWiped(true);
      record(
        "allowed",
        `Delete the account was allowed at trust ${trust}. Every blob is gone. Nothing was recoverable anyway: the server never held the key.`,
        "DELETE /vault → all ciphertext destroyed",
      );
    }
  }

  function challenge() {
    setStepUp(false);
    setTrust((t) => Math.min(100, t + 40));
    record(
      "note",
      `TOTP challenge satisfied. Trust rises to ${Math.min(100, trust + 40)}. Try the request that was refused.`,
      "POST /step-up → 204 trust re-scored",
    );
  }

  function confirmDevice() {
    setTrust((t) => Math.min(100, t + 20));
    record("note", `Device confirmed. Trust rises to ${Math.min(100, trust + 20)}.`);
  }

  function decay() {
    setTrust((t) => Math.max(0, t - 30));
    record(
      "note",
      `Session aged. Trust falls to ${Math.max(0, trust - 30)}. Actions that were allowed a moment ago are not any more.`,
    );
  }

  function reset() {
    setPass("");
    setTrust(START_TRUST);
    setStepUp(false);
    setBlobs(START_BLOBS);
    setEntries([]);
    setServerLog([]);
    setWiped(false);
  }

  const latest = entries[0];

  return (
    <div className={styles.fig} data-ui>
      <div className={styles.bar}>
        <span className={styles.name}>Vault</span>
        <span className={styles.meta}>a working model · no real cryptography</span>
      </div>

      {/* ── 1. derivation ───────────────────────────────────── */}

      <section className={styles.block} aria-labelledby={`${passId}-h`}>
        <h3 className={styles.h} id={`${passId}-h`}>
          1 · Type a passphrase
        </h3>
        <p className={styles.lede}>
          Anything at all. It is not stored or sent anywhere. Watch what the
          browser builds from it, and watch the other column stay empty.
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={passId}>
            Passphrase (four characters or more)
          </label>
          <input
            id={passId}
            className={styles.input}
            type="text"
            value={pass}
            autoComplete="off"
            spellCheck={false}
            placeholder="type here"
            onChange={(e) => setPass(e.target.value)}
          />
        </div>

        <div className={styles.split}>
          <div className={styles.col}>
            <p className={styles.colHead}>In this browser</p>
            <ul className={styles.stages}>
              {STAGES.map((s) => {
                const on = typed >= s.at;
                return (
                  <li key={s.name} className={on ? styles.stageOn : styles.stage}>
                    <span className={styles.stageName}>{s.name}</span>
                    <span className={styles.stageNote}>
                      {on ? s.note : "not derived yet"}
                    </span>
                    {on && s.at >= 3 ? (
                      <span className={styles.mask} aria-hidden="true">
                        •••• •••• •••• ••••
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.col}>
            <p className={styles.colHead}>Sent to the server</p>
            <div className={styles.empty}>
              <p className={styles.emptyLine}>
                {unlocked
                  ? "Still nothing. Deriving the keys took no network at all."
                  : "Nothing. Not the passphrase, not a hash of it, not the key."}
              </p>
            </div>
            <p className={styles.aside}>
              Which is also why a forgotten passphrase is unrecoverable here.
              There is no one else to ask.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. trust ────────────────────────────────────────── */}

      <section className={styles.block} aria-labelledby={`${passId}-t`}>
        <h3 className={styles.h} id={`${passId}-t`}>
          2 · Move the trust score
        </h3>
        <p className={styles.lede}>
          Trust is a number, not a yes or no. Every request is scored against a
          threshold of its own, so the same action flips as this number moves.
        </p>

        <p className={styles.score}>
          <span className={styles.scoreNum}>{trust}</span>
          <span className={styles.scoreOf}>/ 100</span>
          {stepUp ? <span className={styles.chipWarn}>step-up pending</span> : null}
        </p>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ width: `${trust}%` }} />
        </div>

        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={challenge} disabled={!unlocked}>
            {stepUp ? "Satisfy the step-up (TOTP)" : "Pass a TOTP challenge"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={confirmDevice} disabled={!unlocked}>
            Confirm this device
          </button>
          <button type="button" className={styles.btnGhost} onClick={decay} disabled={!unlocked}>
            Let the session age
          </button>
        </div>
      </section>

      {/* ── 3. actions ──────────────────────────────────────── */}

      <section className={styles.block} aria-labelledby={`${passId}-a`}>
        <h3 className={styles.h} id={`${passId}-a`}>
          3 · Attempt something
        </h3>
        <p className={styles.lede}>
          {!unlocked
            ? "Derive the keys first. Type a passphrase above."
            : wiped
              ? "The account is gone. Reset the demo at the bottom to start again."
              : "Each row says what it needs before you press it. Press one that is short of its threshold, then satisfy the step-up and press it again."}
        </p>

        <ul className={styles.actions}>
          {ACTIONS.map((a) => {
            const need = a.threshold;
            const never = need === null;
            const ok = need !== null && trust >= need && !(stepUp && need >= 40);
            return (
              <li key={a.id} className={styles.action}>
                <button
                  type="button"
                  className={styles.attempt}
                  onClick={() => attempt(a)}
                  disabled={!unlocked || (wiped && a.id !== "export")}
                >
                  {a.label}
                </button>
                <span className={styles.need}>
                  {need === null ? "no threshold grants this" : `needs ${need}`}
                  <span className={styles.risk}> · {a.risk} risk</span>
                </span>
                <span className={never ? styles.chipStop : ok ? styles.chipOk : styles.chipWarn}>
                  {never ? "never" : ok ? "allowed now" : "needs step-up"}
                </span>
              </li>
            );
          })}
        </ul>

        <div className={styles.live} aria-live="polite" aria-atomic="false">
          {latest ? (
            <ul className={styles.outcomes}>
              {entries.map((e, i) => (
                <li
                  key={e.id}
                  className={
                    e.verdict === "allowed"
                      ? styles.outAllowed
                      : e.verdict === "refused"
                        ? styles.outRefused
                        : styles.outNote
                  }
                  data-old={i > 0 ? "" : undefined}
                >
                  <span className={styles.verdictTag}>
                    {e.verdict === "allowed" ? "Allowed" : e.verdict === "refused" ? "Refused" : "Trust"}
                  </span>
                  {e.line}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.outcomeIdle}>No request attempted yet.</p>
          )}
        </div>
      </section>

      {/* ── 4. server view ──────────────────────────────────── */}

      <section className={styles.block} aria-labelledby={`${passId}-s`}>
        <h3 className={styles.h} id={`${passId}-s`}>
          4 · What the server holds, right now
        </h3>

        <div className={styles.split}>
          <ul className={styles.holds}>
            <li className={styles.has}>
              <span className={styles.hasK}>Ciphertext blobs</span>
              <span className={styles.hasV}>{blobs}</span>
            </li>
            <li className={styles.has}>
              <span className={styles.hasK}>Salt</span>
              <span className={styles.hasV}>public</span>
            </li>
            <li className={unlocked ? styles.has : styles.hasNone}>
              <span className={styles.hasK}>Encryption public key</span>
              <span className={styles.hasV}>{unlocked ? "RSA-OAEP" : "none yet"}</span>
            </li>
            <li className={unlocked ? styles.has : styles.hasNone}>
              <span className={styles.hasK}>Signing public key</span>
              <span className={styles.hasV}>{unlocked ? "RSA-PSS" : "none yet"}</span>
            </li>
            <li className={styles.hasNone}>
              <span className={styles.hasK}>Encryption private key</span>
              <span className={styles.hasV}>never uploaded</span>
            </li>
            <li className={styles.hasNone}>
              <span className={styles.hasK}>Signing private key</span>
              <span className={styles.hasV}>never uploaded</span>
            </li>
            <li className={styles.hasNone}>
              <span className={styles.hasK}>Derived key</span>
              <span className={styles.hasV}>never transmitted</span>
            </li>
            <li className={styles.hasNone}>
              <span className={styles.hasK}>Passphrase</span>
              <span className={styles.hasV}>never transmitted</span>
            </li>
            <li className={styles.has}>
              <span className={styles.hasK}>Plaintext bytes seen</span>
              <span className={styles.hasV}>0</span>
            </li>
          </ul>

          <div className={styles.col}>
            <p className={styles.colHead}>Requests it saw</p>
            {serverLog.length ? (
              <ul className={styles.wire}>
                {serverLog.map((l, i) => (
                  <li key={`${l}-${i}`} className={styles.wireLine}>
                    {l}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.empty}>
                <p className={styles.emptyLine}>Nothing yet.</p>
              </div>
            )}
            <p className={styles.aside}>
              Every row above is either ciphertext or a public key. Own this
              server completely and that is still all you get.
            </p>
          </div>
        </div>

        <button type="button" className={styles.btnGhost} onClick={reset}>
          Reset the demo
        </button>
      </section>
    </div>
  );
}
