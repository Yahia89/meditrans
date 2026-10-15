import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// The compiler-based hooks lint can bail out on a large component before
// reporting set-state-in-render. Keep this small AST guard independent of it.
function memoUpdates(source) {
  const file = ts.createSourceFile('directory.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const setters = new Set();
  const visit = (node, callback) => {
    callback(node);
    ts.forEachChild(node, child => visit(child, callback));
  };
  visit(file, node => {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isCallExpression(node.initializer)) return;
    const hook = node.initializer.expression.getText(file).split('.').at(-1);
    if (hook === 'useDirectoryPagination' && ts.isObjectBindingPattern(node.name)) {
      for (const binding of node.name.elements) {
        if ((binding.propertyName ?? binding.name).getText(file) === 'setCurrentPage') setters.add(binding.name.getText(file));
      }
      return;
    }
    if (!ts.isArrayBindingPattern(node.name)) return;
    if (!['useState', 'useReducer', 'useQueryState', 'useRouteQueryState'].includes(hook)) return;
    const setter = node.name.elements[1];
    if (setter && ts.isBindingElement(setter)) setters.add(setter.name.getText(file));
  });
  const updates = [];
  visit(file, node => {
    if (!ts.isCallExpression(node) || node.expression.getText(file).split('.').at(-1) !== 'useMemo') return;
    const calculate = node.arguments[0];
    if (!calculate || !(ts.isArrowFunction(calculate) || ts.isFunctionExpression(calculate))) return;
    const inspect = child => {
      // Returning a callback is pure; calling an updater while calculating is not.
      if (ts.isArrowFunction(child) || ts.isFunctionExpression(child) || ts.isFunctionDeclaration(child)) return;
      if (ts.isCallExpression(child) && setters.has(child.expression.getText(file))) {
        updates.push({ setter: child.expression.getText(file), line: file.getLineAndCharacterOfPosition(child.getStart(file)).line + 1 });
      }
      ts.forEachChild(child, inspect);
    };
    inspect(calculate.body);
  });
  return updates;
}

test('purity guard catches pagination updates even when a component defeats compiler lint', () => {
  for (const dependencies of ['searchQuery', 'searchQuery, statusFilter']) {
    const bad = `function Directory() {
      const [currentPage, setCurrentPage] = useState(1);
      useMemo(() => { setCurrentPage(1); }, [${dependencies}]);
    }`;
    assert.equal(memoUpdates(bad)[0]?.setter, 'setCurrentPage');
  }
  assert.equal(memoUpdates(`function Directory() {
    const { setCurrentPage: resetPage } = useDirectoryPagination('5', 13);
    useMemo(() => { resetPage(1); }, [searchQuery]);
  }`)[0]?.setter, 'resetPage', 'the repaired shared hook must not hide a reintroduced memo update');
  assert.deepEqual(memoUpdates(`function Directory() {
    const [page, setPage] = useState(1);
    const next = useMemo(() => () => setPage(page + 1), [page]);
    if (page < 1) setPage(1);
  }`), [], 'event callbacks and guarded synchronization are not unconditional memo updates');
});

for (const directory of ['patients', 'drivers', 'employees', 'patient-details']) {
  test(`${directory} memo calculations do not update UI state or query URLs`, () => {
    const source = readFileSync(new URL(`../components/${directory}-page.tsx`, import.meta.url), 'utf8');
    assert.deepEqual(memoUpdates(source), []);
  });
}
