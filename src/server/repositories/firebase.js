import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../../../firebaseConfig.js";

const firebaseApp = initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);
