def _shell(title: str, subtitle: str, body_html: str) -> str:
    return f"""
    <html>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="background:linear-gradient(135deg,#2563eb,#0f172a);padding:28px 32px;color:#ffffff;">
                    <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">BubuBay</div>
                    <h1 style="margin:10px 0 6px;font-size:28px;line-height:1.2;">{title}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.6;opacity:0.92;">{subtitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    {body_html}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 28px;color:#64748b;font-size:13px;line-height:1.6;">
                    Diese Nachricht wurde automatisch von BubuBay versendet.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


def welcome_email(user_name: str) -> str:
    return _shell(
        "Willkommen bei BubuBay",
        "Dein Multi-Platform Verkaufsmanager ist bereit.",
        f"""
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hallo {user_name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
          schön, dass du dabei bist. In BubuBay verwaltest du Konten, Inserate und Nachrichten zentral an einem Ort.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.7;">
          Als nächstes kannst du dein erstes Konto verbinden und deine Verkaufsprozesse direkt aus dem Dashboard steuern.
        </p>
        """,
    )


def session_expired_email(user_name: str, account_name: str) -> str:
    return _shell(
        "Session abgelaufen",
        "Ein verbundenes Verkaufskonto braucht deine Aufmerksamkeit.",
        f"""
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hallo {user_name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
          die gespeicherte Session für das Konto <strong>{account_name}</strong> ist abgelaufen.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.7;">
          Bitte melde dich in BubuBay erneut an, damit Nachrichten, Inserate und Synchronisierungen weiterlaufen können.
        </p>
        """,
    )


def new_message_email(user_name: str, sender: str, preview: str) -> str:
    return _shell(
        "Neue Nachricht eingegangen",
        "In deinem Posteingang wartet eine neue Unterhaltung.",
        f"""
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hallo {user_name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
          du hast eine neue Nachricht von <strong>{sender}</strong> erhalten.
        </p>
        <div style="margin:0 0 16px;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.7;">
          {preview}
        </div>
        <p style="margin:0;font-size:15px;line-height:1.7;">
          Öffne BubuBay, um direkt zu antworten und den Verlauf vollständig einzusehen.
        </p>
        """,
    )
