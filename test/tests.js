import * as Kefir from "kefir"
import * as R     from "ramda"
import Atom       from "kefir.atom"
import React      from "karet"
import ReactDOM   from "react-dom/server"

import K, * as U from "../src/karet.util"

function show(x) {
  switch (typeof x) {
    case "string":
    case "object":
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

const testEq = (expr, expect) => it(`${expr} => ${show(expect)}`, done => {
  const actual =
    eval(`(Atom, K, Kefir, R, U, C) => ${expr}`)(Atom, K, Kefir, R, U, Kefir.constant)
  const check = actual => {
    if (!R.equals(actual, expect))
      throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
    done()
  }
  if (actual instanceof Kefir.Observable)
    actual.take(1).onValue(check)
  else
    check(actual)
})

const testRender = (vdom, expect) => it(`${expect}`, () => {
  const actual = ReactDOM.renderToStaticMarkup(vdom)

  if (actual !== expect)
    throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
})

describe("actions", () => {
  testEq('{let i = "" ; U.actions(false, C(x => i += "1" + x), undefined, x => i += "2" + x).onValue(f => f("z")); return i}', "1z2z")
})

describe("bind", () => {
  testEq('{const a = Atom(1);' +
         ' const e = {a: 2};' +
         ' const x = U.bind({a});' +
         ' x.onChange({target: e});' +
         ' return a}',
         2)
})

describe("bindProps", () => {
  testEq('{const a = Atom(1);' +
         ' const e = {a: 2};' +
         ' const x = U.bindProps({ref: "onChange", a});' +
         ' x.ref(e);' +
         ' a.set(3);' +
         ' return e.a}',
         3)

  testEq('{const a = Atom(1);' +
         ' const e = {a: 2};' +
         ' const x = U.bindProps({ref: "onChange", a});' +
         ' x.ref(e);' +
         ' e.a = 3;' +
         ' x.onChange({target: e});' +
         ' return a}',
         3)
})

describe("classes", () => {
  testEq('U.classes()', {className: ""})

  testEq('U.classes("a")', {className: "a"})

  testEq('U.classes("a", undefined, 0, false, "", "b")',
         {className: "a b"})

  testEq('K(U.classes("a", C("b")), R.identity)',
         {className: "a b"})
})

describe("mapCached", () => {
  testEq('U.seq(Kefir.concat([C([2, 1, 1]), C([1, 3, 2])]), U.mapCached(i => `item ${i}`))', ["item 1", "item 3", "item 2"])
})

describe("sink", () => {
  testEq('U.sink(C("lol"))', undefined)
})

describe("string", () => {
  testEq('U.string`Hello!`', "Hello!")
  testEq('U.string`Hello, ${"constant"}!`', "Hello, constant!")
  testEq('U.string`Hello, ${C("World")}!`', "Hello, World!")
  testEq('U.string`Hello, ${"constant"} ${C("property")}!`', "Hello, constant property!")
})

describe("Context", () => {
  const Who = U.withContext((_, {who}) => <div>Hello, {who}!</div>)

  testRender(<U.Context context={{who: Kefir.constant("World")}}><Who/></U.Context>,
             '<div>Hello, World!</div>')
})

describe("ifte", () => {
  testEq('U.ifte(C(true), C(1), C(2))', 1)
  testEq('U.ifte(C(false), 1, 2)', 2)
})

describe("ift", () => {
  testEq('U.ift(C(true), C("x"))', "x")
  testEq('U.ift(C(false), "x")', undefined)
})

describe("toPartial", () => {
  testEq(`U.toPartial(R.add)(C(1), undefined)`, undefined)
  testEq(`U.toPartial(R.add)(C(undefined), 2)`, undefined)
  testEq(`U.toPartial(R.add)(1, C(2))`, 3)
})

describe("mapIndexed", () => {
  testEq(`U.mapIndexed((x, i) => [x,i], C([3,1,4]))`, [[3,0], [1,1], [4,2]])
})

describe("scope", () => {
  testEq(`U.scope(() => 101)`, 101)
})

describe("refTo", () => {
  testEq(`{const x = U.atom("x"); U.refTo(x)(null); return x}`, "x")
  testEq(`{const x = U.atom("x"); U.refTo(x)("y"); return x}`, "y")
})

describe("set", () => {
  testEq(`U.set(U.atom(0), 1)`, undefined)
  testEq(`U.set(U.atom(0), C(1))`, undefined)
})

describe("show", () => {
  testEq(`U.show("any")`, "any")
})

describe("staged", () => {
  testEq(`U.staged(x => y => x + y)(1, 2)`, 3)
})

describe("Ramda", () => {
  testEq(`U.add(C(1), C(2))`, 3)
  testEq(`U.addIndex(R.map)(x => x + 1, C([1,2,3]))`, [2,3,4])
  testEq('U.ifElse(U.equals("x"), () => "was x!", x => "was " + x)(C("y"))', "was y")
  testEq('U.pipe(U.add(1), U.add(2))(C(3))', 6)
  testEq(`U.always(C(42))(0)`, 42)
  testEq(`U.cond([[R.equals(1), R.always("one")], [R.equals(2), R.always("two")]])(2)`, "two")
  testEq(`U.cond([[R.equals(1), R.always("one")], [R.equals(2), R.always("two")]])(C(2))`, "two")
  testEq(`U.identity(C(42))`, 42)
})
