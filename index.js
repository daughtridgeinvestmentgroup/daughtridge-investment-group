const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

setGlobalOptions({ region: "us-central1", maxInstances: 10 });
initializeApp();

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function text(value, max) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

exports.submitInquiry = onCall({ cors: true }, async (request) => {
  const data = request.data || {};
  if (data.honey) return { ok: true };

  const firstName = text(data.firstName, 80);
  const lastName = text(data.lastName, 80);
  const email = text(data.email, 160).toLowerCase();
  const phone = text(data.phone, 40);
  const propertyAddress = text(data.propertyAddress, 240);
  const propertyType = text(data.propertyType, 80);
  const ownerName = text(data.ownerName, 120);
  const parcelPin = text(data.parcelPin, 80);
  const acreage = text(data.acreage, 40);
  const additionalNote = text(data.additionalNote, 2000);

  if (!firstName || !lastName || !email || !phone || !propertyAddress) {
    throw new HttpsError("invalid-argument", "Please complete the required fields.");
  }
  if (!data.termsAccepted || !data.privacyAccepted) {
    throw new HttpsError("invalid-argument", "Terms and Privacy must be accepted.");
  }

  const db = getFirestore();
  const stamp = todayStamp();
  const counterRef = db.collection("counters").doc(stamp);
  const inquiryRef = db.collection("inquiries").doc();

  const referenceNumber = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const n = (snap.exists ? Number(snap.data().n) : 0) + 1;
    tx.set(counterRef, { n });
    tx.set(inquiryRef, {
      referenceNumber: `DIG-${stamp}-${String(n).padStart(3, "0")}`,
      firstName,
      lastName,
      firstNameLower: firstName.toLowerCase(),
      lastNameLower: lastName.toLowerCase(),
      email,
      phone,
      propertyAddress,
      propertyType,
      ownerName,
      parcelPin,
      acreage,
      additionalNote,
      smsConsent: Boolean(data.smsConsent),
      termsAccepted: true,
      privacyAccepted: true,
      status: "New",
      submittedAt: FieldValue.serverTimestamp(),
    });
    return `DIG-${stamp}-${String(n).padStart(3, "0")}`;
  });

  return { ok: true, referenceNumber };
});
