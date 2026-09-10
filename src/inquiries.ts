import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  serverTimestamp,
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
  await addDoc(collection(db, "inquiries"), {
    referenceNumber: `DIG-${todayStamp()}-${n}`,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
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
  return { ok: true as const };
}

export async function listInquiries(): Promise<SubmissionRow[]> {
  const snap = await getDocs(
    query(collection(db, "inquiries"), orderBy("submittedAt", "desc")),
  );
  return snap.docs.map((d) => {
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
  });
}

export async function updateInquiryStatus(id: string, status: SubmissionStatus) {
  await updateDoc(doc(db, "inquiries", id), { status });
}
