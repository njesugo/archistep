import { useEffect } from "react";
import { keyAction, type ShortcutAction } from "./engine/state";

/** Éléments où les touches servent à autre chose qu'à naviguer. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Raccourcis clavier de toute la page (voir `keyAction`). Ignorés pendant la saisie. */
export function useShortcuts(actions: Record<ShortcutAction, () => void>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const onButton = e.target instanceof HTMLElement && e.target.closest("button, a") !== null;
      const action = keyAction(e.key, onButton);
      if (!action) return;
      if (e.key === " ") e.preventDefault(); // pas de défilement de la page
      actions[action]();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [actions]);
}
