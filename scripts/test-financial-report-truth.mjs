import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveAccountingEbitda, financialReportReadiness, financialScoringReadiness, financialExportNumber, financialPercentLabel } from '../src/lib/verifiedFinancialMetrics.js';

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
assert.match(reporting, /reportingMetricSnapshot\(shared,debts,accountingReport\)/);
assert.match(reporting, /financialReportReadiness\(\{financials,financialError,treasuryError,auxiliaryError/);
const known={bankKnown:true,accountingKnown:true,accountingEbitda:{value:0}};
assert.equal(financialReportReadiness({financials:known}).ready,true,'confirmed zero EBITDA is not absence');
for(const input of [{financials:{...known,bankKnown:false}},{financials:{...known,accountingKnown:false}},{financials:{...known,accountingEbitda:null}},{financials:known,treasuryError:'failed'},{financials:known,calendarError:true},{financials:known,financialError:'failed'}])assert.equal(financialReportReadiness(input).ready,false,'reports require verified sources, not just connected-account counts');
assert.match(hook, /treasuryError: error\?/);
for(const value of [null,undefined,NaN,Infinity,false,''])assert.equal(financialExportNumber(value),'No verificable','unknown financial export cell is never zero');
assert.equal(financialExportNumber(0),0,'observed zero is exportable as zero');
assert.equal(financialExportNumber('12.34'),12.34,'numeric financial amount stays numeric');
const complete={bankKnown:true,accountingKnown:true,accountingProvisional:false,cashHistorySufficient:true,runway:0,dso:0,margen:0};
assert.equal(financialScoringReadiness(complete),true,'actual zero runway and immediate observed collection are valid data');
for(const patch of [{bankKnown:false},{accountingProvisional:true},{cashHistorySufficient:false},{runway:null},{dso:null}])assert.equal(financialScoringReadiness({...complete,...patch}),false,'incomplete coverage cannot generate a company score');
assert.equal(financialPercentLabel(null),'No verificable','undefined margin is not zero percent');
assert.equal(financialPercentLabel(0),'0.0%','measured zero margin remains zero');
console.log(JSON.stringify({ ok: true, checks: ['ledger_derived_ebitda', 'provisional_marked', 'empty_ledger_blocked', 'treasury_failure_not_zero'] }));
