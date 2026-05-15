import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function registerUser(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    plan: 'free',
    stripeCustomerId: null,
    createdAt: new Date().toISOString()
  });

  return user;
}

export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  return signOut(auth);
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function getUserPlan(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().plan : 'free';
}

export function requireAuth(redirectTo = '/login.html') {
  auth.onAuthStateChanged(user => {
    if (!user) window.location.href = redirectTo;
  });
}
