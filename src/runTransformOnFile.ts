import jscodeshift, {
  ASTNode,
  Collection,
  Expression,
  Parser,
  Statement,
  JSCodeshift,
} from 'jscodeshift'
import { getParserAsync } from 'babel-parse-wild-code'
import { ReplaceOptions } from './replace'
import Astx, { GetReplacement } from './Astx'
import fs from 'fs-extra'
import Path from 'path'
import memoize from 'lodash/memoize'
import { promisify } from 'util'
import _resolve from 'resolve'
import makeTemplate from './util/template'
const resolve = promisify(_resolve) as any

type TransformOptions = {
  /** The absolute path to the current file. */
  path: string
  /** The source code of the current file. */
  source: string
  root: Collection
  astx: Astx
  expression(strings: TemplateStringsArray, ...quasis: any[]): Expression
  statement(strings: TemplateStringsArray, ...quasis: any[]): Statement
  statements(strings: TemplateStringsArray, ...quasis: any[]): Statement[]
  j: JSCodeshift
  jscodeshift: JSCodeshift
  report: (msg: string) => void
}

export type Transform = {
  astx?: (
    options: TransformOptions
  ) => Collection | string | null | undefined | void
  parser?: string | Parser
  find?: string | ASTNode
  replace?: string | GetReplacement<any>
  where?: ReplaceOptions['where']
}

export type TransformResult = {
  file: string
  source?: string
  transformed?: string
  reports?: any[]
  error?: Error
}

const getPrettier = memoize(
  async (path: string): Promise<any> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const prettier = require(await resolve('prettier', {
        basedir: path,
      }))
      if (
        typeof prettier.format === 'function' &&
        typeof prettier.resolveConfig === 'function'
      )
        return prettier
    } catch (error) {
      // ignore
    }
    return null
  }
)

export const runTransformOnFile = (transform: Transform) => async (
  file: string
): Promise<TransformResult> => {
  try {
    const source = await fs.readFile(file, 'utf8')
    const parser =
      transform.parser || (await getParserAsync(file, { tokens: true }))
    const j = jscodeshift.withParser(parser)
    const template = makeTemplate(j)

    let transformed
    const reports: any[] = []

    if (
      typeof transform.astx !== 'function' &&
      transform.find &&
      transform.replace
    ) {
      transform.astx = ({ astx }) =>
        astx
          .findAuto(transform.find as any, { where: transform.where })
          .replace(transform.replace as any)
    }
    if (typeof transform.astx === 'function') {
      const root = j(source)
      const options = {
        source,
        path: file,
        j,
        jscodeshift: j,
        report: (msg: any) => reports.push(msg),
        ...template,
        root,
        astx: new Astx(j, root),
      }
      const [_result, prettier] = await Promise.all([
        transform.astx(options),
        getPrettier(Path.dirname(file)),
      ])
      transformed = _result
      if (transformed === undefined) transformed = root
      if (transformed instanceof Object) transformed = transformed.toSource()
      if (
        prettier &&
        typeof transformed === 'string' &&
        transformed !== source
      ) {
        const config = (await prettier.resolveConfig(file)) || {}
        if (/tsx?$/.test(parser)) config.parser = 'typescript'
        transformed = prettier.format(transformed, config)
      }
    } else {
      return {
        file,
        error: new Error(
          'transform file must export either astx or find/replace'
        ),
      }
    }
    return {
      file,
      source,
      transformed,
      reports,
    }
  } catch (error) {
    return {
      file,
      error,
    }
  }
}
