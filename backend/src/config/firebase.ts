import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

function resolveLocalServiceAccountPath() {
  const candidates = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(process.cwd(), "backend", "serviceAccountKey.json"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createCredential() {
  const localServiceAccountPath = resolveLocalServiceAccountPath();

  if (localServiceAccountPath) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(localServiceAccountPath, "utf8")
    ) as admin.ServiceAccount;

    return admin.credential.cert(serviceAccount);
  }

  // In Cloud Run, ADC uses the service account assigned to the service.
  return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: createCredential(),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
