import { useMemo, useRef, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function getMessageKey(message) {
  return message.kleinanzeigen_id || `${message.sent_at || "no-date"}:${message.body || ""}`;
}

export default function ConversationView({
  conversation,
  messages,
  replyBody,
  sending = false,
  markingRead = false,
  sendError = "",
  onReplyBodyChange,
  onSend,
  onMarkRead,
  templates = [],
  onInsertTemplate,
  onArchiveToggle,
  onSpamToggle,
  onBlockPartner,
  onSaveNote,
}) {
  const scrollRef = useRef(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteConversationId, setNoteConversationId] = useState(null);

  // Reset the note editor when another conversation is selected
  if (conversation && noteConversationId !== conversation.id) {
    setNoteConversationId(conversation.id);
    setNoteDraft(conversation.note || "");
    setNoteOpen(false);
  }

  useMemo(() => {
    if (!scrollRef.current) return null;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    return null;
  }, [conversation?.kleinanzeigen_id, messages.length]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="text-4xl">{"💬"}</div>
        <div className="mt-4 text-base font-medium text-slate-900">Keine Unterhaltung ausgewählt</div>
        <p className="mt-2 text-sm text-slate-500">Wähle links eine Unterhaltung aus, um Nachrichten zu lesen und zu antworten.</p>
      </div>
    );
  }

  return (
    <section
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
      style={{ height: "calc(100dvh - 16rem)" }}
    >
      <div className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{conversation.partner_name || "Unbekannt"}</h2>
              {conversation.unread_count > 0 ? (
                <span className="inline-flex rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">{conversation.unread_count}</span>
              ) : null}
            </div>
            <div className="mt-1 text-sm text-slate-500">{conversation.subject || "Ohne Betreff"}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Konto: {conversation.accountLabel || `Konto ${conversation.account_id}`}</span>
              <span>Zuletzt: {formatDate(conversation.last_message_at)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onMarkRead}
            disabled={markingRead || conversation.unread_count === 0}
            className="btn-secondary shrink-0 text-xs sm:text-sm"
          >
            {markingRead ? "..." : "Gelesen"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {onArchiveToggle ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => onArchiveToggle(conversation)}>
              {conversation.is_archived ? "📥 Zurueck in Inbox" : "🗂️ Archivieren"}
            </button>
          ) : null}
          {onSpamToggle ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => onSpamToggle(conversation)}>
              {conversation.is_spam ? "✅ Kein Spam" : "🚫 Spam"}
            </button>
          ) : null}
          {onBlockPartner && conversation.partner_name ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => onBlockPartner(conversation)}>
              {"⛔"} Blockieren
            </button>
          ) : null}
          {onSaveNote ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => setNoteOpen((v) => !v)}>
              {"📝"} Notiz{conversation.note ? " •" : ""}
            </button>
          ) : null}
        </div>

        {noteOpen && onSaveNote ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              rows={2}
              maxLength={10000}
              placeholder="Private Notiz zu dieser Unterhaltung (nur fuer dich sichtbar)"
              className="input text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setNoteOpen(false)}>
                Schliessen
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={() => { onSaveNote(conversation, noteDraft); setNoteOpen(false); }}
              >
                Notiz speichern
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-3 py-4 sm:px-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
              Noch keine Nachrichten vorhanden.
            </div>
          ) : null}

          {messages.map((message) => {
            const isOutgoing = message.direction === "outgoing";
            return (
              <div key={getMessageKey(message)} className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
                <div
                  className={[
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                    isOutgoing ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800",
                  ].join(" ")}
                >
                  <div className={`mb-1 text-xs font-medium ${isOutgoing ? "text-blue-100" : "text-slate-500"}`}>
                    {message.sender_name || (isOutgoing ? "Du" : "Kontakt")}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{message.body}</div>
                  <div className={`mt-2 text-[11px] ${isOutgoing ? "text-blue-100" : "text-slate-500"}`}>
                    {formatDate(message.sent_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        <div className="space-y-3">
          {templates.length > 0 && onInsertTemplate ? (
            <div>
              <select
                className="input text-sm"
                value=""
                onChange={(event) => {
                  const template = templates.find((t) => String(t.id) === event.target.value);
                  if (template) onInsertTemplate(template);
                }}
              >
                <option value="">{"⚡"} Vorlage einfuegen ({"{name}"} und {"{titel}"} werden ersetzt)</option>
                {templates.map((template) => (
                  <option key={template.id} value={String(template.id)}>{template.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <textarea
            value={replyBody}
            onChange={(event) => onReplyBodyChange(event.target.value)}
            rows={3}
            placeholder="Antwort schreiben"
            maxLength={4000}
            className="input"
          />
          {sendError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sendError}</div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !replyBody.trim()}
              className="btn-primary"
            >
              {sending ? "Wird gesendet..." : "Senden"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
