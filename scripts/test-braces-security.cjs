const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
// Resolve through the installed consumer so the test covers the lockfile patch.
const consumerRequire = createRequire(require.resolve('fast-glob', {
  paths: [require.resolve('eslint-config-next')],
}));
const braces = createRequire(consumerRequire.resolve('micromatch'))('braces');
const nested = '{'.repeat(12000) + 'a,b' + '}'.repeat(12000);
for (const method of ['parse', 'compile', 'expand', 'stringify']) {
  assert.throws(() => braces[method](nested), { name: 'SyntaxError' });
}
for (const method of ['compile', 'expand', 'stringify']) {
  let ast = { type: 'text', value: 'leaf' };
  for (let i = 0; i < 12000; i++) ast = { type: 'root', nodes: [ast] };
  assert.throws(() => braces[method](ast), { name: 'SyntaxError' });
  const cyclic = { type: 'root', nodes: [] };
  cyclic.nodes.push(cyclic);
  assert.throws(() => braces[method](cyclic), { name: 'SyntaxError' });
}
assert.deepEqual(braces.expand('src/{app,lib}/{a,b}.ts'), ['src/app/a.ts', 'src/app/b.ts', 'src/lib/a.ts', 'src/lib/b.ts']);
assert.deepEqual(braces.expand('file{1..3}.txt'), ['file1.txt', 'file2.txt', 'file3.txt']);
assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
assert.equal(braces.stringify(braces.parse('foo/{a,b}/bar')), 'foo/{a,b}/bar');
console.log('braces: deep input and ASTs rejected; ordinary patterns preserved');
