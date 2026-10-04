"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui";

type Point = { x: number; y: number };

/** Largeur suffisante pour l'impression dans la liste (cellule de quelques centimètres). */
const EXPORT_MAX_WIDTH = 480;
const INK = "#14532d";

/**
 * Le canvas est à la densité de l'écran (×2 à ×3) : réduit avant l'envoi. JPEG sur fond blanc : le PDF
 * l'intègre tel quel, alors qu'un PNG transparent doit être décompressé puis recompressé à chaque liste.
 */
function exportSignature(canvas: HTMLCanvasElement) {
  const scale = Math.min(1, EXPORT_MAX_WIDTH / canvas.width);
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.85);
}

function setupContext(canvas: HTMLCanvasElement, ratio: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  return ctx;
}

export function SignaturePad({
  onChange,
  disabled,
}: {
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<Point | null>(null);
  const emptyRef = useRef(true);
  const [empty, setEmpty] = useState(true);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const typedId = useId();

  function markEmpty(value: boolean) {
    emptyRef.current = value;
    setEmpty(value);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Redimensionner un canvas l'efface : le tracé est recopié depuis une copie hors écran.
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.round(rect.width * ratio);
      const height = Math.round(rect.height * ratio);
      if (width === canvas.width && height === canvas.height) return;
      let copy: HTMLCanvasElement | null = null;
      if (!emptyRef.current && canvas.width > 0) {
        copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext("2d")?.drawImage(canvas, 0, 0);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = setupContext(canvas, ratio);
      if (ctx && copy) ctx.drawImage(copy, 0, 0, rect.width, rect.height);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function pos(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = pos(event);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const current = pos(event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    last.current = current;
    if (emptyRef.current) markEmpty(false);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (!canvas || emptyRef.current) return;
    onChange(exportSignature(canvas));
  }

  function wipe() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    return { canvas, ctx };
  }

  function clear() {
    if (!wipe()) return;
    markEmpty(true);
    onChange("");
  }

  /** Alternative au tracé (clavier, lecteur d'écran) : le nom saisi est écrit dans le cadre. */
  function applyTyped() {
    const text = typed.trim();
    if (!text) return;
    const target = wipe();
    if (!target) return;
    const rect = target.canvas.getBoundingClientRect();
    let size = Math.min(48, rect.height * 0.45);
    target.ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", cursive`;
    while (size > 14 && target.ctx.measureText(text).width > rect.width - 32) {
      size -= 2;
      target.ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", cursive`;
    }
    target.ctx.textBaseline = "middle";
    target.ctx.fillText(text, 16, rect.height / 2);
    markEmpty(false);
    onChange(exportSignature(target.canvas));
    setTyping(false);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={empty ? "Cadre de signature vide" : "Signature capturée"}
        className="h-40 w-full touch-none rounded-2xl border border-line bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      {typing ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label htmlFor={typedId} className="sr-only">
            Nom à utiliser comme signature
          </label>
          <input
            id={typedId}
            value={typed}
            onChange={(event) => setTyped(event.target.value.slice(0, 60))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyTyped();
              }
            }}
            placeholder="Votre nom complet"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
          <Button type="button" onClick={applyTyped} disabled={disabled || !typed.trim()}>
            Utiliser
          </Button>
          <Button type="button" variant="ghost" onClick={() => setTyping(false)}>
            Annuler
          </Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted" aria-live="polite">
          {empty ? "Signez au doigt, au stylet ou à la souris." : "Signature capturée."}
        </p>
        <div className="flex gap-1">
          {!typing ? (
            <Button type="button" variant="ghost" onClick={() => setTyping(true)} disabled={disabled}>
              Saisir au clavier
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={clear} disabled={disabled}>
            Effacer
          </Button>
        </div>
      </div>
    </div>
  );
}
