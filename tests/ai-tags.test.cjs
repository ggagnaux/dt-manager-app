const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Exercise the component's handlers with deterministic hook state and a deferred API.
function setup({ immediate = false, settingsError = false, tagsError = false } = {}) {
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
    connection: { libraryDbPath: 'library.db', dataDbPath: 'data.db' }, colorLabelOptions: [], planPreview: null,
    onPendingEditChange(update) { props.pendingEdit = update(props.pendingEdit); },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/library/GenerateTagsButton.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, Error,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../../api') return {
        listTags: async () => tagsError ? { ok: false, error: 'Unable to load tags' } : ({ ok: true, data: ['palette|Blue'] }),
        aiRequest: action => {
          if (action === 'load') return settingsError ? Promise.reject(new Error('Unable to load settings')) : Promise.resolve({ applyAiGeneratedTagsImmediately: immediate });
          calls++; return new Promise((yes, no) => { resolve = yes; reject = no; });
        },
      };
      return { ColorLabelValue: () => null, DetailRow: () => null, PreviewThumb: () => null, RatingStars: () => null };
    },
  });
  function render(change = {}) {
    Object.assign(props, change);
    for (let n = 0; n < 20; n++) {
      cursor = 0; effects = []; dirty = false;
      tree = exports.GenerateTagsButton(props);
      effects.forEach(fn => fn());
      if (!dirty) return;
    }
    throw new Error('Render failed to settle');
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const item of node) { const found = item == null ? null : find(predicate, item); if (found) return found; } return null; }
    if (predicate(node)) return node;
    return find(predicate, node.props?.children ?? null);
  }
  render();
  return {
    render, props, find,
    get calls() { return calls; },
    generate() { find(x => x.type === 'button' && x.props.children === 'Generate Tags').props.onClick(); },
    apply() { find(x => x.type === 'button' && x.props.children === 'Apply Tags').props.onClick(); },
    cancel() { find(x => x.type === 'button' && x.props.children === 'Cancel').props.onClick(); },
    async finish(value = ['palette|blue', 'palette|cream']) { resolve({ tags: value }); await new Promise(setImmediate); render(); },
    async fail() { reject(new Error('Authentication failed')); await new Promise(setImmediate); render(); },
  };
}

test('generation reuses existing spelling and stages selected tags only on Apply', async () => {
  const app = setup();
  app.render({ pendingEdit: { ...app.props.pendingEdit, tags: ['existing'] } });
  app.generate(); app.generate();
  assert.equal(app.calls, 1);
  await app.finish();
  assert.deepEqual(app.props.pendingEdit.tags, ['existing']);
  app.apply();
  assert.deepEqual(Array.from(app.props.pendingEdit.tags), ['existing', 'palette|Blue', 'palette|cream']);
  app.generate(); await app.finish(); app.apply();
  assert.equal(app.props.pendingEdit.tags.length, 3);
});

test('cancel and selection changes discard late results', async () => {
  for (const action of ['cancel', 'selection', 'database']) {
    const app = setup(); app.generate();
    if (action === 'cancel') app.cancel();
    if (action === 'selection') app.render({ selectedIds: [2], selectedImage: { id: 2, sourcePath: 'other.png', tags: [] } });
    if (action === 'database') app.render({ connection: { libraryDbPath: 'other.db', dataDbPath: 'data.db' } });
    await app.finish();
    assert.equal(app.find(x => x.type === 'button' && x.props.children === 'Apply Tags').props.disabled, true);
    assert.equal(app.props.pendingEdit.tags.length, 0);
  }
});

test('deselected colors are omitted and staged removals retain their meaning', async () => {
  const app = setup();
  app.render({ selectedImage: { ...app.props.selectedImage, tags: ['keep', 'remove'] }, pendingEdit: { ...app.props.pendingEdit, mode: 'remove', tags: ['remove'] } });
  app.generate(); await app.finish();
  app.find(x => x.type === 'button' && x.props['aria-pressed'] === true).props.onClick();
  app.render(); app.apply();
  assert.equal(app.props.pendingEdit.mode, 'replace');
  assert.deepEqual(Array.from(app.props.pendingEdit.tags), ['keep', 'palette|cream']);
});

test('errors and empty results preserve the draft and allow retry', async () => {
  const app = setup(); app.generate(); await app.fail();
  assert.ok(app.find(x => x.props?.role === 'status' && x.props.children === 'Authentication failed'));
  assert.ok(app.find(x => x.type === 'button' && x.props.children === 'Retry'));
  app.generate(); await app.finish([]);
  assert.equal(app.props.pendingEdit.tags.length, 0);
  assert.equal(app.find(x => x.type === 'button' && x.props.children === 'Apply Tags').props.disabled, true);
});


test('immediate mode applies all successful tags with existing spelling', async () => {
  const app = setup({ immediate: true });
  app.render({ pendingEdit: { ...app.props.pendingEdit, tags: ['existing'] } });
  app.generate(); await app.finish();
  assert.deepEqual(Array.from(app.props.pendingEdit.tags), ['existing', 'palette|Blue', 'palette|cream']);
  app.generate(); await app.finish();
  assert.equal(app.props.pendingEdit.tags.length, 3);
});

test('immediate mode never applies tags on AI, tag lookup, or settings errors', async () => {
  for (const options of [{ immediate: true }, { immediate: true, settingsError: true }, { immediate: true, tagsError: true }]) {
    const app = setup(options); app.generate();
    if (options.settingsError || options.tagsError) await app.finish(); else await app.fail();
    assert.equal(app.props.pendingEdit.tags.length, 0);
    assert.ok(app.find(x => x.props?.role === 'status' && x.props.children));
    assert.ok(app.find(x => x.type === 'button' && x.props.children === 'Retry'));
  }
});

test('immediate mode ignores empty, cancelled, and stale results', async () => {
  for (const action of ['empty', 'cancel', 'selection']) {
    const app = setup({ immediate: true }); app.generate();
    if (action === 'cancel') app.cancel();
    if (action === 'selection') app.render({ selectedIds: [2], selectedImage: { id: 2, sourcePath: 'other.png', tags: [] } });
    await app.finish(action === 'empty' ? [] : ['palette|blue']);
    assert.equal(app.props.pendingEdit.tags.length, 0);
  }
});
