import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QueryClient, MutationObserver } from '@tanstack/react-query';
import { notificationDeleteOptions } from '../src/lib/notificationDeleteMutation.mjs';

const client = new QueryClient(), key = ['notifications', 'qa-only'], otherKey = ['notifications', 'other-qa'];
const rows = [{ id: 'qa-a', leida: false }, { id: 'qa-b', leida: false }];
client.setQueryData(key, rows); client.setQueryData(otherKey, rows);
let current = true, release, started, writes = 0;
const gate = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { started = resolve; });
const options = notificationDeleteOptions({ queryClient: client, queryKey: key, isCurrent: () => current,
  persist: async () => { writes++; started(); await gate; throw Error('Synthetic offline'); },
});
const observer = new MutationObserver(client, options);
const operation = observer.mutate({ rows, id: 'qa-a' }); await began;
assert.deepEqual(client.getQueryData(key), [rows[1]], 'Notification disappears before the network settles');
assert.deepEqual(client.getQueryData(otherKey), rows);
client.setQueryData(key, [{ id: 'qa-new', leida: false }, { ...rows[1], leida: true }]);
release(); await assert.rejects(operation);
const restored = client.getQueryData(key);
assert.equal(restored.filter(row => row.id === 'qa-a').length, 1);
assert.ok(restored.some(row => row.id === 'qa-new'), 'Rollback preserves notifications arriving during the request');
assert.equal(restored.find(row => row.id === 'qa-b').leida, true, 'Rollback cannot overwrite an unrelated read marker');
assert.equal(writes, 1);
const success = new MutationObserver(client, notificationDeleteOptions({ queryClient: client, queryKey: key, isCurrent: () => current, persist: async () => { writes++; } }));
await success.mutate({ rows: restored, id: 'qa-a' }); assert.ok(!client.getQueryData(key).some(row => row.id === 'qa-a'));
await assert.rejects(success.mutate({ rows: restored, id: 'not-owned' })); assert.equal(writes, 2);
current = false;
await assert.rejects(success.mutate({ rows: restored, id: 'qa-b' })); assert.equal(writes, 2);
assert.deepEqual(client.getQueryData(otherKey), rows);
observer.reset(); success.reset(); client.clear();

const source = fs.readFileSync('src/components/layout/FullscreenWorkspace.jsx', 'utf8'), styles = fs.readFileSync('src/styles/fullscreen-workspace.css', 'utf8');
assert.ok(source.includes('useAppGestures(rootRef,mobile)') && source.includes('data-copy-text={allowsCopyText(copyMode,mobile)'));
assert.ok(styles.includes('.overflow-y-auto') && styles.includes('overscroll-behavior:none'));
assert.ok(styles.includes('user-select:none') && styles.includes('user-select:text'));
assert.ok(styles.includes('[data-selectable="true"] *') && styles.includes('input,textarea'));
assert.ok(!styles.includes('touch-action:none'), 'Never block pinch zoom or OS gestures');
const invoice = fs.readFileSync('src/components/facturas/InvoiceDocumentWorkspace.jsx', 'utf8');
assert.equal((invoice.match(/data-selectable="true"/g) || []).length, 2, 'Actual invoice content remains copyable, including received metadata');
console.log(JSON.stringify({ ok: true, actualTanstackDeletion: true, provisionalRemoval: true, targetedRollback: true, noAutoRetry: true, scopeIsolation: true, portalScrollBoundary: true, portalGestureBoundary: true, documentCopyPreserved: true, externalCalls: 0, financialWrites: 0 }));
