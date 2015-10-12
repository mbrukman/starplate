'use strict';

/**
 * Module dependencies.
 */

import parse5 from 'parse5';
import {
  text,
  patch,
  elementVoid,
  elementOpen,
  elementClose,
} from 'incremental-dom';

/**
 * Generates a random unique hex ID string.
 *
 * @private
 * @function
 * @name uid
 * @return {String}
 */

const uid = _ => Math.abs(Math.random() * Date.now()|0).toString('16');

/**
 * Ensures a function.
 *
 * @private
 * @function
 * @name ensureFunction
 * @param {Mixed} fn
 * @return {Function}
 */

const ensureFunction = fn => 'function' == typeof fn ? fn : (() => void 0);

/**
 * Parser class.
 *
 * @public
 * @class Parser
 * @extends parse5.Parser
 */

// Parser shared instance
let instance_ = null;
export default class Parser extends parse5.Parser {

  /**
   * Shared parser instance
   *
   * @public
   * @static
   * @method
   * @name sharedInstance
   * @return {Parser}
   */

  static sharedInstance () {
    instance_ = instance_ || new Parser();
    return instance_;
  }

  /**
   * Parser constructor.
   *
   * @public
   * @constructor
   */

  constructor () {
    super(parse5.TreeAdapters.htmlparser2);
  }

  /**
   * Creates a patch function used for updating
   * a given DOM Element from the provided source
   * HTML or DOM Element.
   *
   * @public
   * @method
   * @name createPatch
   * @param {String|Element} html
   * @return {Function} (domElement, [done]) => {Undefined}
   */

  createPatch (html) {
    // consume source HTML if an element is given
    if (html instanceof HTMLElement) {
      html = html.outerHTML;
    }

    const root = this.parseFragment(String(html));
    const nodes = root.children;
    const stack = [];

    /**
     * Creates and pushes an instruction
     * to the render stack.
     *
     * @private
     * @function
     * @name createInstruction
     * @param {Function} fn
     */

    const createInstruction = fn => stack.push(fn);

    /**
     * Call each routine in stack.
     *
     * @private
     * @function
     * @name render
     */

    const render = _ => stack.forEach(routine => routine());

    /**
     * Traverse node recursively appending
     * instructions to stack.
     *
     * @private
     * @function
     * @name traverse
     * @param {Object} node
     */

    const traverse = node => {
      const kv = [];
      const id = node.attribs ? node.attribs.id : uid();
      const attrs = node.attribs;
      const parent = node.parent;
      const hasChildren = Boolean(node.children ? node.children.length : 0);

      // skip lingering text
      if ('root' == parent.type && 'text' == node.type) {
        return;
      }

      if ('tag' == node.type) {
        if (Object.keys(attrs).length) {
          for (let key in attrs) kv.push(key, attrs[key]);
        }
        createInstruction(_ => elementOpen(node.name, id, null, ...kv));
        if (hasChildren) {
          node.children.forEach(traverse);
        }
        createInstruction(_ => elementClose(node.name));
      } else if ('text' == node.type) {
        createInstruction(_ => text(node.data));
      } else {
        throw new TypeError(`Unhandled node type ${node.type}.`);
      }
    };

    // Walk tree and generate
    // incremental DOM routines
    for (let node of nodes) traverse(node);

    /**
     * Patch routine for a given DOM Element.
     *
     * @public
     * @function
     * @param {Element} domElement
     * @param {Function} [done]
     */

    return (domElement, done) => {
      done = ensureFunction(done);
      patch(domElement, _ => {
        stack.forEach(routine => routine());
        done();
      });
    };
  }
}