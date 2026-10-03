import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveAccountingEbitda } from '../src/lib/verifiedFinancialMetrics.js';

const report = {
  year: 2026, includedEntries: 8, pendingEntriesInYear: 1,
  excludedEntries: 0, frameworkReviewStatus: 'validated',
  profitAndLoss: {
    result: 900,
    income: [{ code: '700', amount: 1200 }, { code: '769', amount: 50 }, { code: '771', amount: 20 }],
    expenses: [{ code: '600', amount: 180 }, { code: '662', amount: 30 }, { code: '681', amount: 40 }, { code: '6300', amount: 20 }, { code: '671', amount: 10 }],
  },
};
const metric = deriveAccountingEbitda(report);
assert.equal(metric.value, 940, 'only interest, depreciation and income tax are removed from the PGC result');
assert.equal(metric.provisional, true);
assert.equal(deriveAccountingEbitda({ ...report, includedEntries: 0 }), null);
assert.equal(deriveAccountingEbitda({ ...report, profitAndLoss: null }), null);
const reporting = fs.readFileSync('src/components/reporting/ReportingCenter.jsx', 'utf8');
const hook = fs.readFileSync('src/hooks/useFinancialData.js', 'utf8');
assert.match(reporting, /deriveAccountingEbitda\(accountingReport\)/);
assert.match(reporting, /treasuryError \|\| auxiliaryError/);
assert.match(reporting, /treasury.connectedAccounts === 0/);
assert.match(hook, /treasuryError: error\?/);
console.log(JSON.stringify({ ok: true, checks: ['ledger_derived_ebitda', 'provisional_marked', 'empty_ledger_blocked', 'treasury_failure_not_zero'] }));
