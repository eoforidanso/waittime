import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteField,
  orderBy, query, setDoc, limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare, Send, Users, Search, X, AlertTriangle,
  Pin, Trash2, Stethoscope, Heart, Truck, Phone, CheckCheck,
} from 'lucide-react';
import type { StaffUser, StaffRole } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  fromUid: string;
  fromName: string;
  text: string;
  timestamp: number;
  urgent?: boolean;
  deleted?: boolean;
}

interface ChatMeta {
  lastMessage?: string;
  lastTimestamp?: number;
  pinnedMsg?: { id: string; text: string; fromName: string } | null;
}

// ─── Pre-defined group chats ──────────────────────────────────────────────────
type GroupChat = {
  id: string;
  label: string;
  sub: string;
  color: string;
  icon: React.ComponentType<{ size?: number }>;
};

const GROUP_CHATS: GroupChat[] = [
  { id: 'team',             label: 'Team Chat',  sub: 'All staff',         color: '#6366f1', icon: Users },
  { id: 'group_doctors',    label: 'Doctors',    sub: 'Medical team',      color: '#10b981', icon: Stethoscope },
  { id: 'group_nurses',     label: 'Nurses',     sub: 'Nursing team',      color: '#3b82f6', icon: Heart },
  { id: 'group_ems',        label: 'EMS Team',   sub: 'Emergency svcs',    color: '#f59e0b', icon: Truck },
  { id: 'group_reception',  label: 'Reception',  sub: 'Reception staff',   color: '#8b5cf6', icon: Phone },
];

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

const isGroupChat = (id: string) => id === 'team' || id.startsWith('group_');

// ─── Component ────────────────────────────────────────────────────────────────
export default function StaffMessages() {
  const { user, staffProfile, listStaffUsers } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('team');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [lastRead, setLastRead] = useState<Record<string, number>>({});
  const [otherLastRead, setOtherLastRead] = useState<number>(0);
  const [chatMeta, setChatMeta] = useState<Record<string, ChatMeta>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all staff
  useEffect(() => {
    if (!user) return;
    listStaffUsers().then(setStaff).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to current user's lastRead timestamps
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'staffChatLastRead', user.uid), snap => {
      setLastRead(snap.exists() ? (snap.data() as Record<string, number>) : {});
    });
    return () => unsub();
  }, [user]);

  // Subscribe to all chat metadata
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'staffChats'), snap => {
      const meta: Record<string, ChatMeta> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        meta[d.id] = {
          lastMessage: data.lastMessage,
          lastTimestamp: data.lastTimestamp,
          pinnedMsg: data.pinnedMsg ?? null,
        };
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
      limit(200),
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [user, activeChatId]);

  // Subscribe to typing indicators for active chat
  useEffect(() => {
    if (!user || !activeChatId) return;
    const unsub = onSnapshot(doc(db, 'staffTyping', activeChatId), snap => {
      if (!snap.exists()) { setTypingUsers([]); return; }
      const data = snap.data() as Record<string, { name: string; ts: number }>;
      const now = Date.now();
      const active = Object.entries(data)
        .filter(([uid, v]) => uid !== user.uid && v.ts > now - 5000)
        .map(([, v]) => v.name);
      setTypingUsers(active);
    });
    // Clear own typing indicator when switching chats
    return () => {
      unsub();
      updateDoc(doc(db, 'staffTyping', activeChatId), { [user.uid]: deleteField() }).catch(() => {});
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [user, activeChatId]);

  // Subscribe to other user's lastRead for DM read receipts
  useEffect(() => {
    if (!user) return;
    if (isGroupChat(activeChatId)) { setOtherLastRead(0); return; }
    const otherUid = activeChatId.split('_').find(p => p !== user.uid) ?? '';
    if (!otherUid) return;
    const unsub = onSnapshot(doc(db, 'staffChatLastRead', otherUid), snap => {
      const data = snap.exists() ? (snap.data() as Record<string, number>) : {};
      setOtherLastRead(data[activeChatId] ?? 0);
    });
    return () => unsub();
  }, [user, activeChatId]);

  // Scroll to bottom on new messages
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

  // Handle text input + typing indicator
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;

    if (user && staffProfile) {
      setDoc(doc(db, 'staffTyping', activeChatId), {
        [user.uid]: { name: staffProfile.displayName, ts: Date.now() },
      }, { merge: true }).catch(() => {});
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        updateDoc(doc(db, 'staffTyping', activeChatId), { [user.uid]: deleteField() }).catch(() => {});
      }, 3000);
    }
  };

  const send = useCallback(async () => {
    if (!text.trim() || !user || !staffProfile || sending) return;
    setSending(true);
    // Clear typing immediately
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    updateDoc(doc(db, 'staffTyping', activeChatId), { [user.uid]: deleteField() }).catch(() => {});

    const msgData: Omit<Message, 'id'> = {
      fromUid: user.uid,
      fromName: staffProfile.displayName,
      text: text.trim(),
      timestamp: Date.now(),
      ...(urgent ? { urgent: true } : {}),
    };
    const urgentPrefix = urgent ? '🔴 URGENT — ' : '';
    const preview = `${urgentPrefix}${staffProfile.displayName}: ${text.trim().slice(0, 60)}${text.trim().length > 60 ? '…' : ''}`;
    try {
      await addDoc(collection(db, 'staffChats', activeChatId, 'messages'), msgData);
      await setDoc(doc(db, 'staffChats', activeChatId), {
        lastMessage: preview,
        lastTimestamp: Date.now(),
      }, { merge: true });
      setDoc(doc(db, 'staffChatLastRead', user.uid), { [activeChatId]: Date.now() }, { merge: true }).catch(() => {});
      setText('');
      setUrgent(false);
      if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.focus(); }
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  }, [text, user, staffProfile, activeChatId, sending, urgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleDeleteMessage = async (msg: Message) => {
    if (msg.fromUid !== user?.uid) return;
    await updateDoc(doc(db, 'staffChats', activeChatId, 'messages', msg.id), {
      deleted: true,
      text: '',
    }).catch(() => {});
  };

  const handlePinMessage = async (msg: Message) => {
    const current = chatMeta[activeChatId]?.pinnedMsg;
    const newPin = current?.id === msg.id
      ? null
      : { id: msg.id, text: msg.text.slice(0, 100), fromName: msg.fromName };
    await setDoc(doc(db, 'staffChats', activeChatId), { pinnedMsg: newPin }, { merge: true }).catch(() => {});
  };

  const otherStaff = staff.filter(s => s.uid !== user?.uid);

  const isUnread = (chatId: string) => {
    const ts = chatMeta[chatId]?.lastTimestamp ?? 0;
    return ts > 0 && (!lastRead[chatId] || ts > lastRead[chatId]);
  };

  const totalUnread = [
    ...GROUP_CHATS.map(g => g.id),
    ...otherStaff.map(s => getChatId(user!.uid, s.uid)),
  ].filter(id => isUnread(id)).length;

  const activeGroup = GROUP_CHATS.find(g => g.id === activeChatId);
  const activePerson = !activeGroup
    ? staff.find(s => getChatId(user!.uid, s.uid) === activeChatId)
    : null;
  const activeChatLabel = activeGroup?.label ?? activePerson?.displayName ?? 'Chat';
  const pinnedMsg = chatMeta[activeChatId]?.pinnedMsg;

  // Filter by search
  const visibleMessages = searchQuery.trim()
    ? messages.filter(m => !m.deleted && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Group by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  visibleMessages.forEach(msg => {
    const label = formatDateLabel(msg.timestamp);
    if (!grouped.length || grouped[grouped.length - 1].date !== label) {
      grouped.push({ date: label, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  });

  // Last sent message for read receipt
  const lastSentMsg = [...messages].reverse().find(m => m.fromUid === user?.uid && !m.deleted);

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
          <div className="messages-list-divider">Channels</div>

          {GROUP_CHATS.map(g => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                className={`messages-chat-item${activeChatId === g.id ? ' active' : ''}`}
                onClick={() => setActiveChatId(g.id)}
              >
                <div className="messages-chat-avatar group" style={{ background: `${g.color}22`, color: g.color }}>
                  <Icon size={15} />
                </div>
                <div className="messages-chat-info">
                  <div className="messages-chat-name">{g.label}</div>
                  {chatMeta[g.id]?.lastMessage
                    ? <div className="messages-chat-preview">{chatMeta[g.id].lastMessage}</div>
                    : <div className="messages-chat-role">{g.sub}</div>
                  }
                </div>
                {isUnread(g.id) && <span className="messages-unread-dot" />}
              </button>
            );
          })}

          {otherStaff.length > 0 && <div className="messages-list-divider">Direct Messages</div>}

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
                  {chatMeta[cid]?.lastMessage
                    ? <div className="messages-chat-preview">{chatMeta[cid].lastMessage}</div>
                    : <div className="messages-chat-role">{ROLE_LABELS[s.role]}</div>
                  }
                </div>
                {isUnread(cid) && <span className="messages-unread-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="messages-main">
        {/* Header */}
        <div className="messages-header">
          <div
            className="messages-header-avatar"
            style={activeGroup ? { background: `${activeGroup.color}22`, color: activeGroup.color } : {}}
          >
            {activeGroup ? <activeGroup.icon size={18} /> : activeChatLabel.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div className="messages-header-name">{activeChatLabel}</div>
            <div className="messages-header-sub">
              {activeGroup ? activeGroup.sub : activePerson ? ROLE_LABELS[activePerson.role] : ''}
            </div>
          </div>
          <button
            className={`messages-header-btn${searchOpen ? ' active' : ''}`}
            onClick={() => { setSearchOpen(s => !s); setSearchQuery(''); }}
            title="Search messages"
          >
            <Search size={16} />
          </button>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="messages-search-bar">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search messages…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}><X size={13} /></button>
            )}
          </div>
        )}

        {/* Pinned message banner */}
        {pinnedMsg && !searchOpen && (
          <div className="messages-pinned-banner">
            <Pin size={12} />
            <span className="messages-pinned-from">{pinnedMsg.fromName}:</span>
            <span className="messages-pinned-text">{pinnedMsg.text}</span>
            <button
              onClick={() => setDoc(doc(db, 'staffChats', activeChatId), { pinnedMsg: null }, { merge: true })}
              title="Unpin"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Message body */}
        <div className="messages-body">
          {visibleMessages.length === 0 && !searchQuery && (
            <div className="messages-empty">
              <MessageSquare size={36} />
              <p>No messages yet. Start the conversation.</p>
            </div>
          )}
          {visibleMessages.length === 0 && searchQuery && (
            <div className="messages-empty">
              <Search size={36} />
              <p>No messages match "{searchQuery}"</p>
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
                const isLastSent = lastSentMsg?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    className={`messages-bubble-wrap${isOwn ? ' own' : ''}${msg.urgent ? ' urgent' : ''}`}
                  >
                    {showSender && (
                      <div className="messages-bubble-sender">{msg.fromName}</div>
                    )}
                    <div className="messages-bubble-row">
                      {/* Hover actions */}
                      {!msg.deleted && (
                        <div className={`messages-bubble-actions${isOwn ? ' own' : ''}`}>
                          {isGroupChat(activeChatId) && (
                            <button
                              className="messages-action-btn"
                              onClick={() => handlePinMessage(msg)}
                              title={chatMeta[activeChatId]?.pinnedMsg?.id === msg.id ? 'Unpin' : 'Pin message'}
                            >
                              <Pin size={12} />
                            </button>
                          )}
                          {isOwn && (
                            <button
                              className="messages-action-btn danger"
                              onClick={() => handleDeleteMessage(msg)}
                              title="Delete message"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className={`messages-bubble${isOwn ? ' own' : ''}${msg.urgent ? ' urgent' : ''}${msg.deleted ? ' deleted' : ''}`}>
                        {msg.urgent && !msg.deleted && (
                          <span className="messages-urgent-badge">
                            <AlertTriangle size={11} /> URGENT
                          </span>
                        )}
                        <span className="messages-bubble-text">
                          {msg.deleted ? 'Message deleted' : msg.text}
                        </span>
                        <span className="messages-bubble-time">{formatMsgTime(msg.timestamp)}</span>
                      </div>
                    </div>
                    {/* Read receipt — only for DMs, only for your own last sent message */}
                    {isLastSent && !isGroupChat(activeChatId) && otherLastRead >= msg.timestamp && (
                      <div className="messages-read-receipt">
                        <CheckCheck size={12} /> Seen
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="messages-typing">
              <div className="messages-typing-dots">
                <span /><span /><span />
              </div>
              <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="messages-input-row">
          <button
            className={`messages-urgent-toggle${urgent ? ' active' : ''}`}
            onClick={() => setUrgent(u => !u)}
            title={urgent ? 'Remove urgent flag' : 'Mark as urgent'}
          >
            <AlertTriangle size={16} />
          </button>
          <textarea
            ref={inputRef}
            className={`messages-input${urgent ? ' urgent' : ''}`}
            placeholder={urgent ? '⚠️ URGENT — type your message…' : 'Message… (Enter to send, Shift+Enter for new line)'}
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
