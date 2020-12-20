import { ASTNode, JSCodeshift } from 'jscodeshift'

export default function parseFindOrReplace(
  j: JSCodeshift,
  strings: TemplateStringsArray,
  ...quasis: any[]
): ASTNode {
  const { expression, statement } = j.template
  try {
    return expression(
      [`async () => ${strings[0]}`, ...strings.slice(1)],
      ...quasis
    ).body
  } catch (error) {
    // ignore
  }
  return statement(strings, ...quasis)
}