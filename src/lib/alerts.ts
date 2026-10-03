"use client";

import type { SweetAlertIcon, SweetAlertOptions } from "sweetalert2";

const FLASH_KEY = "sodefor:flash";

type Flash = { icon: SweetAlertIcon; title: string; text?: string };

async function swal() {
  const { default: Swal } = await import("sweetalert2");
  return Swal;
}

const baseOptions: SweetAlertOptions = {
  buttonsStyling: false,
  reverseButtons: true,
  customClass: {
    popup: "swal-sodefor",
    title: "swal-sodefor-title",
    htmlContainer: "swal-sodefor-text",
    confirmButton: "swal-btn swal-btn-primary",
    cancelButton: "swal-btn swal-btn-outline",
    denyButton: "swal-btn swal-btn-danger",
    input: "field swal-sodefor-input",
    validationMessage: "swal-sodefor-validation",
  },
};

export async function toast(icon: SweetAlertIcon, title: string, text?: string) {
  const Swal = await swal();
  await Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    titleText: title,
    text,
    showConfirmButton: false,
    timer: icon === "error" ? 6000 : 3500,
    timerProgressBar: true,
    customClass: { popup: "swal-sodefor-toast" },
    didOpen: (el) => {
      el.addEventListener("mouseenter", Swal.stopTimer);
      el.addEventListener("mouseleave", Swal.resumeTimer);
    },
  });
}

export const notifySuccess = (title: string, text?: string) => toast("success", title, text);

export async function notifyError(title: string, text?: string) {
  const Swal = await swal();
  await Swal.fire({ ...baseOptions, icon: "error", titleText: title, text, confirmButtonText: "Compris" });
}

export async function confirmAction({
  title,
  text,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  danger = false,
}: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}) {
  const Swal = await swal();
  const result = await Swal.fire({
    ...baseOptions,
    icon: danger ? "warning" : "question",
    titleText: title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    focusCancel: danger,
    customClass: {
      ...baseOptions.customClass,
      confirmButton: danger ? "swal-btn swal-btn-danger" : "swal-btn swal-btn-primary",
    },
  });
  return result.isConfirmed;
}

/** Affiche une seule fois un secret (mot de passe provisoire) avec un bouton de copie. */
export async function showSecret({ title, text, secret }: { title: string; text: string; secret: string }) {
  const Swal = await swal();
  const container = document.createElement("div");
  const intro = document.createElement("p");
  intro.textContent = text;
  const code = document.createElement("code");
  code.textContent = secret;
  code.className = "mt-3 block select-all rounded-xl bg-mint px-4 py-3 text-center font-mono text-lg font-bold tracking-wider text-forest-deep";
  const warn = document.createElement("p");
  warn.textContent = "Il ne sera plus affiché : transmettez-le par un canal sûr. L'utilisateur devra le changer à sa première connexion.";
  warn.className = "mt-3 text-xs";
  container.append(intro, code, warn);
  await Swal.fire({
    ...baseOptions,
    icon: "success",
    titleText: title,
    html: container,
    showDenyButton: true,
    denyButtonText: "Copier",
    confirmButtonText: "J'ai noté le mot de passe",
    allowOutsideClick: false,
    customClass: { ...baseOptions.customClass, denyButton: "swal-btn swal-btn-outline" },
    preDeny: async () => {
      await navigator.clipboard?.writeText(secret).catch(() => undefined);
      Swal.showValidationMessage("Copié dans le presse-papiers");
      return false;
    },
  });
}

export async function askReason({
  title,
  text,
  placeholder = "Motif",
  confirmText = "Valider",
  minLength = 3,
}: {
  title: string;
  text?: string;
  placeholder?: string;
  confirmText?: string;
  minLength?: number;
}) {
  const Swal = await swal();
  const result = await Swal.fire({
    ...baseOptions,
    icon: "warning",
    titleText: title,
    text,
    input: "text",
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Annuler",
    customClass: { ...baseOptions.customClass, confirmButton: "swal-btn swal-btn-danger" },
    inputValidator: (value) =>
      !value || value.trim().length < minLength
        ? `Le motif est obligatoire (${minLength} caractères minimum).`
        : undefined,
  });
  return result.isConfirmed ? String(result.value).trim() : null;
}

/** Stores a message displayed as a toast on the next page, after a redirect. */
export function setFlash(flash: Flash) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
  } catch {}
}

export function consumeFlash(): Flash | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw) as Flash;
  } catch {
    return null;
  }
}

/**
 * `fetch` qui ne lève pas sur coupure réseau : renvoie une réponse 503 lisible par `readError`,
 * pour que les formulaires sortent de l'état « en cours » et affichent un message.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(JSON.stringify({ error: "Connexion au serveur interrompue. Vérifiez le réseau puis réessayez." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function readError(res: Response, fallback = "Action impossible") {
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error ?? fallback;
}
