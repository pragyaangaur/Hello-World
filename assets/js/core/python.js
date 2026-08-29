/* A small Python interpreter, written from scratch in plain JavaScript.

   Two of the exercises in this app are written in Python, and the app is not
   allowed to fetch a runtime, carry a dependency, or run a build step. So the
   runtime is here, in one file, and it covers the part of the language those
   exercises need. When it meets something it does not know, it says so in
   plain words rather than failing in a way nobody can read.

   Values map onto JavaScript like this:

     None    null            int, float   number
     bool    boolean         str          string
     list    Array           dict         Map
     tuple   Array           function     PyFunction

   Anything passed in from the app that is not one of those is a host object.
   Host objects can be read with a dot and called like functions, which is how
   the exercises hand real behaviour to the code a player writes. */

/* ------------------------------------------------------------------ errors */

export class PyError extends Error {
  constructor(kind, detail, line) {
    super(line ? `${kind}: ${detail} (line ${line})` : `${kind}: ${detail}`);
    this.kind = kind;
    this.detail = detail;
    this.line = line || null;
  }
}

function fail(kind, detail, line) { throw new PyError(kind, detail, line); }

/* ------------------------------------------------------------- the scanner */

const KEYWORDS = new Set([
  'and', 'or', 'not', 'if', 'elif', 'else', 'for', 'while', 'in', 'is', 'def',
  'return', 'pass', 'break', 'continue', 'True', 'False', 'None', 'import',
  'from', 'class', 'try', 'except', 'finally', 'with', 'as', 'lambda',
  'global', 'nonlocal', 'del', 'raise', 'yield', 'assert', 'async', 'await'
]);

/* Longest first, so that // is never read as two divisions. */
const OPERATORS = [
  '//=', '**=', '//', '**', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=',
  '(', ')', '[', ']', '{', '}', ',', ':', '.', ';',
  '+', '-', '*', '/', '%', '<', '>', '='
];

const OPENERS = { '(': ')', '[': ']', '{': '}' };

function isNameStart(c) { return /[A-Za-z_]/.test(c); }
function isNamePart(c) { return /[A-Za-z0-9_]/.test(c); }
function isDigit(c) { return c >= '0' && c <= '9'; }

/* Reads one quoted string starting at `i`. Returns the text and where the
   closing quote left off. Escapes are handled here so the parser never has
   to think about them. */
function readQuoted(src, i, line) {
  const quote = src[i];
  if (src.slice(i, i + 3) === quote + quote + quote) {
    fail('SyntaxError', 'this interpreter does not support triple quoted strings', line);
  }
  let out = '';
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') {
      const n = src[j + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === '0') out += '\0';
      else if (n === '\\') out += '\\';
      else if (n === "'") out += "'";
      else if (n === '"') out += '"';
      else out += '\\' + (n === undefined ? '' : n);
      j += 2;
      continue;
    }
    if (c === quote) return { text: out, end: j + 1 };
    out += c;
    j++;
  }
  fail('SyntaxError', 'this string has no closing quote', line);
}

/* An f-string is stored as its pieces. Plain text stays text, and everything
   between a single pair of braces is kept as source to be parsed later. */
function splitFormat(text, line) {
  const parts = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '{' && text[i + 1] === '{') { buf += '{'; i += 2; continue; }
    if (c === '}' && text[i + 1] === '}') { buf += '}'; i += 2; continue; }
    if (c === '}') fail('SyntaxError', "a '}' in an f-string has no matching '{'", line);
    if (c === '{') {
      if (buf) { parts.push({ kind: 'text', value: buf }); buf = ''; }
      let depth = 1;
      let j = i + 1;
      let expr = '';
      while (j < text.length && depth > 0) {
        const d = text[j];
        if (d === '{') depth++;
        else if (d === '}') { depth--; if (depth === 0) break; }
        expr += d;
        j++;
      }
      if (depth > 0) fail('SyntaxError', "a '{' in an f-string has no matching '}'", line);
      /* Format specs such as {x:.2f} are not supported, and saying so is
         kinder than quietly printing the spec as part of the value. */
      const spec = expr.indexOf(':');
      if (spec !== -1 && !/[[({]/.test(expr.slice(0, spec))) {
        fail('SyntaxError', 'format specifiers inside f-strings are not supported here, try round() instead', line);
      }
      if (!expr.trim()) fail('SyntaxError', 'this f-string has an empty {}', line);
      parts.push({ kind: 'expr', src: expr, line });
      i = j + 1;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf) parts.push({ kind: 'text', value: buf });
  return parts;
}

export function tokenize(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const tokens = [];
  const indents = [0];
  const brackets = [];
  let line = 0;

  const push = (type, value) => tokens.push({ type, value, line });

  for (let n = 0; n < lines.length; n++) {
    const text = lines[n];
    line = n + 1;
    let i = 0;

    if (brackets.length === 0) {
      let col = 0;
      while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
        col += text[i] === '\t' ? 4 : 1;
        i++;
      }
      const rest = text.slice(i);
      if (rest === '' || rest[0] === '#') continue;

      if (col > indents[indents.length - 1]) {
        indents.push(col);
        push('indent');
      } else while (col < indents[indents.length - 1]) {
        indents.pop();
        push('dedent');
        if (col > indents[indents.length - 1]) {
          fail('IndentationError', 'this line does not line up with any block above it', line);
        }
      }
    }

    while (i < text.length) {
      const c = text[i];

      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;

      if (c === '"' || c === "'") {
        const { text: value, end } = readQuoted(text, i, line);
        push('str', value);
        i = end;
        continue;
      }

      if ((c === 'f' || c === 'F') && (text[i + 1] === '"' || text[i + 1] === "'")) {
        const { text: value, end } = readQuoted(text, i + 1, line);
        push('fstr', splitFormat(value, line));
        i = end;
        continue;
      }

      if (isDigit(c) || (c === '.' && isDigit(text[i + 1] || ''))) {
        let j = i;
        while (j < text.length && (isDigit(text[j]) || text[j] === '_')) j++;
        if (text[j] === '.' && isDigit(text[j + 1] || '')) {
          j++;
          while (j < text.length && (isDigit(text[j]) || text[j] === '_')) j++;
        }
        if (text[j] === 'e' || text[j] === 'E') {
          let k = j + 1;
          if (text[k] === '+' || text[k] === '-') k++;
          if (isDigit(text[k] || '')) { j = k; while (j < text.length && isDigit(text[j])) j++; }
        }
        push('num', Number(text.slice(i, j).replace(/_/g, '')));
        i = j;
        continue;
      }

      if (isNameStart(c)) {
        let j = i;
        while (j < text.length && isNamePart(text[j])) j++;
        const word = text.slice(i, j);
        push(KEYWORDS.has(word) ? 'keyword' : 'name', word);
        i = j;
        continue;
      }

      const op = OPERATORS.find(o => text.startsWith(o, i));
      if (!op) fail('SyntaxError', `this character means nothing to me: ${c}`, line);
      if (OPENERS[op]) brackets.push(OPENERS[op]);
      else if (op === ')' || op === ']' || op === '}') {
        const want = brackets.pop();
        if (!want) fail('SyntaxError', `there is a closing ${op} with nothing to close`, line);
        if (want !== op) fail('SyntaxError', `expected ${want} here but found ${op}`, line);
      }
      push('op', op);
      i += op.length;
    }

    if (brackets.length === 0 && tokens.length && tokens[tokens.length - 1].type !== 'newline') {
      push('newline');
    }
  }

  if (brackets.length) fail('SyntaxError', `a ${brackets[brackets.length - 1]} is missing`, line);
  line = lines.length + 1;
  while (indents.length > 1) { indents.pop(); push('dedent'); }
  push('eof');
  return tokens;
}

/* -------------------------------------------------------------- the parser */

/* The grammar is the ordinary Python one with the parts this app does not
   need left out. Classes, imports, generators, comprehensions and exception
   handling all parse far enough to be refused with a sentence a learner can
   act on. */

const UNSUPPORTED = {
  import: 'there is nothing to import here, everything you need is already defined',
  from: 'there is nothing to import here, everything you need is already defined',
  class: 'classes are not supported in this editor',
  try: 'try and except are not supported in this editor',
  except: 'try and except are not supported in this editor',
  finally: 'try and except are not supported in this editor',
  with: 'with blocks are not supported in this editor',
  lambda: 'lambda is not supported in this editor, write a def instead',
  yield: 'yield is not supported in this editor',
  global: 'global is not supported in this editor',
  nonlocal: 'nonlocal is not supported in this editor',
  del: 'del is not supported in this editor',
  raise: 'raise is not supported in this editor',
  assert: 'assert is not supported in this editor',
  async: 'async is not supported in this editor',
  await: 'await is not supported in this editor'
};

function describe(token) {
  if (!token || token.type === 'eof') return 'the end of the code';
  if (token.type === 'newline') return 'the end of the line';
  if (token.type === 'indent') return 'an indented block';
  if (token.type === 'dedent') return 'the end of a block';
  if (token.type === 'str') return 'a piece of text';
  if (token.type === 'fstr') return 'an f-string';
  return `'${token.value}'`;
}

export function parse(tokens) {
  let p = 0;

  const peek = (k = 0) => tokens[p + k];
  const lineOf = () => (tokens[p] ? tokens[p].line : null);
  const at = (type, value) => {
    const t = tokens[p];
    return Boolean(t) && t.type === type && (value === undefined || t.value === value);
  };
  const take = () => tokens[p++];
  const accept = (type, value) => (at(type, value) ? tokens[p++] : null);
  const expect = (type, value) => {
    if (!at(type, value)) {
      fail('SyntaxError', `expected ${value ? `'${value}'` : type} but found ${describe(tokens[p])}`, lineOf());
    }
    return tokens[p++];
  };

  /* ---- statements ---- */

  function parseProgram() {
    const body = [];
    while (!at('eof')) {
      if (accept('newline')) continue;
      body.push(parseStatement());
    }
    return { t: 'module', body };
  }

  function parseBlock() {
    expect('op', ':');
    /* A one line body, as in `if x: return 1`. */
    if (!at('newline')) {
      const stmt = parseStatement();
      return [stmt];
    }
    expect('newline');
    if (!at('indent')) fail('IndentationError', 'this block is empty, the next line needs to be indented', lineOf());
    expect('indent');
    const body = [];
    while (!at('dedent') && !at('eof')) {
      if (accept('newline')) continue;
      body.push(parseStatement());
    }
    accept('dedent');
    if (!body.length) fail('IndentationError', 'this block is empty', lineOf());
    return body;
  }

  function parseStatement() {
    const token = peek();
    const line = token ? token.line : null;

    if (token.type === 'keyword' && UNSUPPORTED[token.value]) {
      fail('SyntaxError', UNSUPPORTED[token.value], line);
    }

    if (at('keyword', 'def')) return parseDef();
    if (at('keyword', 'if')) return parseIf();
    if (at('keyword', 'for')) return parseFor();
    if (at('keyword', 'while')) return parseWhile();

    if (accept('keyword', 'pass')) { endLine(); return { t: 'pass', line }; }
    if (accept('keyword', 'break')) { endLine(); return { t: 'break', line }; }
    if (accept('keyword', 'continue')) { endLine(); return { t: 'continue', line }; }

    if (accept('keyword', 'return')) {
      const value = at('newline') || at('eof') || at('dedent') ? null : parseExpression();
      endLine();
      return { t: 'return', value, line };
    }

    /* Everything left is an expression, and it is an assignment if an equals
       sign follows it. */
    const target = parseExpression();

    if (at('op', '=')) {
      const targets = [target];
      while (accept('op', '=')) {
        const next = parseExpression();
        targets.push(next);
      }
      const value = targets.pop();
      for (const item of targets) checkTarget(item, line);
      endLine();
      return { t: 'assign', targets, value, line };
    }

    const aug = ['+=', '-=', '*=', '/=', '//=', '**=', '%='].find(o => at('op', o));
    if (aug) {
      take();
      checkTarget(target, line);
      const value = parseExpression();
      endLine();
      return { t: 'augassign', target, op: aug.slice(0, -1), value, line };
    }

    endLine();
    return { t: 'expr', value: target, line };
  }

  function endLine() {
    if (at('op', ';')) fail('SyntaxError', 'put each statement on its own line', lineOf());
    if (at('newline')) { take(); return; }
    if (at('eof') || at('dedent')) return;
    fail('SyntaxError', `I did not expect ${describe(peek())} here`, lineOf());
  }

  function checkTarget(node, line) {
    if (node.t === 'name' || node.t === 'subscript' || node.t === 'attribute') return;
    if (node.t === 'tuple' || node.t === 'list') {
      node.items.forEach(item => checkTarget(item, line));
      return;
    }
    fail('SyntaxError', 'the left hand side of an = has to be a name', line);
  }

  function parseDef() {
    const line = lineOf();
    expect('keyword', 'def');
    const name = expect('name').value;
    expect('op', '(');
    const params = [];
    while (!at('op', ')')) {
      if (at('op', '*')) fail('SyntaxError', '*args and **kwargs are not supported in this editor', lineOf());
      const pname = expect('name').value;
      let fallback = null;
      if (accept('op', '=')) fallback = parseExpression();
      params.push({ name: pname, fallback });
      if (!accept('op', ',')) break;
    }
    expect('op', ')');
    if (accept('op', '->')) parseExpression();
    const body = parseBlock();
    return { t: 'def', name, params, body, line };
  }

  function parseIf() {
    const line = lineOf();
    expect('keyword', 'if');
    const test = parseExpression();
    const body = parseBlock();
    let orelse = [];
    while (at('newline')) take();
    if (at('keyword', 'elif')) {
      orelse = [parseIfFrom('elif')];
    } else if (at('keyword', 'else')) {
      take();
      orelse = parseBlock();
    }
    return { t: 'if', test, body, orelse, line };
  }

  function parseIfFrom(word) {
    const line = lineOf();
    expect('keyword', word);
    const test = parseExpression();
    const body = parseBlock();
    let orelse = [];
    while (at('newline')) take();
    if (at('keyword', 'elif')) orelse = [parseIfFrom('elif')];
    else if (at('keyword', 'else')) { take(); orelse = parseBlock(); }
    return { t: 'if', test, body, orelse, line };
  }

  function parseFor() {
    const line = lineOf();
    expect('keyword', 'for');
    const target = parseTargetList();
    expect('keyword', 'in');
    const iter = parseExpression();
    const body = parseBlock();
    return { t: 'for', target, iter, body, line };
  }

  function parseTargetList() {
    const first = parsePostfix();
    if (!at('op', ',')) return first;
    const items = [first];
    while (accept('op', ',')) {
      if (at('keyword', 'in')) break;
      items.push(parsePostfix());
    }
    return { t: 'tuple', items, line: first.line };
  }

  function parseWhile() {
    const line = lineOf();
    expect('keyword', 'while');
    const test = parseExpression();
    const body = parseBlock();
    return { t: 'while', test, body, line };
  }

  /* ---- expressions, loosest binding first ---- */

  function parseExpression() { return parseTernary(); }

  function parseTernary() {
    const body = parseOr();
    if (!at('keyword', 'if')) return body;
    const line = lineOf();
    take();
    const test = parseOr();
    expect('keyword', 'else');
    const orelse = parseTernary();
    return { t: 'ternary', test, body, orelse, line };
  }

  function parseOr() {
    let left = parseAnd();
    while (at('keyword', 'or')) {
      const line = lineOf();
      take();
      left = { t: 'or', left, right: parseAnd(), line };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (at('keyword', 'and')) {
      const line = lineOf();
      take();
      left = { t: 'and', left, right: parseNot(), line };
    }
    return left;
  }

  function parseNot() {
    if (at('keyword', 'not')) {
      const line = lineOf();
      take();
      return { t: 'not', value: parseNot(), line };
    }
    return parseComparison();
  }

  /* Python chains comparisons, so 0 < x < 10 means what it looks like. */
  function parseComparison() {
    const first = parseSum();
    const chain = [];
    for (;;) {
      const line = lineOf();
      let op = null;
      if (at('op', '==') || at('op', '!=') || at('op', '<') || at('op', '>') || at('op', '<=') || at('op', '>=')) {
        op = take().value;
      } else if (at('keyword', 'in')) { take(); op = 'in'; }
      else if (at('keyword', 'not') && peek(1) && peek(1).type === 'keyword' && peek(1).value === 'in') {
        take(); take(); op = 'not in';
      } else if (at('keyword', 'is')) {
        take();
        op = accept('keyword', 'not') ? 'is not' : 'is';
      } else break;
      chain.push({ op, right: parseSum(), line });
    }
    if (!chain.length) return first;
    return { t: 'compare', first, chain, line: first.line };
  }

  function parseSum() {
    let left = parseProduct();
    while (at('op', '+') || at('op', '-')) {
      const line = lineOf();
      const op = take().value;
      left = { t: 'binop', op, left, right: parseProduct(), line };
    }
    return left;
  }

  function parseProduct() {
    let left = parseUnary();
    while (at('op', '*') || at('op', '/') || at('op', '//') || at('op', '%')) {
      const line = lineOf();
      const op = take().value;
      left = { t: 'binop', op, left, right: parseUnary(), line };
    }
    return left;
  }

  function parseUnary() {
    if (at('op', '-') || at('op', '+')) {
      const line = lineOf();
      const op = take().value;
      return { t: 'unary', op, value: parseUnary(), line };
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePostfix();
    if (!at('op', '**')) return base;
    const line = lineOf();
    take();
    return { t: 'binop', op: '**', left: base, right: parseUnary(), line };
  }

  function parsePostfix() {
    let node = parseAtom();
    for (;;) {
      const line = lineOf();
      if (accept('op', '.')) {
        const name = expect('name').value;
        node = { t: 'attribute', value: node, name, line };
      } else if (accept('op', '(')) {
        const { args, kwargs } = parseArguments();
        expect('op', ')');
        node = { t: 'call', fn: node, args, kwargs, line };
      } else if (accept('op', '[')) {
        node = { t: 'subscript', value: node, index: parseIndex(), line };
        expect('op', ']');
      } else break;
    }
    return node;
  }

  function parseArguments() {
    const args = [];
    const kwargs = [];
    while (!at('op', ')')) {
      if (at('op', '*')) fail('SyntaxError', '* and ** in a call are not supported in this editor', lineOf());
      if (at('name') && peek(1) && peek(1).type === 'op' && peek(1).value === '=') {
        const name = take().value;
        take();
        kwargs.push({ name, value: parseExpression() });
      } else {
        if (kwargs.length) fail('SyntaxError', 'a plain argument cannot come after a named one', lineOf());
        args.push(parseExpression());
      }
      if (!accept('op', ',')) break;
    }
    return { args, kwargs };
  }

  function parseIndex() {
    const line = lineOf();
    let low = at('op', ':') ? null : parseExpression();
    if (!at('op', ':')) return low;
    take();
    const high = at('op', ']') || at('op', ':') ? null : parseExpression();
    let step = null;
    if (accept('op', ':')) step = at('op', ']') ? null : parseExpression();
    return { t: 'slice', low, high, step, line };
  }

  function parseAtom() {
    const token = peek();
    const line = token ? token.line : null;

    if (token.type === 'num') { take(); return { t: 'num', value: token.value, line }; }
    if (token.type === 'str') { take(); return { t: 'str', value: token.value, line }; }
    if (token.type === 'fstr') {
      take();
      const parts = token.value.map(part => (
        part.kind === 'text'
          ? { kind: 'text', value: part.value }
          : { kind: 'expr', node: parseSource(part.src, part.line) }
      ));
      return { t: 'fstring', parts, line };
    }
    if (token.type === 'name') { take(); return { t: 'name', name: token.value, line }; }

    if (token.type === 'keyword') {
      if (token.value === 'True') { take(); return { t: 'const', value: true, line }; }
      if (token.value === 'False') { take(); return { t: 'const', value: false, line }; }
      if (token.value === 'None') { take(); return { t: 'const', value: null, line }; }
      if (UNSUPPORTED[token.value]) fail('SyntaxError', UNSUPPORTED[token.value], line);
      fail('SyntaxError', `'${token.value}' cannot start a value`, line);
    }

    if (accept('op', '(')) {
      if (accept('op', ')')) return { t: 'tuple', items: [], line };
      const first = parseExpression();
      if (at('op', ',')) {
        const items = [first];
        while (accept('op', ',')) {
          if (at('op', ')')) break;
          items.push(parseExpression());
        }
        expect('op', ')');
        return { t: 'tuple', items, line };
      }
      expect('op', ')');
      return first;
    }

    if (accept('op', '[')) {
      const items = [];
      while (!at('op', ']')) {
        items.push(parseExpression());
        if (!accept('op', ',')) break;
      }
      if (at('keyword', 'for')) {
        fail('SyntaxError', 'list comprehensions are not supported in this editor, write a for loop instead', line);
      }
      expect('op', ']');
      return { t: 'list', items, line };
    }

    if (accept('op', '{')) {
      const pairs = [];
      while (!at('op', '}')) {
        const key = parseExpression();
        if (!at('op', ':')) fail('SyntaxError', 'sets are not supported in this editor, use a list or a dict', line);
        expect('op', ':');
        pairs.push({ key, value: parseExpression() });
        if (!accept('op', ',')) break;
      }
      expect('op', '}');
      return { t: 'dict', pairs, line };
    }

    fail('SyntaxError', `I did not expect ${describe(token)} here`, line);
  }

  const program = parseProgram();
  return program;
}

/* Parses a fragment, which is how the pieces of an f-string get their trees. */
function parseSource(src, line) {
  let tokens;
  try {
    tokens = tokenize(src);
  } catch (err) {
    if (err instanceof PyError) fail(err.kind, err.detail, line);
    throw err;
  }
  const module = parse(tokens);
  if (module.body.length !== 1 || module.body[0].t !== 'expr') {
    fail('SyntaxError', 'the {} in an f-string has to hold a single value', line);
  }
  return module.body[0].value;
}

/* --------------------------------------------------------------- the values */

export class PyFunction {
  constructor(name, params, body, env) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.env = env;
  }
}

/* A function written in JavaScript that the Python side can call. It takes
   the positional list and the named table, so builtins like sorted() can
   accept key= and reverse= the way a learner expects. */
class Native {
  constructor(name, fn) { this.name = name; this.fn = fn; }
}

const native = (name, fn) => new Native(name, fn);

class Signal {
  constructor(kind, value) { this.kind = kind; this.value = value; }
}

class Env {
  constructor(parent) { this.vars = new Map(); this.parent = parent; }
  lookup(name) {
    let scope = this;
    while (scope) {
      if (scope.vars.has(name)) return scope.vars;
      scope = scope.parent;
    }
    return null;
  }
  get(name, line) {
    const found = this.lookup(name);
    if (!found) fail('NameError', `the name '${name}' is not defined`, line);
    return found.get(name);
  }
  set(name, value) { this.vars.set(name, value); }
}

function isHost(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && !(value instanceof Map)
    && !(value instanceof PyFunction)
    && !(value instanceof Native);
}

export function truthy(value) {
  if (value === null || value === false || value === undefined) return false;
  if (value === true) return true;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map) return value.size > 0;
  return true;
}

export function typeName(value) {
  if (value === null || value === undefined) return 'NoneType';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  if (typeof value === 'string') return 'str';
  if (Array.isArray(value)) return 'list';
  if (value instanceof Map) return 'dict';
  if (value instanceof PyFunction || value instanceof Native || typeof value === 'function') return 'function';
  return 'object';
}

export function pyStr(value) {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'nan';
    if (value === Infinity) return 'inf';
    if (value === -Infinity) return '-inf';
    return String(value);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return '[' + value.map(pyRepr).join(', ') + ']';
  if (value instanceof Map) {
    const inner = [];
    for (const [k, v] of value) inner.push(pyRepr(k) + ': ' + pyRepr(v));
    return '{' + inner.join(', ') + '}';
  }
  if (value instanceof PyFunction) return `<function ${value.name}>`;
  if (value instanceof Native) return `<built-in function ${value.name}>`;
  if (typeof value === 'function') return '<built-in function>';
  return '<object>';
}

export function pyRepr(value) {
  if (typeof value === 'string') return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  return pyStr(value);
}

export function pyEq(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => pyEq(item, b[i]));
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) { if (!b.has(k) || !pyEq(v, b.get(k))) return false; }
    return true;
  }
  return false;
}

function compare(op, a, b, line) {
  const bothNumbers = typeof a === 'number' && typeof b === 'number';
  const bothStrings = typeof a === 'string' && typeof b === 'string';
  if (!bothNumbers && !bothStrings) {
    fail('TypeError', `${typeName(a)} and ${typeName(b)} cannot be compared with ${op}`, line);
  }
  if (op === '<') return a < b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;
  return a >= b;
}

function contains(needle, haystack, line) {
  if (typeof haystack === 'string') {
    if (typeof needle !== 'string') fail('TypeError', `only a string can be inside a string, not ${typeName(needle)}`, line);
    return haystack.includes(needle);
  }
  if (Array.isArray(haystack)) return haystack.some(item => pyEq(item, needle));
  if (haystack instanceof Map) return haystack.has(needle);
  if (isHost(haystack)) return Object.prototype.hasOwnProperty.call(haystack, needle);
  fail('TypeError', `${typeName(haystack)} cannot be searched with 'in'`, line);
}

function binary(op, a, b, line) {
  if (op === '+') {
    if (typeof a === 'string' && typeof b === 'string') return a + b;
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    if (typeof a === 'string' || typeof b === 'string') {
      fail('TypeError', `a string and a ${typeName(a) === 'str' ? typeName(b) : typeName(a)} cannot be joined with +, wrap the number in str()`, line);
    }
  }
  if (op === '*') {
    if (typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, Math.floor(b)));
    if (typeof a === 'number' && typeof b === 'string') return b.repeat(Math.max(0, Math.floor(a)));
    if (Array.isArray(a) && typeof b === 'number') {
      const out = [];
      for (let i = 0; i < Math.max(0, Math.floor(b)); i++) out.push(...a);
      return out;
    }
  }

  /* Python treats True and False as 1 and 0 in arithmetic, so sum() over a
     list of comparisons counts the way a learner expects. */
  if (typeof a === 'boolean') a = a ? 1 : 0;
  if (typeof b === 'boolean') b = b ? 1 : 0;

  if (typeof a !== 'number' || typeof b !== 'number') {
    fail('TypeError', `${typeName(a)} and ${typeName(b)} cannot be combined with ${op}`, line);
  }
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '**') return Math.pow(a, b);
  if (b === 0) fail('ZeroDivisionError', 'something was divided by zero', line);
  if (op === '/') return a / b;
  if (op === '//') return Math.floor(a / b);
  if (op === '%') return ((a % b) + b) % b;
  fail('SyntaxError', `I do not know the operator ${op}`, line);
}

/* ------------------------------------------------ sequences and containers */

function iterate(value, line) {
  if (typeof value === 'string') return Array.from(value);
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return Array.from(value.keys());
  if (isHost(value)) return Object.keys(value);
  fail('TypeError', `${typeName(value)} is not something you can loop over`, line);
}

function normalise(i, n) {
  i = Math.trunc(i);
  if (i < 0) i += n;
  return Math.min(Math.max(i, 0), n);
}

function normaliseBack(i, n) {
  i = Math.trunc(i);
  if (i < 0) i += n;
  return Math.min(Math.max(i, -1), n - 1);
}

function sliceOf(seq, low, high, step, line) {
  const n = seq.length;
  const st = step === null || step === undefined ? 1 : Math.trunc(step);
  if (st === 0) fail('ValueError', 'a slice step cannot be zero', line);
  const out = [];
  if (st > 0) {
    const start = low === null || low === undefined ? 0 : normalise(low, n);
    const stop = high === null || high === undefined ? n : normalise(high, n);
    for (let i = start; i < stop; i += st) out.push(seq[i]);
  } else {
    const start = low === null || low === undefined ? n - 1 : normaliseBack(low, n);
    const stop = high === null || high === undefined ? -1 : normaliseBack(high, n);
    for (let i = start; i > stop; i += st) out.push(seq[i]);
  }
  return out;
}

function getItem(target, index, line) {
  const slice = index && typeof index === 'object' && index.__slice;

  if (typeof target === 'string') {
    if (slice) return sliceOf(Array.from(target), index.low, index.high, index.step, line).join('');
    if (typeof index !== 'number') fail('TypeError', `a string is indexed by a number, not ${typeName(index)}`, line);
    const at = Math.trunc(index) < 0 ? target.length + Math.trunc(index) : Math.trunc(index);
    if (at < 0 || at >= target.length) fail('IndexError', 'that position is past the end of the string', line);
    return target[at];
  }

  if (Array.isArray(target)) {
    if (slice) return sliceOf(target, index.low, index.high, index.step, line);
    if (typeof index !== 'number') fail('TypeError', `a list is indexed by a number, not ${typeName(index)}`, line);
    const at = Math.trunc(index) < 0 ? target.length + Math.trunc(index) : Math.trunc(index);
    if (at < 0 || at >= target.length) fail('IndexError', `there is no item ${pyStr(index)} in a list of ${target.length}`, line);
    return target[at];
  }

  if (target instanceof Map) {
    if (slice) fail('TypeError', 'a dict cannot be sliced', line);
    if (!target.has(index)) fail('KeyError', `there is no key ${pyRepr(index)} in this dict`, line);
    return target.get(index);
  }

  if (isHost(target)) {
    if (slice) fail('TypeError', 'that value cannot be sliced', line);
    const key = typeof index === 'number' ? String(index) : index;
    if (!(key in target)) fail('KeyError', `there is no key ${pyRepr(index)} in this value`, line);
    return target[key];
  }

  fail('TypeError', `${typeName(target)} cannot be indexed with []`, line);
}

function setItem(target, index, value, line) {
  if (Array.isArray(target)) {
    if (typeof index !== 'number') fail('TypeError', `a list is indexed by a number, not ${typeName(index)}`, line);
    const at = Math.trunc(index) < 0 ? target.length + Math.trunc(index) : Math.trunc(index);
    if (at < 0 || at >= target.length) fail('IndexError', 'that position is past the end of the list', line);
    target[at] = value;
    return;
  }
  if (target instanceof Map) { target.set(index, value); return; }
  if (isHost(target)) { target[index] = value; return; }
  fail('TypeError', `${typeName(target)} cannot have items assigned to it`, line);
}

/* ------------------------------------------------------------------ methods */

function needString(value, method, line) {
  if (typeof value !== 'string') fail('TypeError', `${method}() needs a string, not ${typeName(value)}`, line);
  return value;
}

function trimSides(text, chars, left, right) {
  let start = 0;
  let end = text.length;
  const cut = chars === undefined || chars === null ? null : new Set(Array.from(chars));
  const drop = c => (cut ? cut.has(c) : /\s/.test(c));
  if (left) while (start < end && drop(text[start])) start++;
  if (right) while (end > start && drop(text[end - 1])) end--;
  return text.slice(start, end);
}

const STRING_METHODS = {
  lower: s => s.toLowerCase(),
  upper: s => s.toUpperCase(),
  title: s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  capitalize: s => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s),
  strip: (s, a) => trimSides(s, a[0], true, true),
  lstrip: (s, a) => trimSides(s, a[0], true, false),
  rstrip: (s, a) => trimSides(s, a[0], false, true),
  split: (s, a, k, i, line) => {
    const sep = a[0];
    if (sep === undefined || sep === null) return s.split(/\s+/).filter(Boolean);
    if (sep === '') fail('ValueError', 'split() needs something to split on', line);
    return s.split(needString(sep, 'split', line));
  },
  join: (s, a, k, i, line) => {
    const items = iterate(a[0], line);
    return items.map(item => {
      if (typeof item !== 'string') {
        fail('TypeError', `join() only joins strings, and it was given a ${typeName(item)}. Try str() on it first.`, line);
      }
      return item;
    }).join(s);
  },
  replace: (s, a, k, i, line) => s.split(needString(a[0], 'replace', line)).join(needString(a[1], 'replace', line)),
  startswith: (s, a, k, i, line) => s.startsWith(needString(a[0], 'startswith', line)),
  endswith: (s, a, k, i, line) => s.endsWith(needString(a[0], 'endswith', line)),
  find: (s, a, k, i, line) => s.indexOf(needString(a[0], 'find', line)),
  index: (s, a, k, i, line) => {
    const at = s.indexOf(needString(a[0], 'index', line));
    if (at === -1) fail('ValueError', 'that piece of text is not in this string', line);
    return at;
  },
  count: (s, a, k, i, line) => {
    const needle = needString(a[0], 'count', line);
    if (!needle) return s.length + 1;
    return s.split(needle).length - 1;
  },
  isalpha: s => s.length > 0 && /^[A-Za-z]+$/.test(s),
  isdigit: s => s.length > 0 && /^[0-9]+$/.test(s),
  isalnum: s => s.length > 0 && /^[A-Za-z0-9]+$/.test(s),
  isspace: s => s.length > 0 && /^\s+$/.test(s),
  islower: s => /[a-z]/.test(s) && s === s.toLowerCase(),
  isupper: s => /[A-Z]/.test(s) && s === s.toUpperCase()
};

const LIST_METHODS = {
  append: (l, a, k, i, line) => { if (!a.length) fail('TypeError', 'append() needs one value', line); l.push(a[0]); return null; },
  extend: (l, a, k, i, line) => { l.push(...iterate(a[0], line)); return null; },
  insert: (l, a) => { l.splice(Math.trunc(a[0]), 0, a[1]); return null; },
  pop: (l, a, k, i, line) => {
    if (!l.length) fail('IndexError', 'pop() was called on an empty list', line);
    const at = a.length ? (Math.trunc(a[0]) < 0 ? l.length + Math.trunc(a[0]) : Math.trunc(a[0])) : l.length - 1;
    if (at < 0 || at >= l.length) fail('IndexError', 'that position is past the end of the list', line);
    return l.splice(at, 1)[0];
  },
  remove: (l, a, k, i, line) => {
    const at = l.findIndex(item => pyEq(item, a[0]));
    if (at === -1) fail('ValueError', 'that value is not in the list', line);
    l.splice(at, 1);
    return null;
  },
  index: (l, a, k, i, line) => {
    const at = l.findIndex(item => pyEq(item, a[0]));
    if (at === -1) fail('ValueError', 'that value is not in the list', line);
    return at;
  },
  count: (l, a) => l.filter(item => pyEq(item, a[0])).length,
  reverse: l => { l.reverse(); return null; },
  clear: l => { l.length = 0; return null; },
  copy: l => l.slice(),
  sort: (l, a, k, interp, line) => {
    const sorted = sortValues(l.slice(), k, interp, line);
    l.length = 0;
    l.push(...sorted);
    return null;
  }
};

const DICT_METHODS = {
  get: (d, a) => (d.has(a[0]) ? d.get(a[0]) : (a.length > 1 ? a[1] : null)),
  keys: d => Array.from(d.keys()),
  values: d => Array.from(d.values()),
  items: d => Array.from(d.entries()).map(([k, v]) => [k, v]),
  pop: (d, a, k, i, line) => {
    if (!d.has(a[0])) {
      if (a.length > 1) return a[1];
      fail('KeyError', `there is no key ${pyRepr(a[0])} in this dict`, line);
    }
    const value = d.get(a[0]);
    d.delete(a[0]);
    return value;
  },
  setdefault: (d, a) => {
    if (!d.has(a[0])) d.set(a[0], a.length > 1 ? a[1] : null);
    return d.get(a[0]);
  },
  update: (d, a, k, i, line) => {
    const other = a[0];
    if (other instanceof Map) for (const [key, value] of other) d.set(key, value);
    else fail('TypeError', 'update() needs another dict', line);
    return null;
  },
  clear: d => { d.clear(); return null; },
  copy: d => new Map(d)
};

function sortValues(items, kwargs, interp, line) {
  const key = kwargs && kwargs.key ? kwargs.key : null;
  const reverse = kwargs && kwargs.reverse ? truthy(kwargs.reverse) : false;
  const keyed = items.map(item => ({ item, sortOn: key ? interp.call(key, [item], line) : item }));
  keyed.sort((a, b) => {
    if (pyEq(a.sortOn, b.sortOn)) return 0;
    return compare('<', a.sortOn, b.sortOn, line) ? -1 : 1;
  });
  if (reverse) keyed.reverse();
  return keyed.map(entry => entry.item);
}

function methodFor(target, name, line) {
  let table = null;
  if (typeof target === 'string') table = STRING_METHODS;
  else if (Array.isArray(target)) table = LIST_METHODS;
  else if (target instanceof Map) table = DICT_METHODS;
  if (!table) return undefined;
  const impl = table[name];
  if (!impl) {
    const near = Object.keys(table).filter(k => k.startsWith(name.slice(0, 2)));
    const hint = near.length ? `. Did you mean ${near.slice(0, 3).map(k => k + '()').join(' or ')}?` : '';
    fail('AttributeError', `${typeName(target)} has no method called '${name}'${hint}`, line);
  }
  return native(name, (args, kwargs, interp, atLine) => impl(target, args, kwargs, interp, atLine || line));
}

/* ----------------------------------------------------------------- builtins */

function toNumber(value, what, line) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  fail('TypeError', `${what}() needs a number, not ${typeName(value)}`, line);
}

function makeBuiltins() {
  const table = new Map();
  const def = (name, fn) => table.set(name, native(name, fn));

  def('print', (args, kwargs, interp) => {
    const sep = kwargs.sep !== undefined ? kwargs.sep : ' ';
    interp.output.push(args.map(pyStr).join(sep));
    if (interp.output.length > 400) interp.output.splice(0, interp.output.length - 400);
    return null;
  });

  def('len', (args, kwargs, interp, line) => {
    const value = args[0];
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length;
    if (value instanceof Map) return value.size;
    if (isHost(value)) return Object.keys(value).length;
    fail('TypeError', `len() does not work on ${typeName(value)}`, line);
  });

  def('str', args => (args.length ? pyStr(args[0]) : ''));
  def('repr', args => pyRepr(args[0]));

  def('int', (args, kwargs, interp, line) => {
    const value = args[0];
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return Math.trunc(value);
    if (typeof value === 'string') {
      const text = value.trim();
      if (!/^[+-]?\d+$/.test(text)) fail('ValueError', `int() cannot read ${pyRepr(value)} as a whole number`, line);
      return parseInt(text, 10);
    }
    fail('TypeError', `int() does not work on ${typeName(value)}`, line);
  });

  def('float', (args, kwargs, interp, line) => {
    const value = args[0];
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value.trim());
      if (value.trim() === '' || Number.isNaN(n)) fail('ValueError', `float() cannot read ${pyRepr(value)} as a number`, line);
      return n;
    }
    fail('TypeError', `float() does not work on ${typeName(value)}`, line);
  });

  def('bool', args => truthy(args[0]));
  def('abs', (args, kwargs, interp, line) => Math.abs(toNumber(args[0], 'abs', line)));

  def('round', (args, kwargs, interp, line) => {
    const value = toNumber(args[0], 'round', line);
    const places = args.length > 1 ? Math.trunc(toNumber(args[1], 'round', line)) : 0;
    const scale = Math.pow(10, places);
    /* Nudged before rounding so that 2.675 at two places behaves the way a
       person reading the number expects it to. */
    const rounded = Math.round((value * scale + (value >= 0 ? 1e-9 : -1e-9))) / scale;
    return places <= 0 ? Math.round(value * scale) / scale : rounded;
  });

  def('list', (args, kwargs, interp, line) => (args.length ? iterate(args[0], line).slice() : []));

  def('dict', (args, kwargs, interp, line) => {
    if (!args.length) return new Map();
    if (args[0] instanceof Map) return new Map(args[0]);
    const out = new Map();
    for (const pair of iterate(args[0], line)) {
      if (!Array.isArray(pair) || pair.length !== 2) fail('TypeError', 'dict() needs pairs of two values', line);
      out.set(pair[0], pair[1]);
    }
    return out;
  });

  def('range', (args, kwargs, interp, line) => {
    const nums = args.map(a => Math.trunc(toNumber(a, 'range', line)));
    let start = 0;
    let stop = 0;
    let step = 1;
    if (nums.length === 1) [stop] = nums;
    else if (nums.length === 2) [start, stop] = nums;
    else if (nums.length >= 3) [start, stop, step] = nums;
    else fail('TypeError', 'range() needs at least one number', line);
    if (step === 0) fail('ValueError', 'range() cannot step by zero', line);
    const size = Math.max(0, Math.ceil((stop - start) / step));
    if (size > 200000) fail('RuntimeError', 'that range is too large for this editor', line);
    const out = [];
    for (let i = 0; i < size; i++) out.push(start + i * step);
    return out;
  });

  def('enumerate', (args, kwargs, interp, line) => {
    const start = args.length > 1 ? Math.trunc(toNumber(args[1], 'enumerate', line)) : 0;
    return iterate(args[0], line).map((item, i) => [i + start, item]);
  });

  def('zip', (args, kwargs, interp, line) => {
    const lists = args.map(a => iterate(a, line));
    const size = lists.length ? Math.min(...lists.map(l => l.length)) : 0;
    const out = [];
    for (let i = 0; i < size; i++) out.push(lists.map(l => l[i]));
    return out;
  });

  def('sum', (args, kwargs, interp, line) => {
    let total = args.length > 1 ? toNumber(args[1], 'sum', line) : 0;
    for (const item of iterate(args[0], line)) total += toNumber(item, 'sum', line);
    return total;
  });

  def('min', (args, kwargs, interp, line) => pick(args, kwargs, interp, line, '<', 'min'));
  def('max', (args, kwargs, interp, line) => pick(args, kwargs, interp, line, '>', 'max'));

  def('sorted', (args, kwargs, interp, line) => sortValues(iterate(args[0], line).slice(), kwargs, interp, line));
  def('reversed', (args, kwargs, interp, line) => iterate(args[0], line).slice().reverse());

  def('any', (args, kwargs, interp, line) => iterate(args[0], line).some(truthy));
  def('all', (args, kwargs, interp, line) => iterate(args[0], line).every(truthy));

  def('ord', (args, kwargs, interp, line) => {
    if (typeof args[0] !== 'string' || args[0].length !== 1) fail('TypeError', 'ord() needs a single character', line);
    return args[0].charCodeAt(0);
  });
  def('chr', (args, kwargs, interp, line) => String.fromCharCode(Math.trunc(toNumber(args[0], 'chr', line))));

  return table;
}

function pick(args, kwargs, interp, line, op, name) {
  const items = args.length === 1 ? iterate(args[0], line) : args;
  if (!items.length) fail('ValueError', `${name}() was given nothing to choose from`, line);
  const key = kwargs && kwargs.key ? kwargs.key : null;
  let best = items[0];
  let bestOn = key ? interp.call(key, [best], line) : best;
  for (const item of items.slice(1)) {
    const on = key ? interp.call(key, [item], line) : item;
    if (compare(op, on, bestOn, line)) { best = item; bestOn = on; }
  }
  return best;
}

/* -------------------------------------------------------------- the runtime */

const STEP_LIMIT = 2000000;

export class Interpreter {
  constructor({ globals = {}, steps = STEP_LIMIT } = {}) {
    this.builtins = makeBuiltins();
    this.globals = new Env(null);
    this.limit = steps;
    this.steps = 0;
    this.output = [];
    for (const [name, value] of Object.entries(globals)) this.globals.set(name, value);
  }

  tick(line) {
    if (++this.steps > this.limit) {
      fail('RuntimeError', 'this code ran for too long and was stopped, so check for a loop that never ends', line);
    }
  }

  /* Runs a whole program. Definitions land in the global scope, which is how
     the caller gets at the function the exercise asked for. */
  run(source) {
    this.steps = 0;
    const tree = parse(tokenize(source));
    this.execBlock(tree.body, this.globals);
    return this;
  }

  get(name) {
    const found = this.globals.lookup(name);
    return found ? found.get(name) : undefined;
  }

  /* Calls a Python value from JavaScript. This is the door the exercises
     use to run a player's function against a test. */
  call(fn, args = [], line = null) {
    return this.callValue(fn, args, {}, line);
  }

  execBlock(body, env) {
    for (const stmt of body) this.execStatement(stmt, env);
  }

  execStatement(node, env) {
    this.tick(node.line);

    switch (node.t) {
      case 'expr':
        this.evaluate(node.value, env);
        return;

      case 'assign': {
        const value = this.evaluate(node.value, env);
        for (const target of node.targets) this.assign(target, value, env);
        return;
      }

      case 'augassign': {
        const current = this.evaluate(node.target, env);
        const value = binary(node.op, current, this.evaluate(node.value, env), node.line);
        this.assign(node.target, value, env);
        return;
      }

      case 'if':
        if (truthy(this.evaluate(node.test, env))) this.execBlock(node.body, env);
        else this.execBlock(node.orelse, env);
        return;

      case 'while': {
        while (truthy(this.evaluate(node.test, env))) {
          this.tick(node.line);
          try {
            this.execBlock(node.body, env);
          } catch (signal) {
            if (signal instanceof Signal && signal.kind === 'break') return;
            if (signal instanceof Signal && signal.kind === 'continue') continue;
            throw signal;
          }
        }
        return;
      }

      case 'for': {
        const items = iterate(this.evaluate(node.iter, env), node.line);
        /* A copy, so that a list being appended to inside its own loop does
           not run forever the way it would in a naive walk. */
        for (const item of items.slice()) {
          this.tick(node.line);
          this.assign(node.target, item, env);
          try {
            this.execBlock(node.body, env);
          } catch (signal) {
            if (signal instanceof Signal && signal.kind === 'break') return;
            if (signal instanceof Signal && signal.kind === 'continue') continue;
            throw signal;
          }
        }
        return;
      }

      case 'def':
        env.set(node.name, new PyFunction(node.name, node.params, node.body, env));
        return;

      case 'return':
        throw new Signal('return', node.value ? this.evaluate(node.value, env) : null);

      case 'break':
        throw new Signal('break');

      case 'continue':
        throw new Signal('continue');

      case 'pass':
        return;

      default:
        fail('SyntaxError', `I do not know how to run a ${node.t}`, node.line);
    }
  }

  assign(target, value, env) {
    if (target.t === 'name') { env.set(target.name, value); return; }

    if (target.t === 'subscript') {
      const holder = this.evaluate(target.value, env);
      setItem(holder, this.evaluate(target.index, env), value, target.line);
      return;
    }

    if (target.t === 'attribute') {
      const holder = this.evaluate(target.value, env);
      if (!isHost(holder)) fail('AttributeError', `a ${typeName(holder)} cannot have attributes set on it`, target.line);
      holder[target.name] = value;
      return;
    }

    if (target.t === 'tuple' || target.t === 'list') {
      const items = iterate(value, target.line);
      if (items.length !== target.items.length) {
        fail('ValueError', `expected ${target.items.length} values to unpack but found ${items.length}`, target.line);
      }
      target.items.forEach((item, i) => this.assign(item, items[i], env));
      return;
    }

    fail('SyntaxError', 'that is not something you can assign to', target.line);
  }

  evaluate(node, env) {
    this.tick(node.line);

    switch (node.t) {
      case 'num':
      case 'str':
        return node.value;

      case 'const':
        return node.value;

      case 'name': {
        const scope = env.lookup(node.name);
        if (scope) return scope.get(node.name);
        if (this.builtins.has(node.name)) return this.builtins.get(node.name);
        fail('NameError', `the name '${node.name}' is not defined`, node.line);
        return null;
      }

      case 'fstring':
        return node.parts.map(part => (
          part.kind === 'text' ? part.value : pyStr(this.evaluate(part.node, env))
        )).join('');

      case 'list':
        return node.items.map(item => this.evaluate(item, env));

      case 'tuple':
        return node.items.map(item => this.evaluate(item, env));

      case 'dict': {
        const out = new Map();
        for (const pair of node.pairs) out.set(this.evaluate(pair.key, env), this.evaluate(pair.value, env));
        return out;
      }

      case 'slice':
        return {
          __slice: true,
          low: node.low === null ? null : this.evaluate(node.low, env),
          high: node.high === null ? null : this.evaluate(node.high, env),
          step: node.step === null || node.step === undefined ? null : this.evaluate(node.step, env)
        };

      case 'binop':
        return binary(node.op, this.evaluate(node.left, env), this.evaluate(node.right, env), node.line);

      case 'unary': {
        const value = this.evaluate(node.value, env);
        if (typeof value !== 'number') fail('TypeError', `${node.op} does not work on ${typeName(value)}`, node.line);
        return node.op === '-' ? -value : value;
      }

      case 'not':
        return !truthy(this.evaluate(node.value, env));

      case 'and': {
        const left = this.evaluate(node.left, env);
        return truthy(left) ? this.evaluate(node.right, env) : left;
      }

      case 'or': {
        const left = this.evaluate(node.left, env);
        return truthy(left) ? left : this.evaluate(node.right, env);
      }

      case 'ternary':
        return truthy(this.evaluate(node.test, env))
          ? this.evaluate(node.body, env)
          : this.evaluate(node.orelse, env);

      case 'compare': {
        let left = this.evaluate(node.first, env);
        for (const link of node.chain) {
          const right = this.evaluate(link.right, env);
          let outcome;
          if (link.op === '==') outcome = pyEq(left, right);
          else if (link.op === '!=') outcome = !pyEq(left, right);
          else if (link.op === 'in') outcome = contains(left, right, link.line);
          else if (link.op === 'not in') outcome = !contains(left, right, link.line);
          else if (link.op === 'is') outcome = left === right || (left === null && right === null);
          else if (link.op === 'is not') outcome = !(left === right || (left === null && right === null));
          else outcome = compare(link.op, left, right, link.line);
          if (!outcome) return false;
          left = right;
        }
        return true;
      }

      case 'subscript':
        return getItem(this.evaluate(node.value, env), this.evaluate(node.index, env), node.line);

      case 'attribute': {
        const target = this.evaluate(node.value, env);
        const method = methodFor(target, node.name, node.line);
        if (method) return method;
        if (isHost(target)) {
          const found = target[node.name];
          if (found === undefined) fail('AttributeError', `this value has nothing called '${node.name}'`, node.line);
          return typeof found === 'function' ? found.bind(target) : found;
        }
        fail('AttributeError', `${typeName(target)} has nothing called '${node.name}'`, node.line);
        return null;
      }

      case 'call': {
        const fn = this.evaluate(node.fn, env);
        const args = node.args.map(a => this.evaluate(a, env));
        const kwargs = {};
        for (const pair of node.kwargs) kwargs[pair.name] = this.evaluate(pair.value, env);
        return this.callValue(fn, args, kwargs, node.line, describeCallee(node.fn));
      }

      default:
        fail('SyntaxError', `I do not know how to read a ${node.t}`, node.line);
        return null;
    }
  }

  callValue(fn, args, kwargs, line, label) {
    this.tick(line);
    const named = label ? `${label}()` : 'this value';

    if (fn instanceof PyFunction) {
      const scope = new Env(fn.env);
      const taken = new Set();

      fn.params.forEach((param, i) => {
        if (i < args.length) { scope.set(param.name, args[i]); taken.add(param.name); }
      });

      for (const [key, value] of Object.entries(kwargs || {})) {
        if (!fn.params.some(p => p.name === key)) {
          fail('TypeError', `${fn.name}() has no argument called '${key}'`, line);
        }
        if (taken.has(key)) fail('TypeError', `${fn.name}() was given '${key}' twice`, line);
        scope.set(key, value);
        taken.add(key);
      }

      for (const param of fn.params) {
        if (taken.has(param.name)) continue;
        if (param.fallback) { scope.set(param.name, this.evaluate(param.fallback, fn.env)); continue; }
        fail('TypeError', `${fn.name}() is missing the argument '${param.name}'`, line);
      }

      if (args.length > fn.params.length) {
        fail('TypeError', `${fn.name}() takes ${fn.params.length} argument${fn.params.length === 1 ? '' : 's'} but was given ${args.length}`, line);
      }

      try {
        this.execBlock(fn.body, scope);
      } catch (signal) {
        if (signal instanceof Signal && signal.kind === 'return') return signal.value;
        if (signal instanceof Signal) fail('SyntaxError', `'${signal.kind}' was used outside a loop`, line);
        throw signal;
      }
      return null;
    }

    if (fn instanceof Native) return fn.fn(args, kwargs || {}, this, line);

    /* A plain JavaScript function handed in by the app. */
    if (typeof fn === 'function') {
      if (kwargs && Object.keys(kwargs).length) {
        fail('TypeError', `${named} does not take named arguments`, line);
      }
      return normaliseHostResult(fn(...args));
    }

    fail('TypeError', `${named} is a ${typeName(fn)}, and a ${typeName(fn)} cannot be called`, line);
    return null;
  }
}

function describeCallee(node) {
  if (!node) return null;
  if (node.t === 'name') return node.name;
  if (node.t === 'attribute') return node.name;
  return null;
}

function normaliseHostResult(value) {
  return value === undefined ? null : value;
}

/* ------------------------------------------------------------------ bridges */

/* Turns app data into Python data, so a dict really is a dict and a player
   can write reading["tempC"] and have it mean what the tutorial says. */
export function toPython(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(toPython);
  if (value instanceof Map) return value;
  if (typeof value === 'object') {
    const out = new Map();
    for (const [key, item] of Object.entries(value)) out.set(key, toPython(item));
    return out;
  }
  return value;
}

export function toJS(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(toJS);
  if (value instanceof Map) {
    const out = {};
    for (const [key, item] of value) out[key] = toJS(item);
    return out;
  }
  return value;
}

/* The one call the rest of the app makes. It never throws: a failure comes
   back as a plain object with a sentence in it. */
export function runPython(source, { globals = {}, steps = STEP_LIMIT } = {}) {
  const interpreter = new Interpreter({ globals, steps });
  try {
    interpreter.run(source);
    return { ok: true, interpreter, output: interpreter.output };
  } catch (err) {
    if (err instanceof PyError) {
      return { ok: false, interpreter, output: interpreter.output, error: err.message, kind: err.kind, line: err.line };
    }
    if (err instanceof Signal) {
      return { ok: false, interpreter, output: interpreter.output, error: `SyntaxError: '${err.kind}' was used outside a function`, kind: 'SyntaxError', line: null };
    }
    if (err instanceof RangeError) {
      return { ok: false, interpreter, output: interpreter.output, error: 'RuntimeError: this code called itself too many times', kind: 'RuntimeError', line: null };
    }
    throw err;
  }
}
