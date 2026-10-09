import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NamespaceResolver } from '../src/index.js';

test('empty resolver resolves unprefixed name to null', () => {
  const r = new NamespaceResolver();
  assert.equal(r.resolve('local'), null);
});

test('default namespace from innermost element', () => {
  const r = new NamespaceResolver();
  r.push({ '': 'http://example.org/ns' });
  assert.equal(r.resolve('local'), 'http://example.org/ns');
});

test('prefixed name resolves via nearest declaration', () => {
  const r = new NamespaceResolver();
  r.push({ ns: 'http://far.example.org/ns' });
  r.push({ ns: 'http://near.example.org/ns' });
  assert.equal(r.resolve('ns:thing'), 'http://near.example.org/ns');
});

test('prefix declared on ancestor still resolves', () => {
  const r = new NamespaceResolver();
  r.push({ ancestor: 'http://up.example.org/ns' });
  r.push({}); // child declares nothing
  assert.equal(r.resolve('ancestor:item'), 'http://up.example.org/ns');
});

test('pop removes innermost declarations', () => {
  const r = new NamespaceResolver();
  r.push({ ns: 'http://one.example.org/ns' });
  r.push({ ns: 'http://two.example.org/ns' });
  assert.equal(r.resolve('ns:x'), 'http://two.example.org/ns');
  r.pop();
  assert.equal(r.resolve('ns:x'), 'http://one.example.org/ns');
});

test('pop on empty stack is a no-op returning false', () => {
  const r = new NamespaceResolver();
  assert.equal(r.pop(), false);
  assert.equal(r.depth(), 0);
});

test('default namespace can be undeclared with empty string', () => {
  const r = new NamespaceResolver();
  r.push({ '': 'http://parent.example.org/ns' });
  r.push({ '': '' });
  assert.equal(r.resolve('local'), null);
});

test('prefix undeclared yields null', () => {
  const r = new NamespaceResolver();
  r.push({ other: 'http://other.example.org/ns' });
  assert.equal(r.resolve('missing:tag'), null);
});

test('xml prefix is implicitly bound per spec', () => {
  const r = new NamespaceResolver();
  assert.equal(r.resolve('xml:lang'), 'http://www.w3.org/XML/1998/namespace');
});

test('xmlns prefix is reserved and not resolvable', () => {
  const r = new NamespaceResolver();
  assert.equal(r.resolve('xmlns:something'), null);
});

test('empty string QName resolves to null', () => {
  const r = new NamespaceResolver();
  r.push({ '': 'http://default.example.org/ns' });
  assert.equal(r.resolve(''), null);
});

test('malformed qnames with leading or trailing colon resolve to null', () => {
  const r = new NamespaceResolver();
  r.push({ ns: 'http://x.example.org/ns', '': 'http://d.example.org/ns' });
  assert.equal(r.resolve(':local'), null);
  assert.equal(r.resolve('ns:'), null);
});

test('non-string qname throws', () => {
  const r = new NamespaceResolver();
  assert.throws(() => r.resolve(42), /must be a string/);
  assert.throws(() => r.resolve(null), /must be a string/);
});

test('resolvePair splits qname into uri and local part', () => {
  const r = new NamespaceResolver();
  r.push({ ns: 'http://pair.example.org/ns' });
  const [uri, local] = r.resolvePair('ns:thing');
  assert.equal(uri, 'http://pair.example.org/ns');
  assert.equal(local, 'thing');
});

test('resolvePair for unprefixed name returns default ns and whole name', () => {
  const r = new NamespaceResolver();
  r.push({ '': 'http://default.example.org/ns' });
  const [uri, local] = r.resolvePair('plain');
  assert.equal(uri, 'http://default.example.org/ns');
  assert.equal(local, 'plain');
});

test('depth and clear behave as expected', () => {
  const r = new NamespaceResolver();
  assert.equal(r.depth(), 0);
  r.push({ a: 'http://a.example.org/ns' });
  assert.equal(r.depth(), 1);
  r.push({});
  assert.equal(r.depth(), 2);
  r.clear();
  assert.equal(r.depth(), 0);
});

test('push with non-object is treated as empty declarations', () => {
  const r = new NamespaceResolver();
  r.push(null);
  assert.equal(r.depth(), 1);
  assert.equal(r.resolve('local'), null);
});
