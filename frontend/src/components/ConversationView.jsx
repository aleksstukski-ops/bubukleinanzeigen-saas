import { useMemo, useRef } from "react";

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
}) {
  const scrollRef = useRef(null);

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
      style={{ height: "calc(100dvh - 12rem)" }}
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
            className="btn-secondary"
          >
            {markingRead ? "Markiert..." : "Als gelesen markieren"}
          </button>
        </div>
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
          <textarea
            value={replyBody}
            onChange={(event) => onReplyBodyChange(event.target.value)}
            rows={4}
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
