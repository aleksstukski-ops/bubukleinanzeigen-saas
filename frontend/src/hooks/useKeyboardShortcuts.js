import { useEffect } from "react";

/**
 * Bind keyboard shortcuts on the document.
 *
 * shortcuts = [
 *   { key: "k", meta: true, handler: () => ... },         // Cmd+K
 *   { key: "k", ctrl: true, handler: () => ... },         // Ctrl+K
 *   { key: "Escape", handler: () => ... },                // Esc
 *   { key: "/", handler: () => ... },                     // /
 * ]
 *
 * - Matching is case-insensitive for single-char keys; "Escape"/"Enter"
 *   etc. use the literal event.key.
 * - meta = true requires event.metaKey (Cmd on macOS, Win on Windows).
 * - ctrl = true requires event.ctrlKey.
 * - When either meta or ctrl is unspecified, the shortcut requires
 *   them to be OFF — prevents e.g. Cmd+/ firing a bare "/" handler.
 * - Shortcuts that fire inside an INPUT / TEXTAREA / contentEditable
 *   are skipped, UNLESS allowInInput: true is set on the binding
 *   (the close-modal Escape uses that).
 */
export default function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    if (!shortcuts || shortcuts.length === 0) return undefined;

    const isTypingInField = (target) => {
      if (!target) return false;
      const tag = (target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    };

    const matches = (binding, event) => {
      const wantMeta = Boolean(binding.meta);
      const wantCtrl = Boolean(binding.ctrl);
      const wantShift = Boolean(binding.shift);
      const wantAlt = Boolean(binding.alt);
      if (event.metaKey !== wantMeta) return false;
      if (event.ctrlKey !== wantCtrl) return false;
      if (event.shiftKey !== wantShift) return false;
      if (event.altKey !== wantAlt) return false;
      const expected = String(binding.key || "");
      const actual = String(event.key || "");
      if (expected.length === 1) {
        return actual.toLowerCase() === expected.toLowerCase();
      }
      return actual === expected;
    };

    const onKeyDown = (event) => {
      const typing = isTypingInField(event.target);
      for (const binding of shortcuts) {
        if (typing && !binding.allowInInput) continue;
        if (!matches(binding, event)) continue;
        if (binding.preventDefault !== false) event.preventDefault();
        try {
          binding.handler(event);
        } catch (_) {
          // Swallow handler errors — shortcut should never crash the page.
        }
        break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
