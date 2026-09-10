import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export const PROPERTY_TYPES = [
  "Single-Family Home",
  "Multi-Family Home",
  "Manufactured Home",
  "Mobile Home",
  "Modular Home",
  "Townhouse",
  "Condominium",
  "Vacant Land",
  "Other",
] as const;

export const PAGE_SIZE = 25;

export const STATUSES = [
  "New",
  "Qualified",
  "Not Qualified",
  "In Progress",
  "Completed",
] as const;

export type SubmissionStatus = (typeof STATUSES)[number];

export type SubmissionRow = {
  id: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyAddress: string;
  propertyType: string;
  ownerName: string;
  parcelPin: string;
  acreage: string;
  additionalNote: string;
  smsConsent: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  status: SubmissionStatus;
  submittedAt: string;
};

export type InquiryStats = {
  total: number;
} & Record<SubmissionStatus, number>;

function createReferenceNumber(): string {
  const date = new Date();

  const datePart =
    `${date.getFullYear()}` +
    `${String(date.getMonth() + 1).padStart(2, "0")}` +
    `${String(date.getDate()).padStart(2, "0")}`;

  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `DIG-${datePart}-${randomPart}`;
}

export async function submitInquiry({
  data,
}: {
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    propertyAddress: string;
    propertyType: string;
    ownerName: string;
    parcelPin: string;
    acreage: string;
    additionalNote: string;
    smsConsent: boolean;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    honey?: string;
  };
}) {
  if (data.honey?.trim()) {
    return {
      ok: true as const,
    };
  }

  if (!data.termsAccepted || !data.privacyAccepted) {
    throw new Error(
      "You must accept the Terms & Conditions and Privacy Policy.",
    );
  }

  const referenceNumber = createReferenceNumber();

  await addDoc(collection(db, "inquiries"), {
    referenceNumber,

    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),

    firstNameLower: data.firstName.trim().toLowerCase(),
    lastNameLower: data.lastName.trim().toLowerCase(),

    email: data.email.trim(),
    phone: data.phone.trim(),
    propertyAddress: data.propertyAddress.trim(),
    propertyType: data.propertyType.trim(),
    ownerName: data.ownerName.trim(),
    parcelPin: data.parcelPin.trim(),
    acreage: data.acreage.trim(),
    additionalNote: data.additionalNote.trim(),

    smsConsent: Boolean(data.smsConsent),
    termsAccepted: Boolean(data.termsAccepted),
    privacyAccepted: Boolean(data.privacyAccepted),

    status: "New",

    submittedAt: serverTimestamp(),
  });

  return {
    ok: true as const,
    referenceNumber,
  };
}

function mapDoc(d: QueryDocumentSnapshot<DocumentData>): SubmissionRow {
  const x = d.data();
  const submitted = x.submittedAt?.toDate?.() ?? new Date();

  return {
    id: d.id,
    referenceNumber: String(x.referenceNumber ?? ""),
    firstName: String(x.firstName ?? ""),
    lastName: String(x.lastName ?? ""),
    email: String(x.email ?? ""),
    phone: String(x.phone ?? ""),
    propertyAddress: String(x.propertyAddress ?? ""),
    propertyType: String(x.propertyType ?? ""),
    ownerName: String(x.ownerName ?? ""),
    parcelPin: String(x.parcelPin ?? ""),
    acreage: String(x.acreage ?? ""),
    additionalNote: String(x.additionalNote ?? ""),
    smsConsent: Boolean(x.smsConsent),
    termsAccepted: Boolean(x.termsAccepted),
    privacyAccepted: Boolean(x.privacyAccepted),
    status: (STATUSES as readonly string[]).includes(x.status)
      ? (x.status as SubmissionStatus)
      : "New",
    submittedAt: submitted.toISOString(),
  };
}

function dateConstraints(
  dateFrom?: string,
  dateTo?: string,
): QueryConstraint[] {
  const parts: QueryConstraint[] = [];

  if (dateFrom) {
    parts.push(
      where(
        "submittedAt",
        ">=",
        new Date(`${dateFrom}T00:00:00`),
      ),
    );
  }

  if (dateTo) {
    const end = new Date(`${dateTo}T00:00:00`);
    end.setDate(end.getDate() + 1);

    parts.push(where("submittedAt", "<", end));
  }

  return parts;
}

export async function listInquiriesPage(
  cursor?: QueryDocumentSnapshot<DocumentData>,
  status: "all" | SubmissionStatus = "all",
  dateFrom?: string,
  dateTo?: string,
) {
  const col = collection(db, "inquiries");

  const constraints: QueryConstraint[] = [];

  if (status !== "all") {
    constraints.push(where("status", "==", status));
  }

  constraints.push(...dateConstraints(dateFrom, dateTo));
  constraints.push(orderBy("submittedAt", "desc"));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  constraints.push(limit(PAGE_SIZE));

  const snap = await getDocs(query(col, ...constraints));

  const countConstraints: QueryConstraint[] = [];

  if (status !== "all") {
    countConstraints.push(where("status", "==", status));
  }

  countConstraints.push(...dateConstraints(dateFrom, dateTo));

  const countSnap = await getCountFromServer(
    query(col, ...countConstraints),
  );

  return {
    rows: snap.docs.map(mapDoc),
    last: snap.docs[snap.docs.length - 1] ?? null,
    total: countSnap.data().count,
  };
}

function prefixQuery(
  field: "referenceNumber" | "firstNameLower" | "lastNameLower",
  start: string,
  end: string,
  status: "all" | SubmissionStatus,
) {
  const col = collection(db, "inquiries");
  const parts: QueryConstraint[] = [];

  if (status !== "all") {
    parts.push(where("status", "==", status));
  }

  parts.push(
    where(field, ">=", start),
    where(field, "<=", end),
    limit(PAGE_SIZE),
  );

  return getDocs(query(col, ...parts));
}

export async function searchInquiries(
  term: string,
  status: "all" | SubmissionStatus = "all",
): Promise<SubmissionRow[]> {
  const raw = term.trim();

  if (!raw) return [];

  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();

  const lowerEnd = `${lower}\uf8ff`;
  const upperEnd = `${upper}\uf8ff`;

  const snaps = await Promise.all([
    prefixQuery(
      "referenceNumber",
      upper,
      upperEnd,
      status,
    ),
    prefixQuery(
      "lastNameLower",
      lower,
      lowerEnd,
      status,
    ),
    prefixQuery(
      "firstNameLower",
      lower,
      lowerEnd,
      status,
    ),
  ]);

  const byId = new Map<string, SubmissionRow>();

  for (const snap of snaps) {
    for (const d of snap.docs) {
      byId.set(d.id, mapDoc(d));
    }
  }

  return [...byId.values()].slice(0, PAGE_SIZE);
}

export async function getInquiryStats(): Promise<InquiryStats> {
  const col = collection(db, "inquiries");

  const [totalSnap, ...statusSnaps] = await Promise.all([
    getCountFromServer(query(col)),

    ...STATUSES.map((status) =>
      getCountFromServer(
        query(col, where("status", "==", status)),
      ),
    ),
  ]);

  const stats = {
    total: totalSnap.data().count,
    New: 0,
    Qualified: 0,
    "Not Qualified": 0,
    "In Progress": 0,
    Completed: 0,
  } as InquiryStats;

  STATUSES.forEach((status, i) => {
    stats[status] = statusSnaps[i].data().count;
  });

  return stats;
}

export async function exportAllInquiries(): Promise<SubmissionRow[]> {
  const col = collection(db, "inquiries");
  const rows: SubmissionRow[] = [];

  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  for (;;) {
    const q = cursor
      ? query(
          col,
          orderBy("submittedAt", "desc"),
          startAfter(cursor),
          limit(500),
        )
      : query(
          col,
          orderBy("submittedAt", "desc"),
          limit(500),
        );

    const snap = await getDocs(q);

    rows.push(...snap.docs.map(mapDoc));

    if (snap.docs.length < 500) break;

    cursor = snap.docs[snap.docs.length - 1];
  }

  return rows;
}

export async function updateInquiryStatus(
  id: string,
  status: SubmissionStatus,
) {
  await updateDoc(
    doc(db, "inquiries", id),
    { status },
  );
}

export async function deleteInquiry(id: string) {
  await deleteDoc(
    doc(db, "inquiries", id),
  );
}
