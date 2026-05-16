import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Client-side config — safe to commit. Firebase Security Rules protect your data, not secrecy of these keys.
// Fill in from: Firebase Console → Project Settings → Your apps → Web app → SDK setup and configuration.
const firebaseConfig = {
  apiKey:            "AIzaSyD28b3gNOgGT5HGgXttuotbj2eN9TqJI30",
  authDomain:        "courtdraw.firebaseapp.com",
  projectId:         "courtdraw",
  storageBucket:     "courtdraw.firebasestorage.app",
  messagingSenderId: "724578677537",
  appId:             "1:724578677537:web:142626ae3ae1949fba4460"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
