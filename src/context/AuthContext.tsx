import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth as getSecondaryAuth,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logAudit } from '../utils/auditLog';

// ─── Types ──────────────────────────────────────────────────────────────────
export type StaffRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'ems';

export interface StaffUser {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  facilityId?: string;
  createdAt: string | number;
  isOnline?: boolean;
}

interface AuthContextType {
  user: User | null;
  staffProfile: StaffUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createStaffAccount: (email: string, password: string, displayName: string, role: StaffRole, facilityId?: string) => Promise<void>;
  updateStaffRole: (uid: string, role: StaffRole) => Promise<void>;
  deleteStaffAccount: (uid: string) => Promise<void>;
  setOnlineStatus: (uid: string, isOnline: boolean) => Promise<void>;
  listStaffUsers: () => Promise<StaffUser[]>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Firestore profile when auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileSnap = await getDoc(doc(db, 'staff', firebaseUser.uid));
        if (profileSnap.exists()) {
          setStaffProfile(profileSnap.data() as StaffUser);
        } else {
          setStaffProfile(null);
        }
      } else {
        setStaffProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setStaffProfile(null);
  };

  const setOnlineStatus = async (uid: string, isOnline: boolean) => {
    await setDoc(doc(db, 'staff', uid), { isOnline }, { merge: true });
    if (staffProfile) {
      logAudit({ uid: staffProfile.uid, displayName: staffProfile.displayName }, isOnline ? 'Staff Set Online' : 'Staff Set Offline', `UID ${uid}`);
    }
  };

  // Only admins call this — creates a new Firebase Auth user + Firestore doc
  const createStaffAccount = async (
    email: string,
    password: string,
    displayName: string,
    role: StaffRole,
    facilityId?: string,
  ) => {
    // Firebase Auth doesn't support creating secondary users from the client
    // without signing them in, so we use a secondary auth instance trick.
    // The admin stays logged in; the new user's record is created in Firestore.
    const createSecondary = createUserWithEmailAndPassword;

    // Create a temporary secondary app so we don't log out the admin
    const secondaryApp = initializeApp(auth.app.options, `secondary-${Date.now()}`);
    const secondaryAuth = getSecondaryAuth(secondaryApp);

    try {
      const cred = await createSecondary(secondaryAuth, email, password);
      await updateProfile(cred.user, { displayName });

      const profile: StaffUser = {
        uid: cred.user.uid,
        email,
        displayName,
        role,
        ...(facilityId ? { facilityId } : {}),
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'staff', cred.user.uid), profile);
      await secondaryAuth.signOut();
      // Audit the creation — use the admin who is currently logged in
      if (staffProfile) {
        logAudit({ uid: staffProfile.uid, displayName: staffProfile.displayName }, 'Staff Account Created', `${displayName} (${email}) — role: ${role}${facilityId ? ` — facility: ${facilityId}` : ''}`);
      }
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const updateStaffRole = async (uid: string, role: StaffRole) => {
    await setDoc(doc(db, 'staff', uid), { role }, { merge: true });
    if (staffProfile?.uid === uid) {
      setStaffProfile(prev => prev ? { ...prev, role } : prev);
    }
    if (staffProfile) {
      logAudit({ uid: staffProfile.uid, displayName: staffProfile.displayName }, 'Staff Role Updated', `UID ${uid} → ${role}`);
    }
  };

  const deleteStaffAccount = async (uid: string) => {
    await deleteDoc(doc(db, 'staff', uid));
    if (staffProfile) {
      logAudit({ uid: staffProfile.uid, displayName: staffProfile.displayName }, 'Staff Account Removed', `UID ${uid}`);
    }
    // Note: deleting the Firebase Auth account requires Admin SDK (server-side).
    // The Firestore profile is removed; the user won't be able to see any data.
  };

  const listStaffUsers = async (): Promise<StaffUser[]> => {
    const snap = await getDocs(collection(db, 'staff'));
    return snap.docs.map(d => d.data() as StaffUser);
  };

  const isAdmin = staffProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user, staffProfile, loading,
      signIn, signOut,
      createStaffAccount, updateStaffRole, deleteStaffAccount, setOnlineStatus, listStaffUsers,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
