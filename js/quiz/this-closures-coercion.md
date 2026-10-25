# Quiz · `this`, closures, hoisting and coercion

These come up as warm-up questions, and as hidden causes of real bugs: lost `this` in event handlers, stale closures in React hooks, and `==` surprises in validation code.

For each snippet, write down the **exact output** (every line, in order) before you open the answer. Every answer was checked by running the code in Node.js 22. Browsers give the same results.

## 1. Method extraction loses `this`

```js
'use strict';
const user = {
  name: 'Ali',
  hello() {
    return this?.name;
  },
};
const hello = user.hello;
console.log(user.hello());
console.log(hello());
console.log(hello.call({ name: 'Sara' }));
```

<details>
<summary>Answer</summary>

```text
Ali
undefined
Sara
```

`user.hello()` is called *on* `user`, so `this` is `user`. `const hello = user.hello` copies only the function: a plain call has `this === undefined` in strict mode (modules and classes are always strict), so `this?.name` is `undefined`. `call` sets `this` explicitly. This is why you see `onClick={this.handleClick}` bugs in class components.

</details>

## 2. Regular function vs arrow function callbacks

```js
const counter = {
  count: 0,
  incLater() {
    setTimeout(function () {
      console.log('function:', this === counter);
    }, 0);
    setTimeout(() => {
      console.log('arrow:', this === counter);
    }, 0);
  },
};
counter.incLater();
```

<details>
<summary>Answer</summary>

```text
function: false
arrow: true
```

A regular `function` gets its `this` from **how it is called**. `setTimeout` calls it with no object, so it's not `counter`. An arrow function has no own `this`: it uses the `this` of the surrounding `incLater` call, which is `counter`.

</details>

## 3. Class fields: arrow property vs prototype method

```js
class Button {
  label = 'Save';
  handleArrow = () => this.label;
  handleMethod() {
    return this?.label;
  }
}
const b = new Button();
const { handleArrow, handleMethod } = b;
console.log(handleArrow());
console.log(handleMethod());
console.log(Object.keys(b));
```

<details>
<summary>Answer</summary>

```text
Save
undefined
[ 'label', 'handleArrow' ]
```

`handleArrow = () => this.label` is a **class field**: it's created per instance in the constructor, and the arrow captures that instance, so destructuring is safe. `handleMethod` lives on the prototype, so after destructuring, `this` is `undefined` (class bodies are strict). `Object.keys` shows only the own fields: methods are not own properties. Trade-off: one function per instance (memory) vs needing `.bind`.

</details>

## 4. `bind` is permanent, except for `new`

```js
'use strict';
function show() {
  return this;
}
const bound = show.bind({ id: 1 });
console.log(bound().id);
console.log(bound.call({ id: 2 }).id);

function Person() {
  this.id = 3;
}
const BoundPerson = Person.bind({ id: 4 });
console.log(new BoundPerson().id);
```

<details>
<summary>Answer</summary>

```text
1
1
3
```

`bind` fixes `this` forever: a later `call({ id: 2 })` can't change it, so both print `1`. But `new` beats `bind`: `new BoundPerson()` creates a new object as `this`, so `id` is `3` and the bound `{ id: 4 }` is ignored.

</details>

## 5. Closures in loops

```js
const fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
console.log(fns.map((f) => f()));
const fns2 = [];
for (let i = 0; i < 3; i++) fns2.push(() => i);
console.log(fns2.map((f) => f()));
```

<details>
<summary>Answer</summary>

```text
[ 3, 3, 3 ]
[ 0, 1, 2 ]
```

All `var` closures share the same `i`, which is `3` after the loop. `let` makes a fresh `i` for each iteration, so each closure remembers its own value.

</details>

## 6. Each call creates its own closure (and getters are evaluated once when destructured)

```js
function makeCounter() {
  let count = 0;
  return {
    inc: () => ++count,
    get value() {
      return count;
    },
  };
}
const a = makeCounter();
const b = makeCounter();
a.inc();
a.inc();
b.inc();
const { value } = a;
a.inc();
console.log(a.value, b.value, value);
```

<details>
<summary>Answer</summary>

```text
3 1 2
```

`a` and `b` have separate `count` variables. `a.inc()` twice → `a` is 2, `b.inc()` → `b` is 1. `const { value } = a` **reads the getter once** (2) and copies the number; it doesn't stay live. Then `a.inc()` makes `a.value` 3. So: `3 1 2`. Same idea as a stale closure in React: you captured a value, not a reference.

</details>

## 7. Hoisting and the temporal dead zone (TDZ)

```js
console.log(typeof hoisted, typeof notHoisted);
function hoisted() {}
var notHoisted = function () {};
try {
  console.log(x);
  let x = 1;
} catch (e) {
  console.log(e.constructor.name);
}
console.log(typeof undeclaredVariable);
```

<details>
<summary>Answer</summary>

```text
function undefined
ReferenceError
undefined
```

Function **declarations** are fully hoisted (`function`). With `var notHoisted = function…`, only the variable is hoisted, as `undefined`. `let`/`const` are hoisted too, but they're in the TDZ until their line runs, so reading `x` throws a `ReferenceError`. `typeof` on a variable that was **never declared** returns `'undefined'` without throwing. (But `typeof` on a TDZ variable *does* throw.)

</details>

## 8. Loose equality `==` traps

```js
console.log([] == false);
console.log(null == 0, null >= 0);
console.log(undefined == null, undefined === null);
console.log(NaN == NaN, Object.is(NaN, NaN));
console.log('5' * '2', '5' + 2, '5' - 2);
```

<details>
<summary>Answer</summary>

```text
true
false true
true false
false true
10 52 3
```

`[] == false`: both become numbers. `[]` → `''` → `0`, and `false` → `0`, so `true`. `null == 0` is `false` (null is only `==` to undefined), but `null >= 0` converts null to `0`, so `true`. `NaN` is never equal to itself, and `Object.is` fixes that. `*` and `-` convert strings to numbers; `+` with a string concatenates.

</details>

## 9. `typeof` surprises and floating point

```js
console.log(typeof null, typeof [], typeof function () {}, typeof NaN);
console.log(Array.isArray([]), [] instanceof Object);
console.log(0.1 + 0.2 === 0.3, Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);
```

<details>
<summary>Answer</summary>

```text
object object function number
true true
false true
```

`typeof null === 'object'` is a 1995 bug kept for compatibility. Arrays are objects, so use `Array.isArray`. `NaN` is a number. `0.1 + 0.2` is `0.30000000000000004` (IEEE-754), so compare with a tolerance, or use integers (cents) for money.

</details>

## 10. Object keys are strings (use a `Map` for object keys)

```js
const a = {};
const k1 = { id: 1 };
const k2 = { id: 2 };
a[k1] = 'first';
a[k2] = 'second';
console.log(a[k1], Object.keys(a));
const m = new Map([[k1, 'first'], [k2, 'second']]);
console.log(m.get(k1), m.size);
const obj = { 1: 'a', b: 'b', 0: 'c' };
console.log(Object.keys(obj));
```

<details>
<summary>Answer</summary>

```text
second [ '[object Object]' ]
first 2
[ '0', '1', 'b' ]
```

Plain-object keys are converted to strings: both objects become `'[object Object]'`, so the second write overwrites the first. A `Map` uses the object **identity** as the key. Key order: integer-like keys come first in ascending order, then string keys in insertion order. That's why `'0', '1', 'b'`.

</details>

## 11. Callbacks inside methods lose `this`

```js
'use strict';
const settings = {
  theme: 'dark',
  load() {
    return [1, 2].map(function () {
      return this?.theme;
    });
  },
  loadFixed() {
    return [1, 2].map(function () {
      return this.theme;
    }, this);
  },
};
console.log(settings.load(), settings.loadFixed());
```

<details>
<summary>Answer</summary>

```text
[ undefined, undefined ] [ 'dark', 'dark' ]
```

The callback passed to `map` is a regular function called without an object, so `this` is `undefined` (strict mode) → `[undefined, undefined]`. Fixes: an arrow function (best), `.bind(this)`, or the second argument of `map` (`thisArg`), which `loadFixed` uses.

</details>

## 12. Captured value vs live variable

```js
let count = 0;
function useCountLogger() {
  const snapshot = count;
  return () => console.log('snapshot', snapshot, 'live', count);
}
const log = useCountLogger();
count = 5;
log();
```

<details>
<summary>Answer</summary>

```text
snapshot 0 live 5
```

`snapshot` was copied when `useCountLogger` ran (0). `count` is read when `log` runs (5). This is exactly the stale closure bug in React: a `useEffect` or `useCallback` with missing dependencies keeps reading the `snapshot` from an old render.

</details>
