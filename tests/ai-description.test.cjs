const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Exercise the component's handlers with deterministic hook state and a deferred API.
function setup() {
  const slots = [];
  let cursor, effects, dirty, tree, resolve, reject, calls = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((x, j) => !Object.is(x, previous.deps[j]))) {
        effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const props = {
    selectedIds: [1], selectedImage: { id: 1, sourcePath: 'image.png', filename: 'image.png', tags: [] },
    hasSelection: true, pendingEdit: { mode: 'replace', tags: [], title: '', description: 'Original', rating: 0, colorLabel: '' },
    connection: { libraryDbPath: 'library.db' }, colorLabelOptions: [], planPreview: null,
    onPendingEditChange(update) { props.pendingEdit = update(props.pendingEdit); },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/library/LibraryInspector.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, Error,
    require(name) {
      if (name === './GenerateTagsButton') return { GenerateTagsButton: () => null };
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../../api') return { aiRequest: () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no; }); } };
      return { ColorLabelValue: () => null, DetailRow: () => null, PreviewThumb: () => null, RatingStars: () => null };
    },
  });
  function render(change = {}) {
    Object.assign(props, change);
    for (let n = 0; n < 20; n++) {
      cursor = 0; effects = []; dirty = false;
      tree = exports.LibraryInspector(props);
      effects.forEach(fn => fn());
      if (!dirty) return;
    }
    throw new Error('Render failed to settle');
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const item of node) { const found = find(predicate, item); if (found) return found; } return null; }
    if (predicate(node)) return node;
    return find(predicate, node.props?.children ?? null);
  }
  render();
  find(x => x.type === 'button' && x.props.children === 'Edit').props.onClick();
  render();
  return {
    render, props, find,
    get calls() { return calls; },
    confirm() { find(x => x.type === 'button' && x.props.value === 'ok').props.onClick(); },
    async finish(value = 'Generated description') { resolve({ description: value }); await new Promise(setImmediate); render(); },
    async fail() { reject(new Error('Authentication failed')); await new Promise(setImmediate); render(); },
  };
}

test('only Ok starts a request; duplicate requests are prevented; success stages the draft', async () => {
  const app = setup();
  app.find(x => x.type === 'button' && x.props.children === 'Generate Description').props.onClick();
  assert.equal(app.calls, 0);
  assert.equal(app.find(x => x.props?.value === 'cancel').props.onClick, undefined);
  app.confirm(); app.confirm();
  assert.equal(app.calls, 1);
  app.render();
  assert.equal(app.find(x => x.type === 'button' && x.props.children === 'Generating...').props.disabled, true);
  await app.finish();
  assert.equal(app.props.pendingEdit.description, 'Generated description');
});

test('a response cannot overwrite another selected image', async () => {
  const app = setup(); app.confirm();
  app.render({ selectedIds: [2], selectedImage: { id: 2, sourcePath: 'other.png', tags: [] } });
  await app.finish();
  assert.equal(app.props.pendingEdit.description, 'Original');
});

test('editing the description while waiting protects the new text', async () => {
  const app = setup(); app.confirm();
  app.render({ pendingEdit: { ...app.props.pendingEdit, description: 'My new text' } });
  await app.finish();
  assert.equal(app.props.pendingEdit.description, 'My new text');
});

test('provider failure preserves the draft and displays the error', async () => {
  const app = setup(); app.confirm(); await app.fail();
  assert.equal(app.props.pendingEdit.description, 'Original');
  assert.ok(app.find(x => x.props?.role === 'status' && x.props.children === 'Authentication failed'));
});
