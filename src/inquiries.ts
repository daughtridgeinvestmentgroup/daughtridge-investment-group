import emailjs from "@emailjs/browser";
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
  startAfter,
  updateDoc,
  serverTimestamp,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

const EMAILJS_PUBLIC_KEY = "W75quHyvj2dmS3fJf";
const EMAILJS_SERVICE_ID = "service_h6p6cj";
const VISITOR_TEMPLATE_ID = "template_rfrtxl9";
const OWNER_TEMPLATE_ID = "template_ttp3d8n";

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
  New: number;
  Qualified: number;
  "Not Qualified": number;
  "In Progress": number;
  Completed: number;
};

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}${m}${day}`;
}

/**
 * Small delay used between EmailJS requests.
 * EmailJS limits browser requests to approximately one request per second.
 */
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send the visitor confirmation and owner notification emails.
 *
 * Email errors are intentionally caught so that a temporary email
 * problem does not make the visitor submit the form a second time.
 */
async function sendEmailNotifications({
  firstName,
  lastName,
  email,
  phone,
  referenceNumber,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referenceNumber: string;
}) {
  const dateTime = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "long",
    timeStyle: "short",
  });

  const templateParams = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    reference_number: referenceNumber,
    date_time: dateTime,
  };

  /*
   * 1. Send confirmation email to the visitor.
   */
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      VISITOR_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );

    console.log("Visitor confirmation email sent.");
  } catch (error) {
    console.error(
      "Visitor confirmation email failed:",
      error,
    );
  }

  /*
   * EmailJS has a request-rate limit, so wait before
   * sending the second email.
   */
  await wait(1100);

  /*
   * 2. Send notification email to the owner.
   */
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      OWNER_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );

    console.log("Owner notification email sent.");
  } catch (error) {
    console.error(
      "Owner notification email failed:",
      error,
    );
  }
}

/**
 * Submit a new inquiry from the public website.
 */
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
  // Honeypot protection.
  if (data.honey) {
    return { ok: true as const };
  }

  const stamp = todayStamp();

  /*
   * Keep the existing reference-number system.
   */
  const existing = await getDocs(
    collection(db, "inquiries"),
  );

  const n = String(
    existing.size + 1,
  ).padStart(3, "0");

  const referenceNumber =
    `DIG-${stamp}-${n}`;

  const firstName =
    data.firstName.trim();

  const lastName =
    data.lastName.trim();

  const email =
    data.email.trim().toLowerCase();

  const phone =
    data.phone.trim();

  /*
   * First save the inquiry to Firestore.
   *
   * This happens BEFORE sending email so the inquiry
   * is safely stored even if EmailJS has a temporary problem.
   */
  await addDoc(
    collection(db, "inquiries"),
    {
      referenceNumber,

      firstName,

      lastName,

      email,

      phone,

      propertyAddress:
        data.propertyAddress.trim(),

      propertyType:
        data.propertyType.trim(),

      ownerName:
        data.ownerName.trim(),

      parcelPin:
        data.parcelPin.trim(),

      acreage:
        data.acreage.trim(),

      additionalNote:
        data.additionalNote.trim(),

      smsConsent:
        data.smsConsent,

      termsAccepted:
        data.termsAccepted,

      privacyAccepted:
        data.privacyAccepted,

      status: "New",

      submittedAt:
        serverTimestamp(),
    },
  );

  /*
   * Only after Firestore successfully saves the inquiry,
   * send the two EmailJS notifications.
   *
   * Email failures do NOT cause submitInquiry to fail.
   * This prevents visitors from accidentally creating
   * duplicate inquiries by submitting the form again.
   */
  await sendEmailNotifications({
    firstName,
    lastName,
    email,
    phone,
    referenceNumber,
  });

  return {
    ok: true as const,
  };
}

/**
 * Convert a Firestore document into the format
 * used by the Admin Dashboard.
 */
function mapDoc(
  d: QueryDocumentSnapshot<DocumentData>,
): SubmissionRow {
  const x = d.data();

  const submitted =
    x.submittedAt?.toDate?.() ??
    new Date();

  return {
    id: d.id,

    referenceNumber:
      String(
        x.referenceNumber ?? "",
      ),

    firstName:
      String(
        x.firstName ?? "",
      ),

    lastName:
      String(
        x.lastName ?? "",
      ),

    email:
      String(
        x.email ?? "",
      ),

    phone:
      String(
        x.phone ?? "",
      ),

    propertyAddress:
      String(
        x.propertyAddress ?? "",
      ),

    propertyType:
      String(
        x.propertyType ?? "",
      ),

    ownerName:
      String(
        x.ownerName ?? "",
      ),

    parcelPin:
      String(
        x.parcelPin ?? "",
      ),

    acreage:
      String(
        x.acreage ?? "",
      ),

    additionalNote:
      String(
        x.additionalNote ?? "",
      ),

    smsConsent:
      Boolean(x.smsConsent),

    termsAccepted:
      Boolean(x.termsAccepted),

    privacyAccepted:
      Boolean(x.privacyAccepted),

    status: (
      STATUSES as readonly string[]
    ).includes(x.status)
      ? (
          x.status as SubmissionStatus
        )
      : "New",

    submittedAt:
      submitted.toISOString(),
  };
}

/**
 * List inquiries using pagination.
 */
export async function listInquiriesPage(
  cursor?: QueryDocumentSnapshot<DocumentData>,
  status:
    | "all"
    | SubmissionStatus = "all",
) {
  const col =
    collection(
      db,
      "inquiries",
    );

  const filters =
    status === "all"
      ? [
          orderBy(
            "submittedAt",
            "desc",
          ),
          limit(PAGE_SIZE),
        ]
      : [
          where(
            "status",
            "==",
            status,
          ),
          orderBy(
            "submittedAt",
            "desc",
          ),
          limit(PAGE_SIZE),
        ];

  const q = cursor
    ? query(
        col,
        ...filters.slice(0, -1),
        startAfter(cursor),
        limit(PAGE_SIZE),
      )
    : query(
        col,
        ...filters,
      );

  const snap =
    await getDocs(q);

  const countSnap =
    await getCountFromServer(
      status === "all"
        ? query(col)
        : query(
            col,
            where(
              "status",
              "==",
              status,
            ),
          ),
    );

  return {
    rows:
      snap.docs.map(mapDoc),

    last:
      snap.docs[
        snap.docs.length - 1
      ] ?? null,

    total:
      countSnap.data().count,
  };
}

/**
 * Return the first page of inquiries.
 */
export async function listInquiries(): Promise<
  SubmissionRow[]
> {
  const { rows } =
    await listInquiriesPage();

  return rows;
}

/**
 * Get dashboard statistics.
 */
export async function getInquiryStats(): Promise<
  InquiryStats
> {
  const col =
    collection(
      db,
      "inquiries",
    );

  const totalSnap =
    await getCountFromServer(
      query(col),
    );

  const newSnap =
    await getCountFromServer(
      query(
        col,
        where(
          "status",
          "==",
          "New",
        ),
      ),
    );

  const qualifiedSnap =
    await getCountFromServer(
      query(
        col,
        where(
          "status",
          "==",
          "Qualified",
        ),
      ),
    );

  const notQualifiedSnap =
    await getCountFromServer(
      query(
        col,
        where(
          "status",
          "==",
          "Not Qualified",
        ),
      ),
    );

  const inProgressSnap =
    await getCountFromServer(
      query(
        col,
        where(
          "status",
          "==",
          "In Progress",
        ),
      ),
    );

  const completedSnap =
    await getCountFromServer(
      query(
        col,
        where(
          "status",
          "==",
          "Completed",
        ),
      ),
    );

  return {
    total:
      totalSnap.data().count,

    New:
      newSnap.data().count,

    Qualified:
      qualifiedSnap.data().count,

    "Not Qualified":
      notQualifiedSnap.data().count,

    "In Progress":
      inProgressSnap.data().count,

    Completed:
      completedSnap.data().count,
  };
}

/**
 * Search inquiries by reference number,
 * first name, or last name.
 */
export async function searchInquiries(
  term: string,
  status:
    | "all"
    | SubmissionStatus = "all",
): Promise<SubmissionRow[]> {
  const raw =
    term.trim();

  if (!raw) {
    return [];
  }

  const col =
    collection(
      db,
      "inquiries",
    );

  const lower =
    raw.toLowerCase();

  const upper =
    raw.toUpperCase();

  const lowerEnd =
    `${lower}\uf8ff`;

  const upperEnd =
    `${upper}\uf8ff`;

  const queries = [
    /*
     * Reference number search.
     */
    getDocs(
      query(
        col,
        where(
          "referenceNumber",
          ">=",
          upper,
        ),
        where(
          "referenceNumber",
          "<=",
          upperEnd,
        ),
        limit(PAGE_SIZE),
      ),
    ),

    /*
     * First name search.
     */
    getDocs(
      query(
        col,
        where(
          "firstName",
          ">=",
          raw,
        ),
        where(
          "firstName",
          "<=",
          `${raw}\uf8ff`,
        ),
        limit(PAGE_SIZE),
      ),
    ),

    /*
     * Last name search.
     */
    getDocs(
      query(
        col,
        where(
          "lastName",
          ">=",
          raw,
        ),
        where(
          "lastName",
          "<=",
          `${raw}\uf8ff`,
        ),
        limit(PAGE_SIZE),
      ),
    ),

    /*
     * Lowercase first-name search for records
     * that contain firstNameLower.
     */
    getDocs(
      query(
        col,
        where(
          "firstNameLower",
          ">=",
          lower,
        ),
        where(
          "firstNameLower",
          "<=",
          lowerEnd,
        ),
        limit(PAGE_SIZE),
      ),
    ),

    /*
     * Lowercase last-name search for records
     * that contain lastNameLower.
     */
    getDocs(
      query(
        col,
        where(
          "lastNameLower",
          ">=",
          lower,
        ),
        where(
          "lastNameLower",
          "<=",
          lowerEnd,
        ),
        limit(PAGE_SIZE),
      ),
    ),
  ];

  const snaps =
    await Promise.all(
      queries,
    );

  const byId =
    new Map<
      string,
      SubmissionRow
    >();

  for (const snap of snaps) {
    for (const d of snap.docs) {
      const row =
        mapDoc(d);

      if (
        status !== "all" &&
        row.status !== status
      ) {
        continue;
      }

      byId.set(
        row.id,
        row,
      );
    }
  }

  return [
    ...byId.values(),
  ].slice(
    0,
    PAGE_SIZE,
  );
}

/**
 * Export all inquiries for the Admin Dashboard CSV export.
 */
export async function exportAllInquiries(): Promise<
  SubmissionRow[]
> {
  const col =
    collection(
      db,
      "inquiries",
    );

  const q =
    query(
      col,
      orderBy(
        "submittedAt",
        "desc",
      ),
    );

  const snap =
    await getDocs(q);

  return snap.docs.map(
    mapDoc,
  );
}

/**
 * Update inquiry status.
 */
export async function updateInquiryStatus(
  id: string,
  status: SubmissionStatus,
) {
  await updateDoc(
    doc(
      db,
      "inquiries",
      id,
    ),
    {
      status,
    },
  );
}

/**
 * Delete an inquiry.
 */
export async function deleteInquiry(
  id: string,
) {
  await deleteDoc(
    doc(
      db,
      "inquiries",
      id,
    ),
  );
}
