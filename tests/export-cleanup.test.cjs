const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function setup({ approve = true, automatic = false, empty = false } = {}) {
  const slots = [];
  let cursor = 0, current, prompts = 0;
  const calls = [];
  const stored = { outputPath: 'exports', ...(automatic ? { clearFolderBeforeExport: true } : {}) };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect() { cursor++; },
  };
  const api = {
    async runExport(db, data, payload) {
      calls.push(payload);
      if (!empty && !payload.clearFolderBeforeExport) return { ok: true, data: { confirmationRequired: true, destinationPath: 'canonical/exports', existingFileCount: 2 } };
      return { ok: true, data: { success: true, exitCode: 0 } };
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/useLibraryExportState.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, Error, window: { localStorage: { getItem: () => JSON.stringify(stored), setItem() {} } },
    require(name) {
      if (name === 'react') return react;
      if (name === '@tauri-apps/plugin-dialog') return { confirm: async () => { prompts++; return approve; } };
      if (name.endsWith('libraryUtils')) return { collectExportSourcePaths: () => ['source.jpg'] };
      return api;
    },
  });
  function render() {
    cursor = 0;
    current = exports.useLibraryExportState({ connection: { libraryDbPath: 'library.db', dataDbPath: '' }, images: [], selectedIds: [1] });
    return current;
  }
  render();
  return { render, calls, get prompts() { return prompts; }, run: () => current.handleRunExport() };
}

test('Cancel aborts before any approved export and defaults old settings to false', async () => {
  const app = setup({ approve: false });
  await app.run();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].clearFolderBeforeExport, false);
  assert.equal(app.prompts, 1);
  assert.match(app.render().exportStatus, /cancelled/);
  assert.equal(app.render().exportInProgress, false);
});

test('Ok retries the same export with clear permission and canonical destination', async () => {
  const app = setup();
  await app.run();
  assert.equal(app.calls.length, 2);
  assert.equal(app.calls[1].clearFolderBeforeExport, true);
  assert.equal(app.calls[1].outputPath, 'canonical/exports');
  assert.equal(app.render().exportSettings.clearFolderBeforeExport, false);
  assert.match(app.render().exportStatus, /completed/);
});

test('automatic clear skips confirmation and duplicate runs are blocked', async () => {
  const app = setup({ automatic: true });
  await Promise.all([app.run(), app.run()]);
  assert.equal(app.calls.length, 1);
  assert.equal(app.prompts, 0);
});

test('empty destination does not prompt', async () => {
  const app = setup({ empty: true });
  await app.run();
  assert.equal(app.prompts, 0);
  assert.equal(app.calls.length, 1);
});
