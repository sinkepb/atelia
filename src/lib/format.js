// Formatage et validation — fonctions pures, testées dans format.test.js.

export function formatPrix(centimes, devise = "eur") {
  if (!centimes) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise.toUpperCase() })
    .format(centimes / 100);
}

// "49,90" / "49.9" / "49" → 4990 ; vide → 0 ; invalide → null.
export function parsePrix(saisie) {
  const s = String(saisie ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  if (s === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

// 75 → "1 min 15 s", 3725 → "1 h 02", null → "".
export function formatDuree(secondes) {
  if (!secondes || secondes < 0) return "";
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

// 750 → "12:30", 3723 → "1:02:03" — forme saisissable, relue par parseDuree.
export function formatDureeSaisie(secondes) {
  if (secondes == null || secondes < 0) return "";
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = String(secondes % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// "12:30" → 750, "1:02:03" → 3723, "90" → 90 ; vide → null ; invalide → NaN.
export function parseDuree(saisie) {
  const s = String(saisie ?? "").trim();
  if (s === "") return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(s)) return NaN;
  return s.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

// "Créer sa 1ʳᵉ boutique !" → "creer-sa-1re-boutique" (format exigé par la
// contrainte CHECK de formations.formations.slug).
export function slugify(texte) {
  return String(texte ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Liste d'emails collée depuis un export Podia (CSV, une par ligne, séparés
// par virgules ou points-virgules) → emails uniques, en minuscules.
export function extraireEmails(texte) {
  const trouves = String(texte ?? "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  return [...new Set(trouves)];
}
