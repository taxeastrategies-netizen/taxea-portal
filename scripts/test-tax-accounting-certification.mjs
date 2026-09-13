import assert from 'node:assert/strict';
import {
  buildPhase0Certification,
  FISCAL_CATALOG_CODES,
  PHASE0_CERTIFICATION_VERSION,
  TAX_MODEL_ENGINE_CODES,
  runSyntheticCertificationSuite,
} from '../base44/functions/taxAccountingCertification/certificationEngine.js';

const suite = runSyntheticCertificationSuite();
assert.equal(suite.ok, true, JSON.stringify(suite, null, 2));
assert.equal(TAX_MODEL_ENGINE_CODES.length, 22);
assert.equal(new Set(TAX_MODEL_ENGINE_CODES).size, TAX_MODEL_ENGINE_CODES.length);
assert.equal(new Set(FISCAL_CATALOG_CODES).size, FISCAL_CATALOG_CODES.length);
assert.equal(FISCAL_CATALOG_CODES.includes('232'), true);
const unreadable = buildPhase0Certification({ companyId: 'company-a', sources: {}, sourceErrors: { invoices: 'simulated_failure' } });
assert.equal(unreadable.status, 'blocked');
assert.equal(unreadable.checks.find(item => item.id === 'source_readability')?.status, 'blocked');

console.log(JSON.stringify({ ok: true, version: PHASE0_CERTIFICATION_VERSION, suite }, null, 2));
