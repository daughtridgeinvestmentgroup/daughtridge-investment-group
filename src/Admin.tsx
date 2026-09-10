import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from "firebase/auth";
import { auth, OWNER_EMAIL } from "./firebase";
import {
  STATUSES,
  listInquiries,
  updateInquiryStatus,
  type SubmissionRow,
  type SubmissionStatus,
} from "./inquiries";
import { HeaderLogo } from "./logo";

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [pwOpen, setPwOpen] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    void listInquiries().then(setRows).catch(() => undefined);
  }, [user]);

  const stats = useMemo(() => {
    const counts: Record<SubmissionStatus, number> = {
      New: 0,
      Qualified: 0,
      "Not Qualified": 0,
      "In Progress": 0,
      Completed: 0,
    };
    for (const r of rows) counts[r.status] += 1;
    return counts;
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (clientFilter !== "all" && r.id !== clientFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  async function onAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setAuthError(null);
    try {
      if (mode === "signup") {
        if (password !== confirm) throw new Error("Passwords do not match.");
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user?.email) return;
    const fd = new FormData(e.currentTarget);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    if (next.length < 8) {
      setPwMsg("New password must be at least 8 characters.");
      return;
    }
    try {
      const cred = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, next);
      setPwMsg("Password updated.");
      e.currentTarget.reset();
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Unable to change password.");
    }
  }

  function exportCsv() {
    const headers = [
      "Reference Number",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Property Address",
      "Property Type",
      "Owner Name",
      "Parcel / PIN",
      "Acreage",
      "Additional Note",
      "SMS Consent",
      "Status",
      "Submitted At",
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.referenceNumber,
          r.firstName,
          r.lastName,
          r.email,
          r.phone,
          r.propertyAddress,
          r.propertyType,
          r.ownerName,
          r.parcelPin,
          r.acreage,
          r.additionalNote,
          r.smsConsent ? "Yes" : "No",
          r.status,
          r.submittedAt,
        ]
          .map((v) => csvCell(String(v)))
          .join(","),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "daughtridge-inquiries.csv";
    a.click();
  }

  if (!ready) {
    return (
      <div className="admin-shell">
        <p className="admin-muted">Opening dashboard…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <a href="#/" className="logo-link">
            <HeaderLogo />
          </a>
        </header>
        <main className="admin-card-wrap">
          <div className="admin-card">
            <p className="admin-kicker">Daughtridge Investment Group LLC</p>
            <h1>{mode === "signup" ? "Create Owner Account" : "Admin Login"}</h1>
            <form className="admin-form" onSubmit={onAuth}>
              <label>
                Email
                <input name="email" type="email" defaultValue={OWNER_EMAIL} required />
              </label>
              <label>
                Password
                <input name="password" type="password" minLength={8} required />
              </label>
              {mode === "signup" ? (
                <label>
                  Confirm password
                  <input name="confirm" type="password" minLength={8} required />
                </label>
              ) : null}
              {authError ? <p className="admin-error">{authError}</p> : null}
              <button className="admin-btn" type="submit" disabled={busy}>
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
            <p className="admin-switch">
              {mode === "signup" ? (
                <button type="button" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              ) : (
                <button type="button" onClick={() => setMode("signup")}>
                  Create account
                </button>
              )}
            </p>
            <p className="admin-back">
              <a href="#/">Return to website</a>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <span>Owner</span>
        <div>
          <button type="button" className="admin-btn-ghost" onClick={() => setPwOpen((v) => !v)}>
            Change password
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => void signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>
      <main className="admin-main">
        <h1>Daughtridge Investment Group LLC</h1>
        <p className="admin-subtitle">Admin Dashboard</p>
        {pwOpen ? (
          <form className="admin-form" onSubmit={onChangePassword} style={{ maxWidth: 420 }}>
            <label>
              Current password
              <input name="current" type="password" required />
            </label>
            <label>
              New password
              <input name="next" type="password" minLength={8} required />
            </label>
            {pwMsg ? <p>{pwMsg}</p> : null}
            <button className="admin-btn" type="submit">
              Save password
            </button>
          </form>
        ) : null}
        <div className="admin-stats">
          <span>
            <strong>{rows.length}</strong> Total Submissions
          </span>
          {STATUSES.map((s) => (
            <span key={s}>
              <strong>{stats[s]}</strong> {s}
            </span>
          ))}
        </div>
        <div className="admin-filters">
          <label>
            Client / Reference
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="all">All clients</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.firstName} {r.lastName} — {r.referenceNumber}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | SubmissionStatus)}
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="button" className="admin-btn" onClick={exportCsv}>
            Export to Excel/CSV
          </button>
        </div>
        <div style={{ overflow: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Property</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>No submissions yet.</td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.firstName} {r.lastName}
                      <br />
                      <small>{r.referenceNumber}</small>
                    </td>
                    <td>{r.propertyAddress || "—"}</td>
                    <td>{r.propertyType || "—"}</td>
                    <td>
                      <select
                        className="admin-status-select"
                        value={r.status}
                        onChange={(e) => {
                          const status = e.target.value as SubmissionStatus;
                          void updateInquiryStatus(r.id, status);
                          setRows((prev) =>
                            prev.map((row) => (row.id === r.id ? { ...row, status } : row)),
                          );
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
