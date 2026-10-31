import {base44} from '@/api/base44Client';
import {registerSessionCleanup} from '@/lib/sessionSecurity.mjs';
import {createDocumentClient,privateDocumentId} from '@/lib/documentClient.mjs';
const documents=createDocumentClient(base44,registerSessionCleanup);
export const uploadCompanyDocument=documents.upload;
export const uploadUnassignedDocument=documents.uploadStaging;
export const assignStagedDocument=documents.assignStaged;
export const openPrivateDocument=documents.open;
export {privateDocumentId};
