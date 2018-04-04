import * as L from 'kefir.partial.lenses'
import * as R from 'kefir.ramda'
import * as React from 'karet'
import ReactDOM from 'react-dom/server'
import {Observable, concat, constant as C} from 'kefir'

import {AbstractMutable} from 'kefir.atom'
import * as U from '../dist/karet.util.cjs'

function show(x) {
  switch (typeof x) {
    case 'string':
    case 'object':
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

const toExpr = f =>
  f
    .toString()
    .replace(/\s+/g, ' ')
    .replace(/^\s*function\s*\(\s*\)\s*{\s*(return\s*)?/, '')
    .replace(/\s*;?\s*}\s*$/, '')
    .replace(/function\s*(\([a-zA-Z]*\))\s*/g, '$1 => ')
    .replace(/{\s*return\s*([^{;]+)\s*;\s*}/g, '$1')
    .replace(/\(([a-zA-Z0-9_]+)\) =>/g, '$1 =>')
    .replace(/\(0, _kefir[^.]*.constant\)/g, 'C')

const testEq = (expect, thunk) =>
  it(`${toExpr(thunk)} => ${show(expect)}`, done => {
    const actual = thunk()
    const check = actual => {
      const eq = R.equals(actual, expect)
      if (eq instanceof Observable || !eq)
        throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
      done()
    }
    if (actual instanceof Observable) {
      actual.take(1).onValue(check)
    } else {
      check(actual)
    }
  })

const testRender = (expect, vdomThunk) =>
  it(`${expect}`, () => {
    const actual = ReactDOM.renderToStaticMarkup(vdomThunk())

    if (actual !== expect)
      throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
  })

describe('actions', () => {
  testEq('1z2z', () => {
    let i = ''
    U.actions(
      false,
      C(x => (i += '1' + x)),
      undefined,
      x => (i += '2' + x)
    ).onValue(f => f('z'))
    return i
  })
})

describe('bind', () => {
  testEq(2, () => {
    const a = U.atom(1)
    const e = {a: 2}
    const x = U.bind({a})
    x.onChange({target: e})
    return a
  })
})

describe('view', () => {
  testEq(101, () => U.view('x', C({x: 101})))
  testEq(101, () => U.view(C('x'), C({x: 101})))
  testEq(101, () => U.view([C('x')], C({x: 101})))
  testEq(101, () => U.view('x', {x: 101}))
  testEq(101, () => U.view('x', U.atom({x: 101})))
  testEq(101, () => U.view(C('x'), U.atom({x: 101})))
  testEq(101, () => U.view([C('x')], U.atom({x: 101})))
})

describe('bindProps', () => {
  testEq(3, () => {
    const a = U.atom(1)
    const e = {a: 2}
    const x = U.bindProps({ref: 'onChange', a})
    x.ref(e)
    a.set(3)
    return e.a
  })

  testEq(3, () => {
    const a = U.atom(1)
    const e = {a: 2}
    const x = U.bindProps({ref: 'onChange', a})
    x.ref(e)
    e.a = 3
    x.onChange({target: e})
    return a
  })
})

describe('classes', () => {
  testEq({className: ''}, () => U.classes())

  testEq({className: 'a'}, () => U.classes('a'))

  testEq({className: 'a b'}, () => U.classes('a', undefined, 0, false, '', 'b'))

  testEq({className: 'a b'}, () =>
    U.combines(U.classes('a', C('b')), R.identity)
  )
})

describe('cns', () => {
  testEq('', () => U.cns())
  testEq('a b', () => U.cns(null, ['a', false], undefined, C('b'), 0, ''))
})

describe('mapCached', () => {
  testEq(['item 1', 'item 3', 'item 2'], () =>
    U.seq(
      concat([C([2, 1, 1]), C([1, 3, 2])]),
      U.toProperty,
      U.mapCached(i => 'item ' + i)
    )
  )
})

describe('mapElems', () => {
  testEq([[1, 0, 1], [3, 1, 2], [2, 2, 3]], () => {
    let uniq = 0
    const xs = U.atom([2, 1, 1])
    const ys = U.seq(
      xs,
      U.mapElems((x, i) => [x, i, ++uniq]),
      U.flatMapLatest(U.template),
      U.toProperty
    )
    ys.onValue(() => {})
    xs.set([1, 3, 2])
    return ys
  })
})

describe('mapElemsWithIds', () => {
  testEq(
    [[{id: '1'}, '1', 2], [{id: '2'}, '2', 1], [{id: '3'}, '3', 3]],
    () => {
      let uniq = 0
      const xs = U.atom([{id: '2'}, {id: '1'}, {id: '3'}])
      const ys = U.seq(
        xs,
        U.mapElemsWithIds('id', (x, i) => [x, i, ++uniq]),
        U.flatMapLatest(U.template),
        U.toProperty
      )
      ys.onValue(() => {})
      xs.set([{id: '1'}, {id: '2'}, {id: '3'}])
      return ys
    }
  )
})

describe('sink', () => {
  testEq(undefined, () => U.sink(C('lol')))
})

describe('string', () => {
  testEq('Hello!', () => U.string`Hello!`)
  testEq('Hello, constant!', () => U.string`Hello, ${'constant'}!`)
  testEq('Hello, World!', () => U.string`Hello, ${C('World')}!`)
  testEq(
    'Hello, constant property!',
    () => U.string`Hello, ${'constant'} ${C('property')}!`
  )
})

describe('Context', () => {
  const Who = U.withContext((_, {who}) => <div>Hello, {who}!</div>)

  testRender('<div>Hello, World!</div>', () => (
    <U.Context context={{who: C('World')}}>
      <Who />
    </U.Context>
  ))
})

describe('bus', () => {
  testEq(101, () => {
    const b = U.bus()
    let result
    U.seq(b, U.flatMapParallel(R.negate), U.on({value: x => (result = x)}))
    b.push(-101)
    return result
  })
  testEq(69, () => {
    const b = U.bus()
    let result
    U.seq(b, U.flatMapErrors(R.negate), U.on({value: x => (result = x)}))
    b.error(-69)
    return result
  })
  testEq(42, () => {
    const b = U.bus()
    b.end()
    return U.parallel([b, C(42)])
  })
})

describe('ifte', () => {
  testEq(1, () => U.ifte(C(true), C(1), C(2)))
  testEq(2, () => U.ifte(C(false), 1, 2))
})

describe('ift', () => {
  testEq('x', () => U.ift(C(true), C('x')))
  testEq(undefined, () => U.ift(C(false), 'x'))
})

describe('iftes', () => {
  testEq(undefined, () => U.iftes())
  testEq(2, () => U.iftes(C(false), 1, 2))
  testEq(3, () => U.iftes(C(false), 1, C(false), 2, 3))
  testEq(undefined, () => U.iftes(C(false), 1, C(false), 2, C(false), 3))
})

describe('toPartial', () => {
  testEq(undefined, () => U.toPartial(R.add)(C(1), undefined))
  testEq(undefined, () => U.toPartial(R.add)(C(undefined), 2))
  testEq(3, () => U.toPartial(R.add)(1, C(2)))
})

describe('mapIndexed', () => {
  testEq([[3, 0], [1, 1], [4, 2]], () =>
    U.mapIndexed((x, i) => [x, i], C([3, 1, 4]))
  )
})

describe('scope', () => {
  testEq(101, () => U.scope(() => 101))
})

describe('refTo', () => {
  testEq(undefined, () => {
    const x = U.variable()
    U.refTo(x)(null)
    return x.get()
  })
  testEq('y', () => {
    const x = U.variable()
    U.refTo(x)('y')
    return x.get()
  })
})

describe('molecule', () => {
  testEq({x: 1, y: 2}, () => U.molecule({x: U.atom(1), y: U.atom(2)}))
})

describe('template', () => {
  testEq({x: 1, y: 2}, () => U.template({x: C(1), y: C(2)}))
})

describe('set', () => {
  testEq(undefined, () => U.set(U.atom(0), 1))
  testEq(undefined, () => U.set(U.atom(0), C(1)))
})

describe('show', () => {
  testEq('any', () => U.show('any'))
  testEq('string', () => typeof U.show('any'))
  testEq('whatever', () => U.show(C('whatever')))
  testEq(true, () => U.show(C('whatever')) instanceof Observable)
  testEq('whatever', () => U.show(U.atom('whatever')))
  testEq(true, () => U.show(U.atom('whatever')) instanceof AbstractMutable)
})

describe('staged', () => {
  testEq(3, () => U.staged(x => y => x + y)(1)(2))
  testEq(3, () => U.staged(x => y => x + y)(1, 2))
})

describe('tapPartial', () => {
  testEq([0, 1, 2], () => {
    const x = U.atom(0)
    const events = []
    U.seq(x, U.tapPartial(v => events.push(v)), U.on({}))
    x.set(1)
    x.set(undefined)
    x.set(2)
    return events
  })

  testEq([[1, undefined, 2], [1, 2]], () => {
    const events = []
    const x = U.tapPartial(v => events.push(v), 1)
    const y = U.tapPartial(v => events.push(v), undefined)
    const z = U.tapPartial(v => events.push(v), 2)
    return [[x, y, z], events]
  })
})

describe('thru', () => {
  testEq(3, () => U.thru(1, R.add(2)))
  testEq(3, () => U.thru(C(1), R.add(C(2))))
  testEq(3, () => U.thru(C({x: 1}), L.get(C('x')), R.add(C(2))))

  testEq([[true, 0], [true, 1]], () =>
    U.thru(
      U.atom({xs: ['a', 'b']}),
      U.view(C('xs')),
      U.mapElems((x, i) => [x instanceof AbstractMutable, i])
    )
  )
})

describe('thruPartial', () => {
  testEq(3, () => U.thruPartial(C(1), R.add(C(2))))
  testEq(undefined, () => U.thruPartial({x: 1}, L.get(C('y')), R.add(C(2))))
})

describe('Ramda', () => {
  testEq(3, () => U.add(C(1), C(2)))
  testEq([[3, 0], [1, 1], [4, 2]], () =>
    U.addIndex(R.map)((x, i) => [x, i], C([3, 1, 4]))
  )
  testEq([1, 3, 3], () => U.adjust(R.inc, C(1), C([1, 2, 3])))
  testEq(false, () => U.all(R.equals(1), C([1, 2, 3])))
  testEq(true, () => U.allPass([x => x > 1, x => x < 3])(C(2)))
  testEq([2], () =>
    U.filter(U.allPass([C(x => x > 1), C(x => x < 3)]), C([1, 2, 3]))
  )
  testEq('b', () => U.and(C('a'), C('b')))
  testEq(true, () => U.any(R.equals(1), C([1, 2, 3])))
  testEq(true, () => U.anyPass([x => x > 1, x => x < 3])(C(1)))
  testEq([1, 2, 3], () =>
    U.filter(U.anyPass([C(x => x > 1), C(x => x < 3)]), C([1, 2, 3]))
  )
  testEq([2, 4, 6, 4, 5, 6], () =>
    U.ap([U.multiply(2), C(U.add(3))], C([1, 2, 3]))
  )
  testEq('was y', () =>
    U.ifElse(U.equals('x'), () => 'was x!', x => 'was ' + x)(C('y'))
  )
  testEq(6, () => U.pipe(U.add(1), U.add(2))(C(3)))
  testEq(42, () => U.always(C(42))(0))
  testEq('two', () =>
    U.cond([[R.equals(1), R.always('one')], [R.equals(2), R.always('two')]])(2)
  )
  testEq('two', () =>
    U.cond([[R.equals(1), R.always('one')], [R.equals(2), R.always('two')]])(
      C(2)
    )
  )
  testEq(42, () => U.identity(C(42)))
  testEq([{id: 'y'}, {id: 'x'}], () =>
    U.filter(U.where({id: U.has(U.__, C({x: 1, y: 1}))}), [
      {id: 'y'},
      {id: 'z'},
      {id: 'x'}
    ])
  )
})

describe('Kefir', () => {
  testEq(4, () => U.mapValue(v => v * 2, C(2)))
})
