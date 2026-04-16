import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import ConversationView from "../components/ConversationView";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

export default function MessagesPage() {
  const [loaded, setLoaded] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [markingRead, setMarkingRead] = useState(false);
  const pollingRef = useRef(null);

  const loadAccounts = async () => {
    const response = await api.get("/ka-accounts");
    setAccounts(response.data || []);
  };

  const loadConversations = async () => {
    const params = selectedAccountId !== "all" ? `?account_id=${selectedAccountId}` : "";
    const response = await api.get(`/messages/conversations${params}`);
    const accountById = new Map((accounts || []).map((account) => [account.id, account]));

    const items = (response.data || []).map((conversation) => ({
      ...conversation,
      accountLabel: accountById.get(conversation.account_id)?.label || `Konto ${conversation.account_id}`,
    }));

    setConversations(items);
    return items;
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return [];
    setLoadingMessages(true);
    try {
      const response = await api.get(`/messages/conversations/${conversationId}/messages`);
      const items = response.data || [];
      setMessagesByConversation((current) => ({ ...current, [conversationId]: items }));
      return items;
    } catch (error) {
      setPageError(getErrorMessage(error));
      return [];
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setPageError("");
    try {
      await loadAccounts();
      const items = await loadConversations();
      if (!selectedConversationId && items.length > 0) {
        setSelectedConversationId(String(items[0].id));
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadAll();
  }

  useEffect(() => {
    if (!selectedConversationId) return;
    loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!loaded) return;

    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    pollingRef.current = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const items = await loadConversations();
        if (selectedConversationId) {
          const selectedStillExists = items.some(
            (conversation) => String(conversation.id) === String(selectedConversationId)
          );
          if (selectedStillExists) {
            await loadMessages(selectedConversationId);
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    }, 30000);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [loaded, selectedConversationId, selectedAccountId, accounts]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return [...conversations]
      .filter((conversation) => {
        if (selectedAccountId !== "all" && String(conversation.account_id) !== String(selectedAccountId)) return false;
        if (onlyUnread && Number(conversation.unread_count || 0) <= 0) return false;
        if (!normalizedSearch) return true;
        const partner = String(conversation.partner_name || "").toLowerCase();
        const subject = String(conversation.subject || "").toLowerCase();
        return partner.includes(normalizedSearch) || subject.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const leftTime = new Date(left.last_message_at || 0).getTime();
        const rightTime = new Date(right.last_message_at || 0).getTime();
        if (leftTime > rightTime) return -1;
        if (leftTime < rightTime) return 1;
        return String(left.kleinanzeigen_id).localeCompare(String(right.kleinanzeigen_id));
      });
  }, [conversations, searchTerm, selectedAccountId, onlyUnread]);

  const selectedConversation =
    filteredConversations.find((c) => String(c.id) === String(selectedConversationId)) ||
    conversations.find((c) => String(c.id) === String(selectedConversationId)) ||
    null;

  const selectedMessages = selectedConversationId ? messagesByConversation[selectedConversationId] || [] : [];

  const handleSelectConversation = async (conversation) => {
    setSelectedConversationId(String(conversation.id));
    setReplyBody("");
    setSendError("");
    setPageNotice("");
    await loadMessages(conversation.id);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!selectedConversationId || !replyBody.trim()) return;
    setSending(true);
    setSendError("");
    setPageError("");
    setPageNotice("");
    try {
      await api.post(`/messages/conversations/${selectedConversationId}/send`, { body: replyBody.trim() });
      setPageNotice("Wird gesendet.");
      setReplyBody("");
      await loadConversations();
      await loadMessages(selectedConversationId);
    } catch (error) {
      setSendError(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleMarkRead = async () => {
    if (!selectedConversationId) return;
    setMarkingRead(true);
    setPageError("");
    setPageNotice("");
    try {
      await api.post(`/messages/conversations/${selectedConversationId}/mark-read`);
      setPageNotice("Als gelesen markiert.");
      await loadConversations();
      await loadMessages(selectedConversationId);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setMarkingRead(false);
    }
  };

  const stats = useMemo(() => ({
    total: filteredConversations.length,
    unread: filteredConversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0),
  }), [filteredConversations]);

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Nachrichten</h1>
            <p className="mt-2 text-sm text-slate-500">Zentrale Inbox mit Polling alle 30 Sekunden.</p>
          </div>
          <button type="button" onClick={loadAll} disabled={loading} className="btn-secondary">
            {loading ? "Lädt..." : "Neu laden"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Unterhaltungen</div>
            <div className="mt-2 text-2xl font-semibold">{loading ? "..." : stats.total}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Ungelesen</div>
            <div className="mt-2 text-2xl font-semibold">{loading ? "..." : stats.unread}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="card">
          <div className="grid gap-3">
            <div>
              <label className="label">Konto</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="input">
                <option value="all">Alle Konten</option>
                {accounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>{account.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Suche</label>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Partner oder Betreff" className="input" />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              Nur ungelesene
            </label>
          </div>

          {pageError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</div> : null}
          {pageNotice ? <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{pageNotice}</div> : null}

          <div className="mt-4 space-y-3">
            {loading ? (
              <>
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              </>
            ) : null}

            {!loading && filteredConversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">Keine Unterhaltungen gefunden.</div>
            ) : null}

            {!loading && filteredConversations.map((conversation) => {
              const isSelected = String(conversation.id) === String(selectedConversationId);
              return (
                <button
                  key={conversation.kleinanzeigen_id}
                  type="button"
                  onClick={() => handleSelectConversation(conversation)}
                  className={[
                    "w-full rounded-lg border p-4 text-left transition",
                    isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{conversation.partner_name || "Unbekannt"}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{conversation.subject || "Ohne Betreff"}</div>
                    </div>
                    {conversation.unread_count > 0 ? (
                      <span className="inline-flex min-w-[28px] justify-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">{conversation.unread_count}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm text-slate-600">{conversation.last_message_preview || "Keine Vorschau"}</div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{conversation.accountLabel}</span>
                    <span>{formatDate(conversation.last_message_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {loadingMessages && selectedConversation ? (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Nachrichten werden geladen...</div>
          ) : null}
          <ConversationView
            conversation={selectedConversation}
            messages={selectedMessages}
            replyBody={replyBody}
            sending={sending}
            markingRead={markingRead}
            sendError={sendError}
            onReplyBodyChange={setReplyBody}
            onSend={handleSend}
            onMarkRead={handleMarkRead}
          />
        </div>
      </section>
    </div>
  );
}
