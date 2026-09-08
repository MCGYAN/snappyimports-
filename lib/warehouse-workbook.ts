import JSZip from 'jszip';

export type WarehouseWorkbookRow = {
  rowNumber: number;
  shippingMark: string;
  receivedAt: string | null;
  loadedAt: string | null;
  estimatedArrivalAt: string | null;
  description: string;
  cartons: number | null;
  cbm: number | null;
  trackingNumber: string;
  vessel: string;
  notes: string;
};

export type ParsedWarehouseWorkbook = {
  sheetName: string;
  sourceRows: number;
  skippedRows: number;
  rows: WarehouseWorkbookRow[];
};

const MAX_WORKBOOK_ROWS = 10_000;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function xmlText(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join('');
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\n\r\t&/_-]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function textValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function numberValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed != null && parsed > 0 ? Math.max(1, Math.round(parsed)) : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const milliseconds = Date.UTC(1899, 11, 30) + serial * 86_400_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  const numeric = numberValue(value);
  if (numeric != null && numeric >= 1 && numeric <= 100_000) {
    return excelSerialToIso(numeric);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) =>
    normalizedAliases.some(
      (alias) => String(header || '') === alias || String(header || '').includes(alias),
    ),
  );
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const xml = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) =>
    xmlText(match[1]),
  );
}

async function firstWorksheet(zip: JSZip): Promise<{ name: string; xml: string }> {
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const relationshipsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!workbookXml || !relationshipsXml) throw new Error('This workbook is missing required files.');

  const sheetMatch = workbookXml.match(
    /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/,
  );
  if (!sheetMatch) throw new Error('No worksheet was found.');

  const relationshipId = sheetMatch[2];
  const relationship = [...relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)].find(
    (match) => new RegExp(`\\bId="${relationshipId}"`).test(match[1]),
  );
  const target = relationship?.[1].match(/\bTarget="([^"]+)"/)?.[1];
  if (!target) throw new Error('The first worksheet could not be opened.');

  const normalizedTarget = target.startsWith('/')
    ? target.slice(1)
    : target.startsWith('xl/')
      ? target
      : `xl/${target.replace(/^\.\//, '')}`;
  const xml = await zip.file(normalizedTarget)?.async('string');
  if (!xml) throw new Error('The first worksheet could not be read.');
  return { name: decodeXml(sheetMatch[1]), xml };
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): unknown[][] {
  const parsed: unknown[][] = [];
  const rowMatches = [...xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)];
  if (rowMatches.length > MAX_WORKBOOK_ROWS) {
    throw new Error(`Workbook has more than ${MAX_WORKBOOK_ROWS.toLocaleString()} rows.`);
  }

  for (const rowMatch of rowMatches) {
    const row: unknown[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2];
      const reference = attributes.match(/\br="([^"]+)"/)?.[1] || '';
      const type = attributes.match(/\bt="([^"]+)"/)?.[1] || '';
      const index = columnIndex(reference);
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];

      if (type === 's' && raw != null) {
        row[index] = sharedStrings[Number(raw)] ?? '';
      } else if (type === 'inlineStr') {
        row[index] = xmlText(body);
      } else if (type === 'str') {
        row[index] = decodeXml(raw ?? '');
      } else if (raw != null) {
        row[index] = decodeXml(raw);
      } else {
        row[index] = '';
      }
    }
    parsed.push(row);
  }
  return parsed;
}

export async function parseWarehouseWorkbook(buffer: ArrayBuffer): Promise<ParsedWarehouseWorkbook> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const worksheet = await firstWorksheet(zip);
  const rawRows = parseWorksheetRows(worksheet.xml, sharedStrings);

  const headerIndex = rawRows.slice(0, 25).findIndex((row) => {
    const headers = Array.from({ length: row.length }, (_, index) => normalizeHeader(row[index]));
    const hasMark = findColumn(headers, ['shippingmark', 'client', '客户名', '唛头']) >= 0;
    const hasTracking =
      findColumn(headers, ['trackingno', 'trackingnumber', 'suppliertrackingno', '快递单号']) >= 0;
    return hasMark && hasTracking;
  });
  if (headerIndex < 0) {
    throw new Error('Could not find Shipping Mark and Tracking Number columns.');
  }

  const headerRow = rawRows[headerIndex];
  const headers = Array.from({ length: headerRow.length }, (_, index) =>
    normalizeHeader(headerRow[index]),
  );
  const columns = {
    mark: findColumn(headers, ['shippingmark', 'shippingmarkclient', 'client', '客户名', '唛头']),
    received: findColumn(headers, ['dateofreceipt', 'datereceived', 'receiveddate', '送货日期']),
    loaded: findColumn(headers, ['dateofloading', 'dateloaded', 'loadingdate', '装柜日期']),
    arrival: findColumn(headers, ['estimatedarrival', 'arrivaldate', 'eta', '预计到达']),
    description: findColumn(headers, ['description', 'itemdescription', 'goods', '商品名']),
    cartons: findColumn(headers, ['ctns', 'cartons', 'quantity', 'qty', '件数']),
    cbm: findColumn(headers, ['cbm', 'volume', '体积']),
    tracking: findColumn(headers, [
      'suppliertrackingno',
      'suppliertrackingnumber',
      'trackingno',
      'trackingnumber',
      '快递单号',
    ]),
    vessel: findColumn(headers, ['vessel', 'vesselnumber', '船名']),
    notes: findColumn(headers, ['notes', 'remark', 'remarks', '备注']),
  };

  const get = (row: unknown[], index: number) => (index >= 0 ? row[index] : null);
  const rows: WarehouseWorkbookRow[] = [];
  let skippedRows = 0;

  for (let index = headerIndex + 1; index < rawRows.length; index += 1) {
    const source = rawRows[index];
    const shippingMark = textValue(get(source, columns.mark)).toUpperCase();
    const trackingNumber = textValue(get(source, columns.tracking));
    const cbm = positiveNumber(get(source, columns.cbm));

    // Blank lines, headings repeated mid-sheet, and customer subtotal rows.
    if (!shippingMark || !trackingNumber || cbm == null) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      rowNumber: index + 1,
      shippingMark,
      receivedAt: dateValue(get(source, columns.received)),
      loadedAt: dateValue(get(source, columns.loaded)),
      estimatedArrivalAt: dateValue(get(source, columns.arrival)),
      description: textValue(get(source, columns.description)),
      cartons: positiveInteger(get(source, columns.cartons)),
      cbm,
      trackingNumber,
      vessel: textValue(get(source, columns.vessel)),
      notes: textValue(get(source, columns.notes)),
    });
  }

  if (rows.length === 0) throw new Error('No package rows with a shipping mark, tracking number, and CBM were found.');

  return {
    sheetName: worksheet.name,
    sourceRows: rawRows.length - headerIndex - 1,
    skippedRows,
    rows,
  };
}
