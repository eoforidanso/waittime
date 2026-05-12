import { useState, useEffect, type ReactNode } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import AmbulanceLogin from '../pages/AmbulanceLogin';

const SESSION_KEY  = 'mediq_amb_auth';
const EMS_EMAIL    = 'ems.dispatch@mediqgh.com';
const EMS_PASSWORD = 'MediQ-EMS-2026!';

export default function AmbulanceGuard({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  // Re-authenticate silently on page reload if session flag is present but auth is lost
  useEffect(() => {
    if (authed && !auth.currentUser) {
      signInWithEmailAndPassword(auth, EMS_EMAIL, EMS_PASSWORD).catch(() => {});
    }
  }, [authed]);

  if (!authed) {
    return <AmbulanceLogin onLogin={() => setAuthed(true)} />;
  }

  return <>{children}</>;
}
