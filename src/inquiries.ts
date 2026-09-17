import emailjs from "@emailjs/browser";
import {
  addDoc,
  collection,
  deleteDoc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  doc,
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

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}${m}${day}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // Send visitor confirmation email.
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      VISITOR_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );
  } catch (error) {
    console.error("Visitor confirmation email failed:", error);
  }

  // EmailJS limits requests to approximately one request per second.
  // Wait before sending the second email.
  await wait(1100);

  // Send owner notification email.
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      OWNER_TEMPLATE_ID,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      },
    );
  } catch (error) {
    console.error("Owner notification email failed:", error);
  }
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
  if (data.honey) return { ok: true as const };

  const existing = await getDocs(collection(db, "inquiries"));
  const n = String(existing.size + 1).padStart(3, "0");

  const referenceNumber = `DIG-${todayStamp()}-${n}`;

  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone.trim();

  await addDoc(collection(db, "inquiries"), {
    referenceNumber,
    firstName,
    lastName,
    email,
    phone,
    propertyAddress: data.propertyAddress.trim(),
    propertyType: data.propertyType.trim(),
    ownerName: data.ownerName.trim(),
    parcelPin: data.parcelPin.trim(),
    acreage: data.acreage.trim(),
    additionalNote: data.additionalNote.trim(),
    smsConsent: data.smsConsent,
    termsAccepted: data.termsAccepted,
    privacyAccepted: data.privacyAccepted,
    status: "New",
    submittedAt: serverTimestamp(),
  });

  // Send emails only after the Firestore submission succeeds.
  // Email failures will not make the visitor resubmit the form,
  // which helps prevent duplicate inquiries.
  await sendEmailNotifications({
    firstName,
    lastName,
    email,
    phone,
    referenceNumber,
  });

  return { ok: true as const };
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

export async function listInquiriesPage(
  cursor?: QueryDocumentSnapshot<DocumentData>,
  status: "all" | SubmissionStatus = "all",
) {
  const col = collection(db, "inquiries");

  const filters =
    status === "all"
      ? [orderBy("submittedAt", "desc"), limit(PAGE_SIZE)]
      : [
          where("status", "==", status),
          orderBy("submittedAt", "desc"),
          limit(PAGE_SIZE),
        ];

  const q = cursor
    ? query(
        col,
        ...filters.slice(0, -1),
        startAfter(cursor),
        limit(PAGE_SIZE),
      )
    : query(col, ...filters);

  const snap = await getDocs(q);

  const countSnap = await getCountFromServer(
    status === "all" ? query(col) : query(col, where("status", "==", status)),
  );

  return {
    rows: snap.docs.map(mapDoc),
    last: snap.docs[snap.docs.length - 1] ?? null,
    total: countSnap.data().count,
  };
}

export async function listInquiries(): Promise<SubmissionRow[]> {
  const { rows } = await listInquiriesPage();
  return rows;
}

export async function updateInquiryStatus(
  id: string,
  status: SubmissionStatus,
) {
  await updateDoc(doc(db, "inquiries", id), { status });
}

export async function deleteInquiry(id: string) {
  await deleteDoc(doc(db, "inquiries", id));
}
