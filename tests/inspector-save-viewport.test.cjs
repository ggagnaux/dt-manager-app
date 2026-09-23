const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function browser(layout) {
  const surface = { clientWidth: 600, clientHeight: 416, scrollTop: 0 };
  let cursor, effects, dirty, tree;
  const slots = [];
  const react = {
    memo: component => component,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; } }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useMemo(fn, deps) { const i = cursor++; const old = slots[i];
      if (!old || deps.some((x, j) => !Object.is(x, old.deps[j]))) slots[i] = { deps, value: fn() };
      return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; const old = slots[i];
      if (!old || deps.some((x, j) => !Object.is(x, old.deps[j]))) effects.push(() => {
        old?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      }); },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/library/LibraryResults.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, ResizeObserver: class { observe() {} disconnect() {} }, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return require(name);
    return { PreviewThumb: () => null };
  } });
  const images = Array.from({ length: 150 }, (_, id) => ({ id }));
  const props = { images, selectedIds: [80], changedImageIds: new Set(), thumbnailLayout: layout, isConnected: true };
  function attach(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(attach); return; }
    if (node.props?.className?.includes('results-browser-surface')) node.ref.current = surface;
    attach(node.props?.children);
  }
  function render(change = {}) {
    Object.assign(props, change);
    for (let i = 0; i < 20; i++) {
      cursor = 0; effects = []; dirty = false;
      tree = exports.LibraryResults(props); attach(tree); effects.forEach(fn => fn());
      if (!dirty) return;
    }
    throw new Error('Render did not settle');
  }
  render();
  return { surface, props, render };
}

for (const layout of ['grid', 'rows']) {
  test(`${layout}: save refresh preserves viewport; reordered selected image stays visible`, () => {
    const app = browser(layout);
    const height = layout === 'rows' ? 74 : 208;
    const columns = layout === 'rows' ? 1 : 3;
    const top = Math.floor(80 / columns) * height;
    assert.ok(app.surface.scrollTop <= top);
    assert.ok(app.surface.scrollTop + app.surface.clientHeight >= top + height);
    const previous = app.surface.scrollTop;
    app.render({ images: app.props.images.map(image => ({ ...image })) });
    assert.equal(app.surface.scrollTop, previous);
    app.render({ images: [app.props.images[80], ...app.props.images.filter(image => image.id !== 80)] });
    assert.equal(app.surface.scrollTop, 0);
  });
}
