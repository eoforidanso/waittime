import { useState, useEffect, type ReactNode } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import AmbulanceLogin from '../pages/AmbulanceLogin';

const SESSION_KEY = 'mediq_amb_auth';

export default function AmbulanceGuard({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  // Re-establish anonymous Firebase auth if session flag is set but no auth user
  useEffect(() => {
    if (authed && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }
  }, [authed]);

  if (!authed) {
    return <AmbulanceLogin onLogin={() => setAuthed(true)} />;
  }

  return <>{children}</>;
}
