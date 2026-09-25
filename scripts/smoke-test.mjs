// Test de fumée des critères de recette majeurs contre une instance déployée.
// Usage : BASE_URL=https://presence.sodefor.ci node scripts/smoke-test.mjs
// Prérequis : seed de démonstration exécuté (compte admin et QR de démo).

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL || "admin@sodefor.ci";
const PASSWORD = process.env.ADMIN_PASSWORD || "Admin@Sodefor2026!";
const DEMO_TOKEN = "demo-comite-technique-sodefor-2026-token";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const jar = new Map();
let failures = 0;

function storeCookies(res) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function http(path, { auth = false, ...init } = {}) {
  const headers = new Headers(init.headers);
  if (auth) headers.set("cookie", cookieHeader());
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...init, headers });
  storeCookies(res);
  return res;
}

function check(label, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}

const unique = Date.now();
const participant = {
  civility: "M",
  lastName: `Test${unique}`,
  firstNames: "Recette",
  jobTitle: "Testeur",
  organization: "SODEFOR",
  email: `recette.${unique}@sodefor.ci`,
  phone: `07${String(unique).slice(-8)}`,
  signatureDataUrl: PNG,
};

const health = await http("/api/health");
check("Santé applicative", health.status === 200, JSON.stringify(await health.json()));

const form = await http(`/r/${DEMO_TOKEN}`);
check("Formulaire public accessible", form.status === 200 && (await form.text()).includes("COMITE TECHNIQUE"));

const denied = await http("/api/meetings");
check("Utilisateur sans droit refusé", denied.status === 401, `HTTP ${denied.status}`);

const submit = (body) =>
  http(`/api/public/meetings/${DEMO_TOKEN}/attendance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const first = await submit(participant);
const firstBody = await first.json();
check("Présence enregistrée avec signature", first.status === 200, firstBody.confirmationCode ?? firstBody.error);

const again = await submit(participant);
check("Double soumission rejetée", again.status === 409, (await again.json()).error);

const sameEmail = await submit({ ...participant, lastName: `Autre${unique}`, phone: "" });
check("Même email : alerte doublon", sameEmail.status === 409, `HTTP ${sameEmail.status}`);

const concurrent = { ...participant, lastName: `Conc${unique}`, email: `conc.${unique}@sodefor.ci`, phone: "" };
const race = await Promise.all(Array.from({ length: 5 }, () => submit(concurrent)));
const created = race.filter((r) => r.status === 200).length;
check("Soumissions simultanées : une seule acceptée", created === 1, `${created} acceptée(s) sur 5`);

const csrf = await (await http("/api/auth/csrf")).json();
const login = await http("/api/auth/callback/credentials", {
  method: "POST",
  auth: true,
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: PASSWORD, callbackUrl: `${BASE}/dashboard` }),
});
check("Connexion administrateur", [...jar.keys()].some((k) => k.includes("session-token")), `HTTP ${login.status}`);

const dashboard = await http("/dashboard", { auth: true });
check("Tableau de bord accessible", dashboard.status === 200, `HTTP ${dashboard.status}`);

const meetings = await (await http("/api/meetings", { auth: true })).json();
const demo = Array.isArray(meetings) ? meetings.find((m) => m.slug === "comite-technique-21-septembre-2026") : null;
check("Réunion de démonstration listée", Boolean(demo));

if (demo) {
  const list = await (await http(`/api/meetings/${demo.id}/attendances?q=${participant.lastName}`, { auth: true })).json();
  check("Participant visible côté administration", Array.isArray(list) && list.length === 1);

  const pdf = await http(`/api/meetings/${demo.id}/exports/pdf`, { auth: true });
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  check("Génération PDF", pdf.status === 200 && String.fromCharCode(...pdfBytes.slice(0, 4)) === "%PDF", `${pdfBytes.length} octets`);

  const xlsx = await http(`/api/meetings/${demo.id}/exports/xlsx`, { auth: true });
  const xlsxBytes = new Uint8Array(await xlsx.arrayBuffer());
  check("Export Excel valide", xlsx.status === 200 && xlsxBytes[0] === 0x50 && xlsxBytes[1] === 0x4b, `${xlsxBytes.length} octets`);

  const csv = await http(`/api/meetings/${demo.id}/exports/csv`, { auth: true });
  check("Export CSV", csv.status === 200 && (await csv.text()).includes(participant.lastName.toUpperCase()));

  if (process.env.SMOKE_CLOSE === "1") {
    const close = await http(`/api/meetings/${demo.id}/close`, { method: "POST", auth: true });
    check("Clôture", close.status === 200, `HTTP ${close.status}`);
    const afterClose = await submit({ ...participant, lastName: `Post${unique}`, email: `post.${unique}@sodefor.ci`, phone: "" });
    check("QR inutilisable après clôture", afterClose.status === 404 || afterClose.status === 409, `HTTP ${afterClose.status}`);
    await http(`/api/meetings/${demo.id}/reopen`, { method: "POST", auth: true });
  }
}

console.log(failures === 0 ? "\nTous les contrôles sont passés." : `\n${failures} contrôle(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
