import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  getInquiryStats,
  listInquiriesPage,
  searchInquiries,
  updateInquiryStatus,
  type InquiryStats,
  type SubmissionRow,
  type SubmissionStatus,
} from "./inquiries";
import { HeaderLogo } from "./logo";

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<SubmissionRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<
    "all" | SubmissionStatus
  >("all");

  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [cursors, setCursors] = useState<
    import("firebase/firestore").QueryDocumentSnapshot[]
  >([]);

  const [stats, setStats] = useState<InquiryStats>({
    total: 0,
    New: 0,
    Qualified: 0,
    "Not Qualified": 0,
    "In Progress": 0,
    Completed: 0,
  });

  const [selectedRow, setSelectedRow] =
    useState<SubmissionRow | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwPopup, setPwPopup] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  async function loadStats() {
    try {
      const result = await getInquiryStats();
      setStats(result);
    } catch {
      // Keep the dashboard usable if statistics temporarily fail.
    }
  }

  async function loadPage(
    cursor?: import("firebase/firestore").QueryDocumentSnapshot,
    requestedPage = 1,
  ) {
    try {
      const result = await listInquiriesPage(
        cursor,
        statusFilter,
        appliedDateFrom || undefined,
        appliedDateTo || undefined,
      );

      setRows(result.rows);
      setTotal(result.total);
      setPage(requestedPage);

      if (requestedPage === 1) {
        setCursors(result.last ? [result.last] : []);
      } else if (result.last) {
        setCursors((previous) => {
          const next = [...previous];
          next[requestedPage - 1] = result.last;
          return next;
        });
      }
    } catch {
      setRows([]);
      setTotal(0);
    }
  }

  useEffect(() => {
    if (!user) return;

    if (searchActive) {
      void searchInquiries(searchInput, statusFilter)
        .then(setRows)
        .catch(() => setRows([]));

      return;
    }

    void loadPage(undefined, 1);
    void loadStats();
  }, [
    user,
    statusFilter,
    appliedDateFrom,
    appliedDateTo,
    searchActive,
  ]);

  const displayedStats = useMemo(() => {
    return {
      total: stats.total,
      New: stats.New,
      Qualified: stats.Qualified,
      "Not Qualified": stats["Not Qualified"],
      "In Progress": stats["In Progress"],
      Completed: stats.Completed,
    };
  }, [stats]);

  async function onAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    const fd = new FormData(e.currentTarget);

    const email = String(fd.get("email") ?? "")
      .trim()
      .toLowerCase();

    const password = String(fd.get("password") ?? "");

    if (email !== OWNER_EMAIL) {
      setAuthError(
        "This dashboard is restricted to the owner account.",
      );
      return;
    }

    if (password.length < 8) {
      setAuthError(
        "Password must be at least 8 characters.",
      );
      return;
    }

    setBusy(true);
    setAuthError(null);

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : "Unable to sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (!user?.email) return;

    const fd = new FormData(e.currentTarget);

    const current = String(
      fd.get("current") ?? "",
    );

    const next = String(fd.get("next") ?? "");

    if (next.length < 8) {
      setPwMsg(
        "New password must be at least 8 characters.",
      );
      return;
    }

    try {
      const cred = EmailAuthProvider.credential(
        user.email,
        current,
      );

      await reauthenticateWithCredential(
        user,
        cred,
      );

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

  async function onSearch(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    const term = searchInput.trim();

    if (!term) {
      setSearchActive(false);
      await loadPage(undefined, 1);
      return;
    }

    setSearchActive(true);

    try {
      const found = await searchInquiries(
        term,
        statusFilter,
      );

      setRows(found);
    } catch {
      setRows([]);
    }
  }

  function clearSearch() {
    setSearchInput("");
    setSearchActive(false);
  }

  async function onFilter() {
    if (
      dateFrom &&
      dateTo &&
      dateFrom > dateTo
    ) {
      window.alert(
        "The From Date cannot be later than the To Date.",
      );
      return;
    }

    setSearchActive(false);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(1);
    setCursors([]);

    try {
      const result = await listInquiriesPage(
        undefined,
        statusFilter,
        dateFrom || undefined,
        dateTo || undefined,
      );

      setRows(result.rows);
      setTotal(result.total);

      setCursors(
        result.last ? [result.last] : [],
      );

      await loadStats();
    } catch {
      setRows([]);
      setTotal(0);
    }
  }

  async function clearDates() {
    setDateFrom("");
    setDateTo("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setSearchActive(false);
    setPage(1);
    setCursors([]);

    try {
      const result = await listInquiriesPage(
        undefined,
        statusFilter,
      );

      setRows(result.rows);
      setTotal(result.total);

      setCursors(
        result.last ? [result.last] : [],
      );
    } catch {
      setRows([]);
      setTotal(0);
    }
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

    try {
      await deleteInquiry(row.id);

      setRows((previous) =>
        previous.filter(
          (r) => r.id !== row.id,
        ),
      );

      setTotal((n) =>
        Math.max(0, n - 1),
      );

      await loadStats();
    } catch {
      window.alert(
        "Unable to delete this submission.",
      );
    }
  }

  async function onStatusChange(
    row: SubmissionRow,
    status: SubmissionStatus,
  ) {
    try {
      await updateInquiryStatus(
        row.id,
        status,
      );

      setRows((previous) =>
        previous.map((item) =>
          item.id === row.id
            ? { ...item, status }
            : item,
        ),
      );

      await loadStats();
    } catch {
      window.alert(
        "Unable to update the submission status.",
      );
    }
  }

  function exportCsv() {
    if (rows.length === 0) {
      window.alert(
        "There are no submissions to export.",
      );
      return;
    }

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
      "Terms Accepted",
      "Privacy Accepted",
      "Status",
      "Submitted At",
    ];

    const lines = [
      headers.map(csvCell).join(","),
    ];

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
          r.termsAccepted ? "Yes" : "No",
          r.privacyAccepted ? "Yes" : "No",
          r.status,
          formatDate(r.submittedAt),
        ]
          .map((value) =>
            csvCell(String(value)),
          )
          .join(","),
      );
    }

    const blob = new Blob(
      [
        `\uFEFF${lines.join("\r\n")}`,
      ],
      {
        type: "text/csv;charset=utf-8",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      "daughtridge-inquiries.csv";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  async function goFirst() {
    setPage(1);

    try {
      const result =
        await listInquiriesPage(
          undefined,
          statusFilter,
          appliedDateFrom || undefined,
          appliedDateTo || undefined,
        );

      setRows(result.rows);
      setTotal(result.total);

      setCursors(
        result.last
          ? [result.last]
          : [],
      );
    } catch {
      // Ignore temporary loading error.
    }
  }

  async function goNext() {
    const cursor =
      cursors[page - 1];

    if (!cursor) return;

    try {
      const result =
        await listInquiriesPage(
          cursor,
          statusFilter,
          appliedDateFrom || undefined,
          appliedDateTo || undefined,
        );

      setRows(result.rows);
      setTotal(result.total);

      setPage((previous) =>
        previous + 1,
      );

      setCursors((previous) =>
        result.last
          ? [...previous, result.last]
          : previous,
      );
    } catch {
      // Ignore temporary loading error.
    }
  }

  if (!ready) {
    return (
      <div className="admin-shell">
        <p className="admin-muted">
          Opening dashboard…
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <a
            href="#/"
            className="logo-link"
          >
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
              Owner access only. Sign in
              with the company email and
              password.
            </p>

            <form
              className="admin-form"
              onSubmit={onAuth}
            >
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  defaultValue={
                    OWNER_EMAIL
                  }
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
                <p className="admin-error">
                  {authError}
                </p>
              ) : null}

              <button
                className="admin-btn"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Please wait…"
                  : "Sign In"}
              </button>
            </form>

            <p className="admin-back">
              <a href="#/">
                Return to website
              </a>
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
            <h2>
              Password updated
            </h2>

            <p>
              Your password has been
              changed successfully.
            </p>

            <button
              type="button"
              className="admin-btn"
              onClick={() =>
                setPwPopup(false)
              }
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <div
          className="admin-popup-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() =>
            setSelectedRow(null)
          }
        >
          <div
            className="admin-view-popup"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="admin-view-header">
              <div>
                <p className="admin-kicker">
                  Submission Details
                </p>

                <h2>
                  {selectedRow.firstName}{" "}
                  {selectedRow.lastName}
                </h2>

                <p className="admin-ref">
                  {selectedRow.referenceNumber}
                </p>
              </div>

              <button
                type="button"
                className="admin-popup-close"
                onClick={() =>
                  setSelectedRow(null)
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="admin-detail-grid">
              <div>
                <span>
                  First Name
                </span>
                <strong>
                  {selectedRow.firstName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Last Name
                </span>
                <strong>
                  {selectedRow.lastName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {selectedRow.email ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>
                  {selectedRow.phone ||
                    "—"}
                </strong>
              </div>

              <div className="full-width">
                <span>
                  Property Address
                </span>
                <strong>
                  {selectedRow.propertyAddress ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Property Type
                </span>
                <strong>
                  {selectedRow.propertyType ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Owner Name
                </span>
                <strong>
                  {selectedRow.ownerName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Parcel / PIN
                </span>
                <strong>
                  {selectedRow.parcelPin ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Acreage</span>
                <strong>
                  {selectedRow.acreage ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {selectedRow.status}
                </strong>
              </div>

              <div>
                <span>
                  SMS Consent
                </span>
                <strong>
                  {selectedRow.smsConsent
                    ? "Yes"
                    : "No"}
                </strong>
              </div>

              <div>
                <span>
                  Terms Accepted
                </span>
                <strong>
                  {selectedRow.termsAccepted
                    ? "Yes"
                    : "No"}
                </strong>
              </div>

              <div>
                <span>
                  Privacy Accepted
                </span>
                <strong>
                  {selectedRow.privacyAccepted
                    ? "Yes"
                    : "No"}
                </strong>
              </div>

              <div>
                <span>
                  Submitted At
                </span>
                <strong>
                  {formatDate(
                    selectedRow.submittedAt,
                  )}
                </strong>
              </div>

              <div className="full-width">
                <span>
                  Additional Note
                </span>
                <strong className="note-value">
                  {selectedRow.additionalNote ||
                    "—"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="admin-btn"
              onClick={() =>
                setSelectedRow(null)
              }
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <header className="admin-header">
        <div className="admin-header-spacer" />

        <div className="admin-header-right">
          <span>Owner</span>

          <button
            type="button"
            className="admin-header-ghost"
            onClick={() =>
              setPwOpen((value) => !value)
            }
          >
            Change Password
          </button>

          <button
            type="button"
            className="admin-header-ghost"
            onClick={() =>
              void signOut(auth)
            }
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <h1>
          Daughtridge Investment Group LLC
        </h1>

        <p className="admin-subtitle">
          Admin Dashboard
        </p>

        {pwOpen ? (
          <div className="admin-pw">
            <h2>
              Change Password
            </h2>

            <form
              className="admin-form"
              onSubmit={onChangePassword}
            >
              <label>
                Current Password
                <input
                  name="current"
                  type="password"
                  required
                />
              </label>

              <label>
                New Password
                <input
                  name="next"
                  type="password"
                  minLength={8}
                  required
                />
              </label>

              {pwMsg ? (
                <p className="admin-error">
                  {pwMsg}
                </p>
              ) : null}

              <button
                className="admin-btn"
                type="submit"
              >
                Save Password
              </button>
            </form>
          </div>
        ) : null}

        <div className="admin-stats">
          <div>
            <strong>
              {displayedStats.total}
            </strong>
            <span>
              Total Submissions
            </span>
          </div>

          {STATUSES.map(
            (status) => (
              <div key={status}>
                <strong>
                  {displayedStats[status]}
                </strong>
                <span>{status}</span>
              </div>
            ),
          )}
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
                  setSearchInput(
                    e.target.value,
                  )
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

              {STATUSES.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className="admin-date-filter">
          <label>
            From Date
            <input
              type="date"
              value={dateFrom}
              onChange={(e) =>
                setDateFrom(
                  e.target.value,
                )
              }
            />
          </label>

          <label>
            To Date
            <input
              type="date"
              value={dateTo}
              onChange={(e) =>
                setDateTo(
                  e.target.value,
                )
              }
            />
          </label>

          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              void onFilter()
            }
          >
            Filter
          </button>

          <button
            type="button"
            className="admin-btn-ghost"
            onClick={() =>
              void clearDates()
            }
          >
            Clear Dates
          </button>

          <button
            type="button"
            className="admin-export"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export to Excel/CSV
          </button>
        </div>

        <div className="admin-table-wrap">
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
                      : "No submissions found."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>
                        {row.firstName}{" "}
                        {row.lastName}
                      </strong>

                      <br />

                      <small>
                        {row.referenceNumber}
                      </small>
                    </td>

                    <td>
                      {row.propertyAddress ||
                        "—"}
                    </td>

                    <td>
                      {row.propertyType ||
                        "—"}
                    </td>

                    <td>
                      <select
                        className="admin-status-select"
                        value={row.status}
                        onChange={(e) =>
                          void onStatusChange(
                            row,
                            e.target
                              .value as SubmissionStatus,
                          )
                        }
                      >
                        {STATUSES.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {status}
                            </option>
                          ),
                        )}
                      </select>
                    </td>

                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-view"
                          onClick={() =>
                            setSelectedRow(
                              row,
                            )
                          }
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="admin-delete"
                          onClick={() =>
                            void onDelete(row)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!searchActive ? (
          <div className="admin-pager">
            <div>
              Page {page} ·{" "}
              {PAGE_SIZE} per page ·{" "}
              {total} total
            </div>

            <div className="admin-pager-buttons">
              <button
                type="button"
                className="admin-btn"
                disabled={page <= 1}
                onClick={() =>
                  void goFirst()
                }
              >
                First
              </button>

              <button
                type="button"
                className="admin-btn"
                disabled={
                  rows.length <
                    PAGE_SIZE ||
                  !cursors[page - 1]
                }
                onClick={() =>
                  void goNext()
                }
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <p className="admin-pager">
            Showing up to {PAGE_SIZE}{" "}
            search matches.
          </p>
        )}
      </main>
    </div>
  );
}
