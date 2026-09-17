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

/*
 * ============================================================
 * EMAILJS CONFIGURATION
 * ============================================================
 */

const EMAILJS_PUBLIC_KEY = "W75quHyvj2dmS3fJf";
const EMAILJS_SERVICE_ID = "service_h6p6cj";

const VISITOR_TEMPLATE_ID = "template_rfrtxl9";
const OWNER_TEMPLATE_ID = "template_ttp3d8n";

/*
 * ============================================================
 * GENERAL CONFIGURATION
 * ============================================================
 */

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

export type SubmissionStatus =
  (typeof STATUSES)[number];

/*
 * ============================================================
 * INQUIRY TYPES
 * ============================================================
 */

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

/*
 * ============================================================
 * REFERENCE NUMBER
 * ============================================================
 *
 * IMPORTANT:
 * We do NOT read the inquiries collection here.
 *
 * Visitors are not allowed to read inquiries according to
 * the Firestore security rules.
 *
 * The old method attempted to count existing inquiries first,
 * which caused the public form submission to fail.
 *
 * New reference format:
 *
 * DIG-YYYYMMDD-HHMMSS-XX
 *
 * Example:
 *
 * DIG-20260918-061245-37
 *
 * Existing reference numbers in the database remain unchanged.
 */

function createReferenceNumber() {
  const d = new Date();

  const year =
    d.getFullYear();

  const month =
    String(
      d.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      d.getDate(),
    ).padStart(2, "0");

  const hours =
    String(
      d.getHours(),
    ).padStart(2, "0");

  const minutes =
    String(
      d.getMinutes(),
    ).padStart(2, "0");

  const seconds =
    String(
      d.getSeconds(),
    ).padStart(2, "0");

  const random =
    String(
      Math.floor(
        Math.random() * 100,
      ),
    ).padStart(2, "0");

  return `DIG-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

/*
 * ============================================================
 * EMAILJS RATE-LIMIT DELAY
 * ============================================================
 */

function wait(
  ms: number,
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}

/*
 * ============================================================
 * EMAIL NOTIFICATIONS
 * ============================================================
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
  /*
   * Use Eastern Time because Daughtridge Investment Group LLC
   * is based in North Carolina.
   */
  const dateTime =
    new Date().toLocaleString(
      "en-US",
      {
        timeZone:
          "America/New_York",
        dateStyle:
          "long",
        timeStyle:
          "short",
      },
    );

  /*
   * These variable names match the EmailJS templates.
   */
  const templateParams = {
    first_name:
      firstName,

    last_name:
      lastName,

    email,

    phone,

    reference_number:
      referenceNumber,

    date_time:
      dateTime,
  };

  /*
   * ----------------------------------------------------------
   * 1. VISITOR CONFIRMATION EMAIL
   * ----------------------------------------------------------
   */

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      VISITOR_TEMPLATE_ID,
      templateParams,
      {
        publicKey:
          EMAILJS_PUBLIC_KEY,
      },
    );

    console.log(
      "Visitor confirmation email sent.",
    );
  } catch (error) {
    /*
     * Do not fail the form submission if EmailJS fails.
     *
     * The Firestore inquiry has already been saved.
     */
    console.error(
      "Visitor confirmation email failed:",
      error,
    );
  }

  /*
   * EmailJS has a request rate limit.
   * Wait before sending the second email.
   */
  await wait(1100);

  /*
   * ----------------------------------------------------------
   * 2. OWNER NOTIFICATION EMAIL
   * ----------------------------------------------------------
   */

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      OWNER_TEMPLATE_ID,
      templateParams,
      {
        publicKey:
          EMAILJS_PUBLIC_KEY,
      },
    );

    console.log(
      "Owner notification email sent.",
    );
  } catch (error) {
    /*
     * Again, do not make the visitor resubmit the form
     * if the notification email fails.
     */
    console.error(
      "Owner notification email failed:",
      error,
    );
  }
}

/*
 * ============================================================
 * SUBMIT INQUIRY
 * ============================================================
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
  /*
   * Honeypot protection.
   */
  if (data.honey) {
    return {
      ok: true as const,
    };
  }

  /*
   * Clean the submitted values.
   */
  const firstName =
    data.firstName.trim();

  const lastName =
    data.lastName.trim();

  const email =
    data.email
      .trim()
      .toLowerCase();

  const phone =
    data.phone.trim();

  const propertyAddress =
    data.propertyAddress.trim();

  const propertyType =
    data.propertyType.trim();

  const ownerName =
    data.ownerName.trim();

  const parcelPin =
    data.parcelPin.trim();

  const acreage =
    data.acreage.trim();

  const additionalNote =
    data.additionalNote.trim();

  /*
   * Generate the reference number WITHOUT reading Firestore.
   *
   * This is the important fix that allows a public visitor
   * to submit while keeping inquiries private.
   */
  const referenceNumber =
    createReferenceNumber();

  /*
   * Save the inquiry to Firestore first.
   */
  await addDoc(
    collection(
      db,
      "inquiries",
    ),
    {
      referenceNumber,

      firstName,

      lastName,

      /*
       * Store lowercase versions to support Admin search.
       */
      firstNameLower:
        firstName.toLowerCase(),

      lastNameLower:
        lastName.toLowerCase(),

      email,

      phone,

      propertyAddress,

      propertyType,

      ownerName,

      parcelPin,

      acreage,

      additionalNote,

      smsConsent:
        data.smsConsent,

      termsAccepted:
        data.termsAccepted,

      privacyAccepted:
        data.privacyAccepted,

      status:
        "New",

      submittedAt:
        serverTimestamp(),
    },
  );

  /*
   * Firestore has successfully saved the inquiry.
   *
   * Now send the two EmailJS messages.
   *
   * Email failures are handled internally so the visitor
   * does not get told to submit the form again.
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

/*
 * ============================================================
 * MAP FIRESTORE DOCUMENT
 * ============================================================
 */

function mapDoc(
  d: QueryDocumentSnapshot<DocumentData>,
): SubmissionRow {
  const x =
    d.data();

  const submitted =
    x.submittedAt?.toDate?.() ??
    new Date();

  return {
    id:
      d.id,

    referenceNumber:
      String(
        x.referenceNumber ??
          "",
      ),

    firstName:
      String(
        x.firstName ??
          "",
      ),

    lastName:
      String(
        x.lastName ??
          "",
      ),

    email:
      String(
        x.email ??
          "",
      ),

    phone:
      String(
        x.phone ??
          "",
      ),

    propertyAddress:
      String(
        x.propertyAddress ??
          "",
      ),

    propertyType:
      String(
        x.propertyType ??
          "",
      ),

    ownerName:
      String(
        x.ownerName ??
          "",
      ),

    parcelPin:
      String(
        x.parcelPin ??
          "",
      ),

    acreage:
      String(
        x.acreage ??
          "",
      ),

    additionalNote:
      String(
        x.additionalNote ??
          "",
      ),

    smsConsent:
      Boolean(
        x.smsConsent,
      ),

    termsAccepted:
      Boolean(
        x.termsAccepted,
      ),

    privacyAccepted:
      Boolean(
        x.privacyAccepted,
      ),

    status: (
      STATUSES as readonly string[]
    ).includes(
      x.status,
    )
      ? (
          x.status as SubmissionStatus
        )
      : "New",

    submittedAt:
      submitted.toISOString(),
  };
}

/*
 * ============================================================
 * PAGINATED INQUIRIES
 * ============================================================
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
          limit(
            PAGE_SIZE,
          ),
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
          limit(
            PAGE_SIZE,
          ),
        ];

  const q =
    cursor
      ? query(
          col,
          ...filters.slice(
            0,
            -1,
          ),
          startAfter(
            cursor,
          ),
          limit(
            PAGE_SIZE,
          ),
        )
      : query(
          col,
          ...filters,
        );

  const snap =
    await getDocs(q);

  /*
   * Only the authenticated owner can reach this function
   * from the Admin Dashboard.
   */
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
      snap.docs.map(
        mapDoc,
      ),

    last:
      snap.docs[
        snap.docs.length - 1
      ] ?? null,

    total:
      countSnap.data().count,
  };
}

/*
 * ============================================================
 * FIRST PAGE OF INQUIRIES
 * ============================================================
 */

export async function listInquiries(): Promise<
  SubmissionRow[]
> {
  const {
    rows,
  } =
    await listInquiriesPage();

  return rows;
}

/*
 * ============================================================
 * DASHBOARD STATISTICS
 * ============================================================
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

/*
 * ============================================================
 * SEARCH INQUIRIES
 * ============================================================
 *
 * Owner/Admin search only.
 *
 * Searches:
 * - Reference Number
 * - First Name
 * - Last Name
 *
 * Does NOT download the entire collection.
 */

export async function searchInquiries(
  term: string,
  status:
    | "all"
    | SubmissionStatus = "all",
): Promise<
  SubmissionRow[]
> {
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
     * Reference number.
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
        limit(
          PAGE_SIZE,
        ),
      ),
    ),

    /*
     * First name.
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
        limit(
          PAGE_SIZE,
        ),
      ),
    ),

    /*
     * Last name.
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
        limit(
          PAGE_SIZE,
        ),
      ),
    ),

    /*
     * Lowercase first name.
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
        limit(
          PAGE_SIZE,
        ),
      ),
    ),

    /*
     * Lowercase last name.
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
        limit(
          PAGE_SIZE,
        ),
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

  for (
    const snap of snaps
  ) {
    for (
      const d of snap.docs
    ) {
      const row =
        mapDoc(d);

      if (
        status !== "all" &&
        row.status !==
          status
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

/*
 * ============================================================
 * EXPORT ALL INQUIRIES
 * ============================================================
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

/*
 * ============================================================
 * UPDATE INQUIRY STATUS
 * ============================================================
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

/*
 * ============================================================
 * DELETE INQUIRY
 * ============================================================
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
