import { useState, type ReactNode } from 'react';
import AmbulanceLogin from '../pages/AmbulanceLogin';

const SESSION_KEY = 'mediq_amb_auth';

export default function AmbulanceGuard({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  if (!authed) {
    return <AmbulanceLogin onLogin={() => setAuthed(true)} />;
  }

  return <>{children}</>;
}
