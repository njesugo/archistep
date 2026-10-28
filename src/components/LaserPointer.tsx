import { useEffect, useRef } from "react";
import { laserStyle, type Point } from "../engine/laser";
import "../styles/laser.css";

/**
 * Point lumineux qui suit la souris (ou le doigt) sur toute la page, pour montrer un endroit
 * pendant un enregistrement. Il ne reçoit jamais d'événement : on clique à travers.
 * La position est écrite directement dans le DOM, sans rendu React à chaque mouvement.
 */
export function LaserPointer({ active }: { active: boolean }) {
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dot.current;
    if (!active || !el) return;

    const place = (point: Point | null) => Object.assign(el.style, laserStyle(point));
    const follow = (e: PointerEvent) => place({ x: e.clientX, y: e.clientY });
    const hide = () => place(null);
    const release = (e: PointerEvent) => {
      if (e.pointerType === "touch") hide(); // au doigt, le point n'existe que pendant le contact
    };

    document.addEventListener("pointermove", follow);
    document.addEventListener("pointerdown", follow);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", hide);
    document.documentElement.addEventListener("pointerleave", hide);
    document.body.classList.add("laser-on");
    return () => {
      document.removeEventListener("pointermove", follow);
      document.removeEventListener("pointerdown", follow);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", hide);
      document.documentElement.removeEventListener("pointerleave", hide);
      document.body.classList.remove("laser-on");
    };
  }, [active]);

  return active ? <div ref={dot} className="laser" aria-hidden="true" /> : null;
}
