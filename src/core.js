/**
 * XML Namespace Resolver.
 *
 * Resolves XML qualified names (QNames) to namespace URIs against a stack of
 * namespace declarations harvested from ancestor elements. The resolver is
 * stateful: call push() as you descend through elements, pop() as you ascend.
 *
 * Why a dedicated object rather than reusing a plain Map per element:
 * element-local maps lose the ancestor chain, which is exactly the context an
 * XML processor needs to resolve a prefix declared three levels up.
 */
export class NamespaceResolver {
  constructor() {
    /**
     * @type {Array<Map<string, string>>}
     * Stack[0] is the innermost (current) element's bindings; higher indices
     * are ancestors. We push unshift-style by indexing from the front so
     * lookups naturally prefer nearer declarations.
     */
    this._stack = [];
  }

  /**
   * Push the namespace declarations declared on one element.
   *
   * @param {Record<string, string>} declarations - map of prefix to URI.
   *   An empty object is fine and represents an element that declares no
   *   namespaces of its own (it still inherits from ancestors).
   * @returns {NamespaceResolver} this, for chaining.
   */
  push(declarations) {
    if (declarations !== null && typeof declarations === 'object') {
      this._stack.push(new Map(Object.entries(declarations)));
    } else {
      this._stack.push(new Map());
    }
    return this;
  }

  /**
   * Pop the most recently pushed element's declarations. Popping an empty
   * stack is a no-op rather than an error: SAX-style handlers frequently pair
   * startElement/endElement and a stray endElement on an unbalanced document
   * should not throw the namespace layer.
   *
   * @returns {boolean} true if something was actually popped.
   */
  pop() {
    if (this._stack.length === 0) return false;
    this._stack.pop();
    return true;
  }

  /**
   * Resolve a QName like "ns:local" or "local" to a namespace URI.
   *
   * Rules implemented (the XML Namespaces 1.0 resolution algorithm):
   *  - "prefix:local" → first URI found for prefix scanning from innermost
   *    to outermost declaration. Prefix not declared → null.
   *  - "local" (no prefix) → the default namespace URI if one is in scope,
   *    otherwise null. An empty-string default namespace explicitly undefines
   *    the default, yielding null (not the ancestor's default).
   *
   * @param {string} qname - the qualified name to resolve.
   * @returns {string|null} the namespace URI, or null when there is none.
   * @throws {Error} if qname is not a string.
   */
  resolve(qname) {
    if (typeof qname !== 'string') {
      throw new Error(`qname must be a string, got ${typeof qname}`);
    }
    if (qname === '') return null;

    const colon = qname.indexOf(':');
    if (colon === -1) {
      return this._lookupPrefix('');
    }
    if (colon === 0 || colon === qname.length - 1) {
      // Malformed QName with a leading or trailing colon. Treat as
      // undeclared prefix so callers see a consistent "not resolvable"
      // signal rather than a partial lookup.
      return null;
    }
    const prefix = qname.slice(0, colon);
    if (prefix === 'xml') return 'http://www.w3.org/XML/1998/namespace';
    if (prefix === 'xmlns') return null;
    return this._lookupPrefix(prefix);
  }

  /**
   * Convenience: return [uri, localName] for a QName, which is what most
   * downstream code actually wants (a psuedo Clark notation pair).
   *
   * @param {string} qname
   * @returns {[string|null, string]}
   */
  resolvePair(qname) {
    if (typeof qname !== 'string') {
      throw new Error(`qname must be a string, got ${typeof qname}`);
    }
    if (qname === '') return [null, ''];
    const colon = qname.indexOf(':');
    if (colon <= 0 || colon >= qname.length - 1) {
      return [this.resolve(qname), qname];
    }
    const local = qname.slice(colon + 1);
    return [this.resolve(qname), local];
  }

  /**
   * @returns {number} current depth (0 means no element context).
   */
  depth() {
    return this._stack.length;
  }

  /**
   * @returns {NamespaceResolver} this, reset to empty.
   */
  clear() {
    this._stack.length = 0;
    return this;
  }

  /**
   * Look up a prefix scanning from innermost to outermost. The first
   * declaration encountered wins, which is the nearest-declaration rule of
   * XML Namespaces 1.0 §6.2.
   *
   * @param {string} prefix
   * @returns {string|null}
   */
  _lookupPrefix(prefix) {
    for (let i = this._stack.length - 1; i >= 0; i--) {
      const layer = this._stack[i];
      if (layer.has(prefix)) {
        const uri = layer.get(prefix);
        // Explicit empty string means "undeclared here". We still return it
        // literally so the caller sees null for the default and "" for a
        // redefined prefix. For resolution purposes empty == no namespace.
        return uri === '' ? null : uri;
      }
    }
    return null;
  }
}
