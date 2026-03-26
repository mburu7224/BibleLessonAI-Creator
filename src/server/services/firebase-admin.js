import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env, getFirebaseAdminConfig } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

let cachedApp = null;

export function getFirebaseAdminApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const credentials = getFirebaseAdminConfig();
  if (!credentials.projectId || !credentials.clientEmail || !credentials.privateKey) {
    throw new HttpError(
      503,
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  cachedApp = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(credentials),
        projectId: credentials.projectId
      });

  return cachedApp;
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getPublicFirebaseConfig() {
  return {
    apiKey: env.firebaseWebApiKey,
    authDomain: env.firebaseAuthDomain,
    storageBucket: env.firebaseStorageBucket,
    messagingSenderId: env.firebaseMessagingSenderId,
    appId: env.firebaseAppId,
    measurementId: env.firebaseMeasurementId
  };
}
