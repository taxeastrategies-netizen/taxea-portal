import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const groups = [
  {
    canonical: 'base44/functions/accountingOperations/accountingEngine.ts',
    copies: [
      'base44/functions/anularFacturas/accountingEngine.ts',
      'base44/functions/approveOcrDocument/accountingEngine.ts',
      'base44/functions/invoiceOperations/accountingEngine.ts',
      'base44/functions/migrateAccountingToPgc8/accountingEngine.ts',
      'base44/functions/openBanking/accountingEngine.ts',
    ],
  },
  {
    canonical: 'base44/functions/accountingOperations/accountingReportEngine.ts',
    copies: ['base44/functions/businessDashboardOperations/accountingReportEngine.ts'],
  },
];

for (const group of groups) {
  const source = fs.readFileSync(path.resolve(root, group.canonical), 'utf8');
  for (const target of group.copies) fs.writeFileSync(path.resolve(root, target), source, 'utf8');
}

console.log(JSON.stringify({ ok: true, groups }, null, 2));
