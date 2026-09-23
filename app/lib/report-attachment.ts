import { readClinicalDocument, type ClinicalDocument } from './clinical-document';

// SUPPLEMENTARY DOCUMENTS ON A REPORT (Ruth, 21 September 2026).
//
// Asked whether principle 16 - "no photography of bodies, ever" - covered her
// own clinical photograph of her own knee inside her own medical report, she
// answered the whole question rather than that one case:
//
//   "No photos in the app, please add a section to the report builder where
//   additional and supplementary documents can be added to the report. They
//   will need to be ai named and added to the contents as part of an appendix
//   or supplementary information. Accept, pdf, image etc, same as for the chat
//   medical files"
//
// So the app stores no photographs at all, and the report carries what she
// chooses to attach AT THE MOMENT SHE BUILDS IT. That is a better answer than
// the one the mock proposed: nothing accumulates, nothing has to be secured for
// years, and the decision about whether a clinician sees a particular page is
// made once, deliberately, for one document.
//
// AN ATTACHMENT IS NEVER STORED. It is read here, turned into the two things an
// appendix needs - a name and its contents - and the bytes are gone when the
// request ends. What survives is inside the report itself, which expires in two
// hours like every other report.
//
// AI NAMES IT, AND SAYS SO. Her instruction. The name is what the document
// appears to be, written by the model, and the appendix says once that the
// names are Selodía's reading rather than the documents' own titles - because a
// reader who assumes "Blood results, March 2026" was printed on the page would
// be assuming something nobody checked.

export type Attachment = {
  /** The model's name for it, shown in the Contents and over the page. */
  name: string;
  kind: string;
  /** The date on it, when there is one. */
  dated: string | null;
  /** What it says, reproduced - the substance for a PDF, the caption for an image. */
  lines: string[];
  /** For an image: the page itself, to print. Null for a PDF, which cannot be drawn. */
  image: { dataUri: string } | null;
  /** Anything the reading could not resolve. */
  unreadable: string[];
};

/** What the app holds between reading an attachment and building the report. */
export type ReadAttachment =
  | { ok: true; attachment: Attachment }
  | { ok: false; reason: 'unreadable' | 'failed' }
  | { ok: false; reason: 'not_a_document'; sawInstead: string | null };

const MAX_LINES = 40;

/**
 * Reads one attached document and returns what the appendix needs.
 *
 * The same reader the chat path uses, for the same reason: this is the third
 * place a medical document is read, and a second implementation would be a
 * second set of rules about what may be said about one.
 */
export async function readAttachment(
  source: { type: 'image'; mediaType: string; base64: string } | { type: 'pdf'; base64: string }
): Promise<ReadAttachment> {
  const read = await readClinicalDocument([source]);
  if (!read.ok) {
    return read.reason === 'not_a_document'
      ? { ok: false, reason: 'not_a_document', sawInstead: read.sawInstead }
      : { ok: false, reason: read.reason };
  }

  const doc = read.document;
  return {
    ok: true,
    attachment: {
      name: describe(doc),
      kind: doc.kind,
      dated: doc.dated,
      lines: linesFor(doc),
      // THE IMAGE IS THE EVIDENCE, so it is reproduced rather than described. A
      // PDF cannot be drawn into a printed page, so its substance is set as
      // text and the appendix says the original is not reproduced.
      image: source.type === 'image' ? { dataUri: `data:${source.mediaType};base64,${source.base64}` } : null,
      unreadable: doc.unreadable.slice(0, 4),
    },
  };
}

/** A short name for the Contents: what it is, and when, where both are known. */
function describe(doc: ClinicalDocument): string {
  const title = doc.title.trim();
  const base = title && title.toLowerCase() !== 'a medical document' ? title : capitalise(doc.kind);
  return doc.dated ? `${base}, ${humanDate(doc.dated)}` : base;
}

function linesFor(doc: ClinicalDocument): string[] {
  const out: string[] = [];
  const who = [doc.clinician.name, doc.clinician.role, doc.clinician.organisation].filter(Boolean).join(', ');
  if (who) out.push(who);
  if (doc.about) out.push(doc.about);
  out.push(...doc.says);
  out.push(...doc.plan);
  return out.slice(0, MAX_LINES);
}

function capitalise(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function humanDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * THE GUARD ON WHAT THE PHONE SENDS BACK. An attachment makes a round trip -
 * read here, held on the phone, returned with the build - so what comes back is
 * ordinary untrusted input and is read field by field like everything else.
 *
 * The data URI is checked rather than trusted: only the four image types the
 * document can print, only base64, and a ceiling that keeps a report inside
 * what the platform will carry.
 */
const IMAGE_URI = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 1_400_000;

export function readAttachments(raw: unknown, cap = 6): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];

  for (const item of raw.slice(0, cap)) {
    const a = (item ?? {}) as Record<string, unknown>;
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, 120) : '';
    if (!name) continue;

    const lines = Array.isArray(a.lines)
      ? (a.lines as unknown[])
          .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
          .map((l) => l.trim().slice(0, 1500))
          .slice(0, MAX_LINES)
      : [];

    const uri =
      a.image && typeof a.image === 'object' && typeof (a.image as { dataUri?: unknown }).dataUri === 'string'
        ? ((a.image as { dataUri: string }).dataUri)
        : '';

    out.push({
      name,
      kind: typeof a.kind === 'string' ? a.kind.slice(0, 40) : 'document',
      dated: typeof a.dated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dated) ? a.dated : null,
      lines,
      image: uri && uri.length <= MAX_IMAGE_CHARS && IMAGE_URI.test(uri) ? { dataUri: uri } : null,
      unreadable: Array.isArray(a.unreadable)
        ? (a.unreadable as unknown[])
            .filter((l): l is string => typeof l === 'string')
            .map((l) => l.slice(0, 300))
            .slice(0, 4)
        : [],
    });
  }

  return out;
}
