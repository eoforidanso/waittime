import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

/**
 * Returns the total number of chats with unread messages for the current user.
 * Used by the Sidebar to show a badge on the Team tab.
 */
export function useMessagesBadge(): number {
  const { user } = useAuth();
  const [lastRead, setLastRead] = useState<Record<string, number>>({});
  const [chatTimestamps, setChatTimestamps] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'staffChatLastRead', user.uid), snap => {
      setLastRead(snap.exists() ? (snap.data() as Record<string, number>) : {});
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'staffChats'), snap => {
      const ts: Record<string, number> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.lastTimestamp) ts[d.id] = data.lastTimestamp;
      });
      setChatTimestamps(ts);
    });
    return () => unsub();
  }, [user]);

  let count = 0;
  Object.entries(chatTimestamps).forEach(([chatId, ts]) => {
    if (!lastRead[chatId] || ts > lastRead[chatId]) count++;
  });
  return count;
}
