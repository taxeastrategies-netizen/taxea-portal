import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const source = path.resolve(process.argv[2] || 'tmp/official-designs/DR200e25.xls');
const destination = path.resolve(process.argv[3] || 'base44/functions/taxModelOperations/model200Layout.ts');
const workbook = XLSX.readFile(source, { raw: false });

function rowsFor(sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
}

function numericRows(sheetName) {
  return rowsFor(sheetName)
    .filter(row => /^\d+$/.test(String(row[1]).trim()) && /^\d+$/.test(String(row[2]).trim()))
    .map(row => {
      const cells = row.slice(4).map(cell => String(cell || '').trim()).filter(Boolean);
      return {
        position: Number(row[1]),
        length: Number(row[2]),
        type: String(row[3] || '').trim(),
        text: cells.join(' | '),
      };
    });
}

const pages = [];
for (const sheetName of workbook.SheetNames) {
  if (!/^DP200/.test(sheetName) || sheetName === 'DP200000') continue;
  const rows = numericRows(sheetName);
  const pageRow = rows.find(row => row.position === 6 && row.length === 5);
  const pageCode = pageRow?.text.match(/["']([0-9A-Z]{5})["']/)?.[1]
    || pageRow?.text.match(/\b(\d{2}[0-9A-Z]{3})\b/)?.[1];
  if (!pageCode) throw new Error(`No se pudo resolver la pagina de ${sheetName}`);
  const length = Math.max(...rows.map(row => row.position + row.length - 1));
  const endMarker = `</T200${pageCode}>`;
  const endRow = rows.find(row => row.text.includes(endMarker));
  if (!endRow || endRow.position + endRow.length - 1 !== length) throw new Error(`Cierre incoherente en ${sheetName}`);
  const boxes = rows.flatMap(row => {
    const code = row.text.match(/\[(\d{5})\]/)?.[1];
    if (!code || !/^(N|NUM)$/i.test(row.type)) return [];
    const decimals = /2\s*dec/i.test(row.text) || row.length === 17 ? 2 : 0;
    return [{ code, position: row.position, length: row.length, decimals, signed: /^N$/i.test(row.type) }];
  });
  pages.push({ code: pageCode, length, boxes });
}

const sourceHash = fs.statSync(source).size;
const output = `// Generated from the official AEAT DR200e25 v1.02 workbook.\n// Source size: ${sourceHash} bytes. Do not hand-edit; regenerate with scripts/extract-model200-layout.mjs.\nexport type Model200BoxLayout = { code: string; position: number; length: number; decimals: number; signed: boolean };\nexport type Model200PageLayout = { code: string; length: number; boxes: Model200BoxLayout[] };\nexport const MODEL200_LAYOUT: Model200PageLayout[] = ${JSON.stringify(pages)};\n`;
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, output, 'utf8');
console.log(JSON.stringify({ source, destination, pages: pages.length, boxes: pages.reduce((sum, page) => sum + page.boxes.length, 0), bytes: Buffer.byteLength(output) }, null, 2));

