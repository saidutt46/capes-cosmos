/** Parser for the Paper Sky survey bundle (stars.bin + meta.json).
 *
 * stars.bin is a little-endian structure-of-arrays buffer; meta.json describes
 * each field's dtype/offset/length so we can slice typed arrays with zero copy.
 * Produced by `python -m capes.webexport` in the capes-and-cowls repo.
 */

export interface FieldMeta {
  name: string;
  type: 'u8' | 'u16';
  offset: number;
  length: number;
}

export interface SurveyMeta {
  count: number;
  endianness: 'little';
  byteLength: number;
  fields: FieldMeta[];
  na: { u8: number; year: number; appearances: number };
  categories: Record<string, string[]>;
  realities: { name: string; count: number }[];
}

export interface StarFields {
  count: number;
  universe: Uint8Array; // 0 Marvel, 1 DC
  align: Uint8Array; // 0 Good, 1 Neutral, 2 Bad (255 = NA)
  sex: Uint8Array;
  alive: Uint8Array; // 0 Living, 1 Deceased
  identity: Uint8Array;
  realityId: Uint8Array;
  year: Uint16Array; // 0 = unknown
  appearances: Uint16Array; // 65535 = unknown
  meta: SurveyMeta;
}

export const NA_U8 = 255;
export const NA_YEAR = 0;
export const NA_APPEARANCES = 65535;

/** Slice all survey fields out of the binary buffer per meta layout. */
export function parseStars(buf: ArrayBuffer, meta: SurveyMeta): StarFields {
  if (buf.byteLength !== meta.byteLength) {
    throw new Error(
      `stars.bin size mismatch: got ${buf.byteLength}, meta says ${meta.byteLength}`,
    );
  }
  const field = (name: string): FieldMeta => {
    const f = meta.fields.find((f) => f.name === name);
    if (!f) throw new Error(`field ${name} missing from meta.json`);
    if (f.length !== meta.count) throw new Error(`field ${name} length mismatch`);
    return f;
  };
  const u8 = (name: string) => {
    const f = field(name);
    return new Uint8Array(buf, f.offset, f.length);
  };
  const u16 = (name: string) => {
    const f = field(name);
    if (f.offset % 2 !== 0) throw new Error(`field ${name} not 2-byte aligned`);
    return new Uint16Array(buf, f.offset, f.length);
  };
  return {
    count: meta.count,
    universe: u8('universe'),
    align: u8('align'),
    sex: u8('sex'),
    alive: u8('alive'),
    identity: u8('identity'),
    realityId: u8('reality_id'),
    year: u16('year'),
    appearances: u16('appearances'),
    meta,
  };
}

/** Fetch + parse the bundle from /data/. */
export async function loadSurvey(base = '/data'): Promise<StarFields> {
  const [meta, bin] = await Promise.all([
    fetch(`${base}/meta.json`).then((r) => r.json() as Promise<SurveyMeta>),
    fetch(`${base}/stars.bin`).then((r) => r.arrayBuffer()),
  ]);
  return parseStars(bin, meta);
}
