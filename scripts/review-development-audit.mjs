import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const ADVISORY='https://github.com/advisories/GHSA-g3hv-75wg-m249';
const REVIEWED_SOURCE_SHA256='746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d';
const reviewedNames=new Set(['minimatch','eslint','@eslint-community/eslint-utils','@eslint/config-array','@eslint/eslintrc','eslint-plugin-react','eslint-plugin-react-refresh','eslint-plugin-unused-imports']);

/** This review never suppresses npm output or changes dependency resolution. */
export function reviewDevelopmentAudit(audit,root=process.cwd()) {
  if(!audit?.metadata?.vulnerabilities||!audit.vulnerabilities)throw Error('Incomplete dependency audit');
  const vulnerabilities=Object.values(audit.vulnerabilities);
  if(!vulnerabilities.length)return {status:'no_known_alerts',remainingAlerts:0};
  const lock=JSON.parse(fs.readFileSync(root+'/package-lock.json','utf8'));
  for(const item of vulnerabilities){
    if(item.severity!=='moderate'||!reviewedNames.has(item.name))throw Error('New dependency risk requires review: '+item.name);
    for(const node of item.nodes||[])if(lock.packages?.[node]?.dev!==true)throw Error('Reviewed exception must remain development-only: '+node);
    for(const cause of item.via||[]){
      if(typeof cause==='string'){if(!reviewedNames.has(cause))throw Error('Unknown dependency cause: '+cause);}
      else if(cause.url!==ADVISORY)throw Error('New advisory requires review: '+cause.url);
    }
  }
  const require=createRequire(root+'/package.json');
  const pkg=require('minimatch/package.json'),source=fs.readFileSync(require.resolve('minimatch'),'utf8');
  if(pkg.version!=='3.1.5'||createHash('sha256').update(source).digest('hex')!==REVIEWED_SOURCE_SHA256)throw Error('Dependency changed; repeat compatibility and exposure review');
  if(source.includes('firstPhasePreProcess')||source.includes('optimizationLevel'))throw Error('Reviewed amplification mechanism is present');
  return {
    status:'reviewed_development_exception',remainingAlerts:vulnerabilities.length,
    advisory:ADVISORY,installedVersion:pkg.version,productionExposure:'absent in npm --omit=dev tree',
    finding:'The advisory describes the 10.x optimizationLevel>=2 preprocessing path; reviewed 3.1.5 has no such path.',
    limitation:'npm still reports these alerts. This is a bounded exposure review, not a vendor backport or a universal absence-of-risk claim.',
    upgrade:'11.0.3 changes the CommonJS callable API; existing ESLint/React consumers fail without a migration. No forced override or audit ignore was added.',
  };
}
