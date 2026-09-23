const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(path, requireModule) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: requireModule, Error });
  return exports;
}
function setup() {
  const slots = [], calls = [], commits = [];
  let cursor, effects, dirty, hook, resolve, reject, refreshes = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; } }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i];
      if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) effects.push(() => {
        old?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      }); },
  };
  const image = id => ({ id, tags: ['palette|blue'], hierarchicalTags: ['palette|blue'], title: `Image ${id}`, description: '', rating: 0, colorLabel: '' });
  const props = { connection: { libraryDbPath: 'library.db', dataDbPath: 'data.db' }, selectedIds: [1], selectedImage: image(1),
    async onRefreshLibraryData() { refreshes++; },
  };
  const utils = load('src/components/library/libraryUtils.ts', () => ({}));
  const api = {
    applyMetadataEdits(...args) { calls.push(args); return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    async listPendingDbSync() { return { ok: true, data: [] }; },
  };
  const module = load('src/hooks/useLibraryEditState.ts', name => name === 'react' ? react : name === '../api' ? api : utils);
  function render(change = {}) {
    Object.assign(props, change);
    for (let n = 0; n < 20; n++) {
      cursor = 0; effects = []; dirty = false;
      hook = module.useLibraryEditState(props); effects.forEach(fn => fn());
      if (!dirty) return;
    }
    throw new Error('Render did not settle');
  }
  function select(ids) {
    return hook.requestSelectionChange(ids, next => {
      commits.push(Array.from(next));
      render({ selectedIds: next, selectedImage: next.length === 1 ? image(next[0]) : null });
    });
  }
  render();
  return { render, props, calls, commits, select, get hook() { return hook; }, get refreshes() { return refreshes; },
    edit(update) { hook.setPendingEdit(current => ({ ...current, ...update })); render(); },
    async finish(response = { ok: true, data: { writtenCount: 1, summary: 'Saved.', dbSyncStatus: 'synced' } }) {
      resolve(response); await new Promise(setImmediate); render();
    },
    async fail() { reject(new Error('Disk write failed')); await new Promise(setImmediate); render(); },
  };
}

test('selection switches immediately without changes; reselecting never saves', async () => {
  const app = setup(); await app.select([2]);
  assert.deepEqual(app.commits, [[2]]); assert.equal(app.calls.length, 0);
  app.edit({ title: 'Edited' }); await app.select([2]); assert.equal(app.calls.length, 0);
});

test('autosave captures old image and compound tags before switching', async () => {
  const app = setup(); app.edit({ title: 'Edited', tags: ['palette|blue', 'series|Orbs'] });
  const switchResult = app.select([2]); app.render();
  assert.equal(app.hook.saveInProgress, true); assert.equal(app.commits.length, 0);
  assert.deepEqual(Array.from(app.calls[0][2]), [1]);
  assert.deepEqual(Array.from(app.calls[0][3].tags), ['palette|blue', 'series|Orbs']);
  app.edit({ title: 'Should be blocked' }); assert.equal(app.hook.pendingEdit.title, 'Edited');
  await app.finish(); assert.equal(await switchResult, true);
  assert.deepEqual(app.commits, [[2]]); assert.equal(app.hook.pendingEdit.title, 'Image 2');
});

test('rapid clicks and manual save share one write; first selection wins', async () => {
  const app = setup(); app.edit({ description: 'Updated' });
  const manual = app.hook.handleApplyEdits();
  const first = app.select([2]); const second = app.select([3]);
  assert.equal(app.calls.length, 1); assert.equal(await second, false);
  await app.finish(); assert.equal(await manual, true); await first;
  assert.deepEqual(app.commits, [[2]]);
});

test('failed or incomplete writes retain the selection and draft for retry', async () => {
  for (const response of [null, { ok: false, error: 'No access' }, { ok: true, data: { writtenCount: 0 } }]) {
    const app = setup(); app.edit({ title: 'Keep this draft' });
    const switching = app.select([2]);
    if (response) await app.finish(response); else await app.fail();
    assert.equal(await switching, false); assert.equal(app.commits.length, 0);
    assert.equal(app.hook.pendingEdit.title, 'Keep this draft'); assert.equal(app.hook.saveInProgress, false);
    const retry = app.select([2]); await app.finish(); assert.equal(await retry, true);
  }
});

test('switching to multiple images or clearing selection saves the old image', async () => {
  for (const target of [[1, 2], []]) {
    const app = setup(); app.edit({ rating: 4 });
    const switching = app.select(target); await app.finish(); await switching;
    assert.deepEqual(app.commits, [target]); assert.deepEqual(Array.from(app.calls[0][2]), [1]);
  }
});

test('XMP success with queued DB sync permits switching and keeps status visible', async () => {
  const app = setup(); app.edit({ title: 'Edited' }); const switching = app.select([2]);
  await app.finish({ ok: true, data: { writtenCount: 1, dbSyncStatus: 'pending' } }); await switching;
  assert.deepEqual(app.commits, [[2]]); assert.match(app.hook.writeStatus, /queued/);
});

test('a connection change prevents a stale save from changing selection', async () => {
  const app = setup(); app.edit({ title: 'Edited' }); const switching = app.select([2]);
  app.render({ connection: { libraryDbPath: 'other.db', dataDbPath: 'data.db' } });
  await app.finish(); assert.equal(await switching, false); assert.equal(app.commits.length, 0);
});


test('removing the final tag is autosaved as an empty replacement', async () => {
  const app = setup(); app.edit({ tags: [] });
  const switching = app.select([2]);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][3].mode, 'replace'); assert.equal(app.calls[0][3].tags.length, 0);
  await app.finish(); assert.equal(await switching, true);
});
