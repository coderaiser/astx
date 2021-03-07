export const input = `
class Foo implements A, B, C, D { }
`

export const find = `
class Foo implements $_a, C, $d { }
`

export const replace = `
class Bar implements C, $_a, E, $d { }
`

export const expected = `
class Bar implements C, A, B, E, D { }
`
