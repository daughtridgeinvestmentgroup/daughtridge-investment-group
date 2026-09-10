import { useEffect, useState, type FormEvent } from "react";
import {
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
  PAGE_SIZE,
  STATUSES,
  deleteInquiry,
  exportAllInquiries,
  getInquiryStats,
  listInquiriesPage,
  searchInquiries,
  updateInquiryStatus,
  type InquiryStats,
  type SubmissionRow,
  type SubmissionStatus,
} from "./inquiries";
import { HeaderLogo } from "./logo";

const EMPTY_STATS: InquiryStats = {
  total: 0,
  New: 0,
  Qualified: 0,
  "Not Qualified": 0,
  "In Progress": 0,
  Completed: 0,
};

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [stats, setStats] = useState<InquiryStats>(EMPTY_STATS);

  const [statusFilter, setStatusFilter] =
    useState<"all" | SubmissionStatus>("all");

  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [cursors, setCursors] = useState<
    import("firebase/firestore").QueryDocumentSnapshot[]
  >([]);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwPopup, setPwPopup] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [viewing, setViewing] = useState<SubmissionRow | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    void getInquiryStats()
      .then(setStats)
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (searchActive) {
      void searchInquiries(searchInput, statusFilter)
        .then(setRows)
        .catch(() => undefined);

      return;
    }

    void listInquiriesPage(
      undefined,
      statusFilter,
      dateFrom,
      dateTo,
    )
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
        setPage(1);
        setCursors(r.last ? [r.last] : []);
      })
      .catch(() => undefined);
  }, [user, statusFilter, searchActive, dateFrom, dateTo]);

  async function refreshStats() {
    try {
      setStats(await getInquiryStats());
    } catch {
      /* keep last known totals */
    }
  }

  async function onAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    const fd = new FormData(e.currentTarget);

    const email = String(fd.get("email") ?? "")
      .trim()
      .toLowerCase();

    const password = String(fd.get("password") ?? "");

    if (email !== OWNER_EMAIL) {
      setAuthError("This dashboard is restricted to the owner account.");
      return;
    }

    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    setAuthError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Unable to sign in.",
      );
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

      setPwMsg(null);
      setPwOpen(false);
      setPwPopup(true);

      e.currentTarget.reset();
    } catch (err) {
      setPwMsg(
        err instanceof Error
          ? err.message
          : "Unable to change password.",
      );
    }
  }

  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const term = searchInput.trim();

    if (!term) {
      setSearchActive(false);
      return;
    }

    setSearchActive(true);

    const found = await searchInquiries(term, statusFilter);
    setRows(found);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchActive(false);
  }

  function clearDates() {
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setCursors([]);
  }

  async function onDelete(row: SubmissionRow) {
    const name =
      `${row.firstName} ${row.lastName}`.trim() ||
      row.referenceNumber;

    if (
      !window.confirm(
        `Delete ${name} (${row.referenceNumber})? This cannot be undone.`,
      )
    ) {
      return;
    }

    await deleteInquiry(row.id);

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setTotal((n) => Math.max(0, n - 1));

    void refreshStats();
  }

  async function onStatusChange(
    id: string,
    status: SubmissionStatus,
  ) {
    await updateInquiryStatus(id, status);

    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, status } : row,
      ),
    );

    void refreshStats();
  }

  async function exportCsv() {
    if (exporting) return;

    setExporting(true);

    try {
      const all = await exportAllInquiries();

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

      for (const r of all) {
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

      const blob = new Blob(
        [`\uFEFF${lines.join("\r\n")}`],
        { type: "text/csv" },
      );

      const a = document.createElement("a");

      a.href = URL.createObjectURL(blob);
      a.download = "daughtridge-inquiries.csv";
      a.click();

      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  async function loadFirstPage() {
    const result = await listInquiriesPage(
      undefined,
      statusFilter,
      dateFrom,
      dateTo,
    );

    setRows(result.rows);
    setTotal(result.total);
    setPage(1);
    setCursors(result.last ? [result.last] : []);
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
            <p className="admin-kicker">
              Daughtridge Investment Group LLC
            </p>

            <h1>Admin Login</h1>

            <p className="admin-lead">
              Owner access only. Sign in with the company email
              and password.
            </p>

            <form className="admin-form" onSubmit={onAuth}>
              <label>
                Email

                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  defaultValue={OWNER_EMAIL}
                  required
                />
              </label>

              <label>
                Password

                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  required
                />
              </label>

              {authError ? (
                <p className="admin-error">{authError}</p>
              ) : null}

              <button
                className="admin-btn"
                type="submit"
                disabled={busy}
              >
                {busy ? "Please wait…" : "Sign In"}
              </button>
            </form>

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
      {pwPopup ? (
        <div
          className="admin-popup-backdrop"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="admin-popup">
            <h2>Password updated</h2>

            <p>
              Your password has been changed successfully.
            </p>

            <button
              type="button"
              className="admin-btn"
              onClick={() => setPwPopup(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {viewing ? (
        <div
          className="admin-popup-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="admin-popup"
            style={{
              maxWidth: 650,
              width: "calc(100% - 32px)",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h2>Submission Details</h2>

            <p>
              <strong>Reference:</strong>{" "}
              {viewing.referenceNumber}
            </p>

            <p>
              <strong>Name:</strong>{" "}
              {viewing.firstName} {viewing.lastName}
            </p>

            <p>
              <strong>Email:</strong> {viewing.email}
            </p>

            <p>
              <strong>Phone:</strong> {viewing.phone}
            </p>

            <p>
              <strong>Property Address:</strong>{" "}
              {viewing.propertyAddress || "—"}
            </p>

            <p>
              <strong>Property Type:</strong>{" "}
              {viewing.propertyType || "—"}
            </p>

            <p>
              <strong>Owner Name:</strong>{" "}
              {viewing.ownerName || "—"}
            </p>

            <p>
              <strong>Parcel / PIN:</strong>{" "}
              {viewing.parcelPin || "—"}
            </p>

            <p>
              <strong>Acreage:</strong>{" "}
              {viewing.acreage || "—"}
            </p>

            <p>
              <strong>Additional Note:</strong>{" "}
              {viewing.additionalNote || "—"}
            </p>

            <p>
              <strong>SMS Consent:</strong>{" "}
              {viewing.smsConsent ? "Yes" : "No"}
            </p>

            <p>
              <strong>Terms Accepted:</strong>{" "}
              {viewing.termsAccepted ? "Yes" : "No"}
            </p>

            <p>
              <strong>Privacy Accepted:</strong>{" "}
              {viewing.privacyAccepted ? "Yes" : "No"}
            </p>

            <p>
              <strong>Status:</strong> {viewing.status}
            </p>

            <p>
              <strong>Submitted:</strong>{" "}
              {formatDate(viewing.submittedAt)}
            </p>

            <button
              type="button"
              className="admin-btn"
              onClick={() => setViewing(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <header className="admin-header">
        <span>Owner</span>

        <div>
          <button
            type="button"
            className="admin-btn-ghost"
            onClick={() => setPwOpen((v) => !v)}
          >
            Change password
          </button>

          <button
            type="button"
            className="admin-btn-ghost"
            onClick={() => void signOut(auth)}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <h1>Daughtridge Investment Group LLC</h1>

        <p className="admin-subtitle">
          Admin Dashboard
        </p>

        {pwOpen ? (
          <form
            className="admin-form"
            onSubmit={onChangePassword}
            style={{ maxWidth: 420 }}
          >
            <label>
              Current password
              <input
                name="current"
                type="password"
                required
              />
            </label>

            <label>
              New password
              <input
                name="next"
                type="password"
                minLength={8}
                required
              />
            </label>

            {pwMsg ? <p>{pwMsg}</p> : null}

            <button
              className="admin-btn"
              type="submit"
            >
              Save password
            </button>
          </form>
        ) : null}

        <div className="admin-stats">
          <span>
            <strong>{stats.total}</strong>{" "}
            Total Submissions
          </span>

          {STATUSES.map((s) => (
            <span key={s}>
              <strong>{stats[s]}</strong> {s}
            </span>
          ))}
        </div>

        <div className="admin-toolbar">
          <form
            className="admin-search"
            onSubmit={onSearch}
          >
            <label>
              Client / Reference

              <input
                type="search"
                value={searchInput}
                onChange={(e) =>
                  setSearchInput(e.target.value)
                }
                placeholder="First name, last name, or DIG-…"
              />
            </label>

            <button
              type="submit"
              className="admin-btn"
            >
              Search
            </button>

            {searchActive ? (
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={clearSearch}
              >
                Clear
              </button>
            ) : null}
          </form>

          <label>
            Status

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "all"
                    | SubmissionStatus,
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <label>
            From date

            <input
              type="date"
              value={dateFrom}
              onChange={(e) =>
                setDateFrom(e.target.value)
              }
            />
          </label>

          <label>
            To date

            <input
              type="date"
              value={dateTo}
              onChange={(e) =>
                setDateTo(e.target.value)
              }
            />
          </label>

          <button
            type="button"
            className="admin-btn-ghost"
            onClick={clearDates}
            disabled={!dateFrom && !dateTo}
          >
            Clear Dates
          </button>

          <button
            type="button"
            className="admin-btn"
            onClick={() => void loadFirstPage()}
          >
            Filter
          </button>

          <button
            type="button"
            className="admin-btn"
            onClick={() => void exportCsv()}
            disabled={exporting}
          >
            {exporting
              ? "Exporting…"
              : "Export to Excel/CSV"}
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
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    {searchActive
                      ? "No clients match that search."
                      : "No submissions yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.firstName} {r.lastName}
                      <br />
                      <small>
                        {r.referenceNumber}
                      </small>
                    </td>

                    <td>
                      {r.propertyAddress || "—"}
                    </td>

                    <td>
                      {r.propertyType || "—"}
                    </td>

                    <td>
                      <select
                        className="admin-status-select"
                        value={r.status}
                        onChange={(e) => {
                          void onStatusChange(
                            r.id,
                            e.target.value as SubmissionStatus,
                          );
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="admin-btn-ghost"
                        onClick={() =>
                          setViewing(r)
                        }
                      >
                        VIEW
                      </button>{" "}

                      <button
                        type="button"
                        className="admin-delete"
                        onClick={() =>
                          void onDelete(r)
                        }
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!searchActive ? (
          <p className="admin-pager">
            Page {page} · {PAGE_SIZE} per page ·{" "}
            {total} total

            <br />

            <button
              type="button"
              className="admin-btn"
              disabled={page <= 1}
              onClick={() => {
                setPage(1);

                void listInquiriesPage(
                  undefined,
                  statusFilter,
                  dateFrom,
                  dateTo,
                ).then((r) => {
                  setRows(r.rows);
                  setTotal(r.total);
                  setCursors(
                    r.last ? [r.last] : [],
                  );
                });
              }}
            >
              First
            </button>{" "}

            <button
              type="button"
              className="admin-btn"
              disabled={
                !cursors[page - 1] ||
                rows.length < PAGE_SIZE
              }
              onClick={() => {
                const cursor =
                  cursors[page - 1];

                if (!cursor) return;

                void listInquiriesPage(
                  cursor,
                  statusFilter,
                  dateFrom,
                  dateTo,
                ).then((r) => {
                  setRows(r.rows);
                  setTotal(r.total);
                  setPage((p) => p + 1);

                  setCursors((prev) =>
                    r.last
                      ? [...prev, r.last]
                      : prev,
                  );
                });
              }}
            >
              Next
            </button>
          </p>
        ) : (
          <p className="admin-pager">
            Showing up to {PAGE_SIZE} matches.
            Search uses name/reference prefix plus
            the selected status.
          </p>
        )}
      </main>
    </div>
  );
}
