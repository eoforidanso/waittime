import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, doc, onSnapshot, addDoc,
  orderBy, query, setDoc, limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Users } from 'lucide-react';
import type { StaffUser, StaffRole } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  fromUid: string;
  fromName: string;
  text: string;
  timestamp: number;
}

interface ChatMeta {
  lastMessage?: string;
  lastTimestamp?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Reception',
  ems: 'EMS',
};

function formatMsgTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StaffMessages() {
  const { user, staffProfile, listStaffUsers } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('team');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [lastRead, setLastRead] = useState<Record<string, number>>({});
  const [chatMeta, setChatMeta] = useState<Record<string, ChatMeta>>({});
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load all staff
  useEffect(() => {
    if (!user) return;
    listStaffUsers().then(setStaff).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to lastRead for current user
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'staffChatLastRead', user.uid), snap => {
      if (snap.exists()) setLastRead(snap.data() as Record<string, number>);
    });
    return () => unsub();
  }, [user]);

  // Subscribe to all chat metadata (for last message preview + unread)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'staffChats'), snap => {
      const meta: Record<string, ChatMeta> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.lastMessage) meta[d.id] = { lastMessage: data.lastMessage, lastTimestamp: data.lastTimestamp };
      });
      setChatMeta(meta);
    });
    return () => unsub();
  }, [user]);

  // Subscribe to active chat messages
  useEffect(() => {
    if (!user || !activeChatId) return;
    const q = query(
      collection(db, 'staffChats', activeChatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(150),
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [user, activeChatId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark active chat as read
  useEffect(() => {
    if (!user || !activeChatId) return;
    const now = Date.now();
    setDoc(doc(db, 'staffChatLastRead', user.uid), { [activeChatId]: now }, { merge: true }).catch(() => {});
    setLastRead(prev => ({ ...prev, [activeChatId]: now }));
  }, [user, activeChatId]);

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const send = useCallback(async () => {
    if (!text.trim() || !user || !staffProfile || sending) return;
    setSending(true);
    const msgData = {
      fromUid: user.uid,
      fromName: staffProfile.displayName,
      text: text.trim(),
      timestamp: Date.now(),
    };
    const preview = `${staffProfile.displayName}: ${text.trim().slice(0, 60)}${text.trim().length > 60 ? '…' : ''}`;
    try {
      await addDoc(collection(db, 'staffChats', activeChatId, 'messages'), msgData);
      await setDoc(doc(db, 'staffChats', activeChatId), {
        lastMessage: preview,
        lastTimestamp: Date.now(),
      }, { merge: true });
      // Mark as read immediately for sender
      setDoc(doc(db, 'staffChatLastRead', user.uid), { [activeChatId]: Date.now() }, { merge: true }).catch(() => {});
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  }, [text, user, staffProfile, activeChatId, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Build sidebar chat list
  const otherStaff = staff.filter(s => s.uid !== user?.uid);

  const isUnread = (chatId: string) => {
    const ts = chatMeta[chatId]?.lastTimestamp ?? 0;
    return ts > 0 && (!lastRead[chatId] || ts > lastRead[chatId]);
  };

  const totalUnread = ['team', ...otherStaff.map(s => getChatId(user!.uid, s.uid))].filter(id => isUnread(id)).length;

  const activeChatLabel =
    activeChatId === 'team'
      ? 'Team Chat'
      : staff.find(s => getChatId(user!.uid, s.uid) === activeChatId)?.displayName ?? 'Direct Message';

  const activeChatPerson =
    activeChatId !== 'team'
      ? staff.find(s => getChatId(user!.uid, s.uid) === activeChatId)
      : null;

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const label = formatDateLabel(msg.timestamp);
    if (!grouped.length || grouped[grouped.length - 1].date !== label) {
      grouped.push({ date: label, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  });

  return (
    <div className="messages-page">
      {/* ── Left panel ── */}
      <div className="messages-sidebar">
        <div className="messages-sidebar-header">
          <MessageSquare size={16} />
          <span>Staff Messages</span>
          {totalUnread > 0 && <span className="messages-total-unread">{totalUnread}</span>}
        </div>

        <div className="messages-chat-list">
          {/* Team broadcast */}
          <button
            className={`messages-chat-item${activeChatId === 'team' ? ' active' : ''}`}
            onClick={() => setActiveChatId('team')}
          >
            <div className="messages-chat-avatar group">
              <Users size={15} />
            </div>
            <div className="messages-chat-info">
              <div className="messages-chat-name">Team Chat</div>
              {chatMeta['team']?.lastMessage && (
                <div className="messages-chat-preview">{chatMeta['team'].lastMessage}</div>
              )}
            </div>
            {isUnread('team') && <span className="messages-unread-dot" />}
          </button>

          {/* Divider */}
          {otherStaff.length > 0 && <div className="messages-list-divider">Direct Messages</div>}

          {/* Per-staff DMs */}
          {otherStaff.map(s => {
            const cid = getChatId(user!.uid, s.uid);
            return (
              <button
                key={cid}
                className={`messages-chat-item${activeChatId === cid ? ' active' : ''}`}
                onClick={() => setActiveChatId(cid)}
              >
                <div className="messages-chat-avatar">
                  {s.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="messages-chat-info">
                  <div className="messages-chat-name">{s.displayName}</div>
                  <div className="messages-chat-role">{ROLE_LABELS[s.role]}</div>
                  {chatMeta[cid]?.lastMessage && (
                    <div className="messages-chat-preview">{chatMeta[cid].lastMessage}</div>
                  )}
                </div>
                {isUnread(cid) && <span className="messages-unread-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main chat panel ── */}
      <div className="messages-main">
        {/* Header */}
        <div className="messages-header">
          <div className="messages-header-avatar">
            {activeChatId === 'team' ? <Users size={18} /> : activeChatLabel.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="messages-header-name">{activeChatLabel}</div>
            {activeChatPerson && (
              <div className="messages-header-sub">{ROLE_LABELS[activeChatPerson.role]}</div>
            )}
            {activeChatId === 'team' && (
              <div className="messages-header-sub">Visible to all staff</div>
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="messages-body">
          {messages.length === 0 && (
            <div className="messages-empty">
              <MessageSquare size={36} />
              <p>No messages yet. Start the conversation.</p>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.date}>
              <div className="messages-date-divider">
                <span>{group.date}</span>
              </div>
              {group.msgs.map((msg, idx) => {
                const isOwn = msg.fromUid === user?.uid;
                const showSender = !isOwn && (idx === 0 || group.msgs[idx - 1].fromUid !== msg.fromUid);
                return (
                  <div key={msg.id} className={`messages-bubble-wrap${isOwn ? ' own' : ''}`}>
                    {showSender && (
                      <div className="messages-bubble-sender">{msg.fromName}</div>
                    )}
                    <div className={`messages-bubble${isOwn ? ' own' : ''}`}>
                      <span className="messages-bubble-text">{msg.text}</span>
                      <span className="messages-bubble-time">{formatMsgTime(msg.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="messages-input-row">
          <textarea
            ref={el => { (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el; (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el; }}
            className="messages-input"
            placeholder="Message… (Enter to send, Shift+Enter for new line)"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="messages-send-btn"
            onClick={send}
            disabled={!text.trim() || sending}
            title="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
