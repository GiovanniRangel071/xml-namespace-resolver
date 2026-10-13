# XML Namespace Resolver

Resolves XML qualified names (QNames) to namespace URIs against a stack of namespace declarations harvested from ancestor elements.

## Usage

```js
import { NamespaceResolver } from './src/index.js';

const resolver = new NamespaceResolver();
resolver.push({ '': 'http://default.example.org/ns', svg: 'http://www.w3.org/2000/svg' });

resolver.resolve('circle');      // 'http://default.example.org/ns'
resolver.resolve('svg:rect');    // 'http://www.w3.org/2000/svg'
resolver.pop();                  // leave the element's scope
```

`NamespaceResolver` exports one class. Methods: `push(declarations)`, `pop()`, `resolve(qname)`, `resolvePair(qname)`, `depth()`, `clear()`.

## Why this exists

XML namespace resolution is mechanically simple but fiddly: the prefix for a QName is resolved against the nearest declaration in scope, walking up the ancestor chain, and the default namespace (the empty-string prefix) applies only to unprefixed names. General XML libraries carry this logic bundled inside a full parser; if you already have a parser that hands you namespace maps per element (SAX handlers, pull-parsers, hand-rolled readers), you just need the resolution step. This is that step, with no parser attached.

The trade-off: the resolver is scope-based, not document-aware. It does not validate that prefixes conform to the NCName production, does not check that the `xml` prefix is only bound to its fixed URI, and does not enforce the rule that `xmlns` is reserved. It applies the resolution algorithm and trusts what you push.

## The awkward edge

The default namespace (prefix `""`) can be explicitly *undeclared* by binding it to an empty string, per XML Namespaces 1.1. This library honours that: `push({ '': '' })` on top of an element that declared a default namespace will cause unprefixed names in the child to resolve to `null`, not to the parent's default. The XML Namespaces 1.0 spec did not permit this undeclaration; if you need 1.0-strict behaviour you must filter empty bindings before pushing.

The `xml` prefix is implicitly bound to `http://www.w3.org/XML/1998/namespace` without needing a declaration, and `xmlns` is treated as unresolvable (reserved). Neither is overridable through `push`.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

