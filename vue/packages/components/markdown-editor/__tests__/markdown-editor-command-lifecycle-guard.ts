import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

const descendants = (node?: ts.Node): ts.Node[] => {
  const found: ts.Node[] = []
  const visit = (current: ts.Node) => {
    found.push(current)
    ts.forEachChild(current, visit)
  }
  if (node) visit(node)
  return found
}
const identifier = (node?: ts.Node) =>
  node && ts.isIdentifier(node) ? node.text : undefined
const path = (node?: ts.Node): string | undefined => {
  if (!node) return undefined
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) {
    const owner = path(node.expression)
    return owner ? `${owner}.${node.name.text}` : undefined
  }
  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteral(node.argumentExpression)
  ) {
    const owner = path(node.expression)
    return owner ? `${owner}.${node.argumentExpression.text}` : undefined
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  )
    return path(node.expression)
  return undefined
}
const samePath = (node: ts.Node | undefined, expected: string | undefined) =>
  !!expected && path(node) === expected
const root = (node?: ts.Node): string | undefined => {
  if (!node) return undefined
  if (ts.isIdentifier(node)) return node.text
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  )
    return root(node.expression)
  return undefined
}
const mutationMethods = new Set([
  'Object.assign',
  'Object.defineProperty',
  'Object.defineProperties',
  'Object.setPrototypeOf',
  'Reflect.set',
  'Reflect.deleteProperty',
  'Reflect.defineProperty',
  'Reflect.setPrototypeOf',
])
const unknownReference = '<unknown>'
const readonlyMethods = new Set([
  'Object.keys',
  'Object.values',
  'Object.entries',
  'Reflect.get',
  'Reflect.has',
  'Reflect.ownKeys',
])
const references = (nodes: ts.Node[]) => {
  const definitions = new Map<
    string,
    Array<{ value?: ts.Expression; suffix: string[] }>
  >()
  const assigned = new Set<string>()
  const bind = (
    target: ts.BindingName,
    value?: ts.Expression,
    suffix: string[] = [],
  ) => {
    if (ts.isIdentifier(target)) {
      const entries = definitions.get(target.text) ?? []
      entries.push({ value, suffix })
      definitions.set(target.text, entries)
      return
    }
    for (const [index, element] of target.elements.entries()) {
      if (!ts.isBindingElement(element)) continue
      const key = element.propertyName ?? element.name
      const name =
        ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : undefined
      bind(element.name, value, [
        ...suffix,
        ts.isArrayBindingPattern(target)
          ? String(index)
          : (name ?? unknownReference),
      ])
      if (element.initializer) bind(element.name, element.initializer)
    }
  }
  for (const node of nodes) {
    if (ts.isVariableDeclaration(node)) bind(node.name, node.initializer)
    else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      assigned.add(node.left.text)
      bind(node.left, node.right)
    }
  }
  const merge = (sets: Set<string>[]) =>
    new Set(sets.flatMap((set) => [...set]))
  const resolve = (
    node: ts.Node | undefined,
    suffix: string[],
    seen: Set<string>,
  ): Set<string> => {
    if (!node) return new Set([unknownReference])
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return resolve(node.expression, suffix, seen)
    if (ts.isConditionalExpression(node))
      return merge([
        resolve(node.whenTrue, suffix, seen),
        resolve(node.whenFalse, suffix, seen),
      ])
    if (ts.isArrayLiteralExpression(node))
      return resolve(node.elements[Number(suffix[0])], suffix.slice(1), seen)
    if (ts.isObjectLiteralExpression(node)) {
      const key = suffix[0]
      const entry = node.properties.find((candidate) => {
        if (
          !ts.isPropertyAssignment(candidate) &&
          !ts.isShorthandPropertyAssignment(candidate)
        )
          return false
        return (
          identifier(candidate.name) === key ||
          (ts.isStringLiteral(candidate.name) && candidate.name.text === key)
        )
      })
      return resolve(
        entry &&
          (ts.isPropertyAssignment(entry) ? entry.initializer : entry.name),
        suffix.slice(1),
        seen,
      )
    }
    const value = path(node)
    if (!value) return new Set([unknownReference])
    const [first, ...rest] = value.replace(/^globalThis\./u, '').split('.')
    if (!first || seen.has(first)) return new Set([unknownReference])
    const origins = definitions.get(first)
    if (!origins) return new Set([[first, ...rest, ...suffix].join('.')])
    // Resolve the finite definition graph with a visited binding set. Retain
    // every assignment origin; never rank away a different invocation form.
    return merge(
      origins.map((origin) =>
        resolve(
          origin.value,
          [...origin.suffix, ...rest, ...suffix],
          new Set([...seen, first]),
        ),
      ),
    )
  }
  const uncertain = (
    node: ts.Node | undefined,
    seen = new Set<string>(),
  ): boolean => {
    const first = path(node)?.split('.')[0]
    if (!first) return false
    if (assigned.has(first) || seen.has(first)) return true
    return (
      definitions
        .get(first)
        ?.some((definition) =>
          uncertain(definition.value, new Set([...seen, first])),
        ) ?? false
    )
  }
  return Object.assign((node?: ts.Node) => resolve(node, [], new Set()), {
    uncertain,
  })
}
const writes = (
  node: ts.Node,
  bindings: Set<string>,
  reference = references(descendants(node)),
) => {
  const owned = (target: ts.Node | undefined) =>
    bindings.has(root(target) ?? '')
  const containsOwned = (target: ts.Node | undefined): boolean => {
    if (!target) return false
    if (owned(target)) return true
    if (ts.isArrayLiteralExpression(target))
      return target.elements.some(containsOwned)
    if (ts.isObjectLiteralExpression(target))
      return target.properties.some((entry) =>
        ts.isPropertyAssignment(entry)
          ? containsOwned(entry.initializer)
          : ts.isShorthandPropertyAssignment(entry)
            ? owned(entry.name)
            : ts.isSpreadAssignment(entry) && containsOwned(entry.expression),
      )
    return false
  }
  const recognized = (callee: string): boolean =>
    mutationMethods.has(callee) ||
    callee === 'Reflect.apply' ||
    (/\.(?:call|apply)$/u.test(callee) &&
      recognized(callee.replace(/\.(?:call|apply)$/u, '')))
  const invokesMutation = (
    callee: string,
    args: readonly ts.Expression[],
  ): boolean => {
    if (mutationMethods.has(callee)) return owned(args[0])
    if (callee.endsWith('.call'))
      return invokesMutation(callee.slice(0, -5), args.slice(1))
    if (callee.endsWith('.apply') && callee !== 'Reflect.apply') {
      const actualArgs = args[1]
      return actualArgs && ts.isArrayLiteralExpression(actualArgs)
        ? invokesMutation(callee.slice(0, -6), actualArgs.elements)
        : recognized(callee.slice(0, -6)) && containsOwned(actualArgs)
    }
    if (callee === 'Reflect.apply') {
      const functions = reference(args[0])
      const actualArgs = args[2]
      return [...functions].some((target) => {
        if (target === unknownReference) return containsOwned(actualArgs)
        if (actualArgs && ts.isArrayLiteralExpression(actualArgs))
          return invokesMutation(target, actualArgs.elements)
        return recognized(target) && containsOwned(actualArgs)
      })
    }
    return false
  }
  return descendants(node).some((entry) => {
    if (
      ts.isBinaryExpression(entry) &&
      entry.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      entry.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      return descendants(entry.left).some(owned)
    if (ts.isDeleteExpression(entry)) return owned(entry.expression)
    if (ts.isPrefixUnaryExpression(entry) || ts.isPostfixUnaryExpression(entry))
      return (
        (entry.operator === ts.SyntaxKind.PlusPlusToken ||
          entry.operator === ts.SyntaxKind.MinusMinusToken) &&
        owned(entry.operand)
      )
    if (!ts.isCallExpression(entry)) return false
    const callees = reference(entry.expression)
    if ([...callees].some((callee) => invokesMutation(callee, entry.arguments)))
      return true
    // Bare mutable aliases with unknown/conflicting origins cannot establish
    // a readonly call. Ordinary opaque receiver methods retain the existing
    // bounded policy, including genuine Map entry operations.
    const calleePath = path(entry.expression)
    const bare =
      !!calleePath &&
      (!calleePath.includes('.') || /\.(?:call|apply)$/u.test(calleePath))
    return (
      bare &&
      entry.arguments.some(containsOwned) &&
      ((callees.has(unknownReference) &&
        reference.uncertain(entry.expression)) ||
        (callees.size > 1 &&
          [...callees].some(
            (callee) => !recognized(callee) && !readonlyMethods.has(callee),
          )))
    )
  })
}
const aliases = (nodes: ts.Node[], original: string[]) => {
  const bindings = new Set(original)
  const containsOwned = (value?: ts.Node): boolean => {
    if (!value) return false
    if (bindings.has(root(value) ?? '')) return true
    if (ts.isArrayLiteralExpression(value))
      return value.elements.some(containsOwned)
    if (ts.isObjectLiteralExpression(value))
      return value.properties.some((entry) =>
        ts.isPropertyAssignment(entry)
          ? containsOwned(entry.initializer)
          : ts.isShorthandPropertyAssignment(entry)
            ? bindings.has(entry.name.text)
            : ts.isSpreadAssignment(entry) && containsOwned(entry.expression),
      )
    if (ts.isSpreadElement(value)) return containsOwned(value.expression)
    if (ts.isConditionalExpression(value))
      return containsOwned(value.whenTrue) || containsOwned(value.whenFalse)
    return false
  }
  const bind = (target: ts.Node) => {
    if (ts.isIdentifier(target)) bindings.add(target.text)
    else if (
      ts.isObjectBindingPattern(target) ||
      ts.isArrayBindingPattern(target)
    ) {
      for (const element of target.elements)
        if (ts.isBindingElement(element)) bind(element.name)
    } else if (ts.isObjectLiteralExpression(target)) {
      for (const element of target.properties)
        if (ts.isPropertyAssignment(element)) bind(element.initializer)
        else if (ts.isShorthandPropertyAssignment(element)) bind(element.name)
    } else if (ts.isArrayLiteralExpression(target))
      target.elements.forEach(bind)
  }
  let previousSize = -1
  while (previousSize !== bindings.size) {
    previousSize = bindings.size
    for (const entry of nodes) {
      const target = ts.isVariableDeclaration(entry)
        ? entry.name
        : ts.isBinaryExpression(entry) &&
            entry.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ? entry.left
          : undefined
      const value = ts.isVariableDeclaration(entry)
        ? entry.initializer
        : ts.isBinaryExpression(entry)
          ? entry.right
          : undefined
      if (target && containsOwned(value)) bind(target)
    }
  }
  return bindings
}
const truth = (node: ts.Expression): boolean | undefined => {
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isParenthesizedExpression(node)) return truth(node.expression)
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const value = truth(node.operand)
    return value === undefined ? undefined : !value
  }
  return undefined
}
// Bounded source reachability: unknown conditions retain both paths; a definite
// exit, constant branch, or unbounded loop cannot lend dead cancellation calls.
const canContinue = (statement: ts.Statement): boolean => {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement))
    return false
  if (ts.isBlock(statement)) return statement.statements.every(canContinue)
  if (ts.isIfStatement(statement)) {
    const condition = truth(statement.expression)
    const thenContinues = canContinue(statement.thenStatement)
    const elseContinues =
      !statement.elseStatement || canContinue(statement.elseStatement)
    return condition === true
      ? thenContinues
      : condition === false
        ? elseContinues
        : thenContinues || elseContinues
  }
  if (ts.isWhileStatement(statement) || ts.isDoStatement(statement))
    return (
      truth(statement.expression) !== true &&
      (!ts.isDoStatement(statement) || canContinue(statement.statement))
    )
  if (ts.isForStatement(statement))
    return !!statement.condition && truth(statement.condition) !== true
  if (ts.isForOfStatement(statement) || ts.isForInStatement(statement))
    return canContinue(statement.statement)
  // These require a separate control-flow proof rather than presence matching.
  if (
    ts.isTryStatement(statement) ||
    ts.isSwitchStatement(statement) ||
    ts.isLabeledStatement(statement) ||
    ts.isBreakStatement(statement) ||
    ts.isContinueStatement(statement)
  )
    return false
  return true
}
const reachable = (
  block: ts.Block | undefined,
  statement: ts.Statement | undefined,
) => {
  if (!block || !statement) return false
  const index = block.statements.indexOf(statement)
  return index >= 0 && block.statements.slice(0, index).every(canContinue)
}
const calls = (node?: ts.Node) => descendants(node).filter(ts.isCallExpression)
const variables = (node?: ts.Node) =>
  descendants(node).filter(ts.isVariableDeclaration)
const property = (node: ts.Node | undefined, name: string) =>
  node && ts.isObjectLiteralExpression(node)
    ? node.properties.find(
        (entry): entry is ts.PropertyAssignment =>
          ts.isPropertyAssignment(entry) && identifier(entry.name) === name,
      )?.initializer
    : undefined
const isLiteral = (node: ts.Node | undefined, value: string) =>
  !!node && ts.isStringLiteral(node) && node.text === value
const isCall = (node: ts.Node | undefined, callee: string | undefined) =>
  !!callee &&
  !!node &&
  ts.isCallExpression(node) &&
  path(node.expression) === callee
const isExit = (statement: ts.Statement) =>
  ts.isReturnStatement(statement) ||
  (ts.isBlock(statement) &&
    !!statement.statements.at(-1) &&
    ts.isReturnStatement(statement.statements.at(-1)!))
const directCall = (statement: ts.Statement, callee: string | undefined) =>
  ts.isExpressionStatement(statement) && isCall(statement.expression, callee)

/** Inspect the actual command owner, not unrelated controllers elsewhere in an SFC. */
export const commandLifecycleViolations = (component: string): string[] => {
  const { descriptor, errors } = parse(component)
  if (errors.length || !descriptor.scriptSetup) return ['invalid-component']
  const source = ts.createSourceFile(
    'markdown-editor.vue.ts',
    descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const violations: string[] = []
  const check = (condition: unknown, rule: string) => {
    if (!condition) violations.push(rule)
  }
  const reference = references(descendants(source))
  const imported = (exported: string, module: string, typeOnly = false) => {
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !isLiteral(statement.moduleSpecifier, module)
      )
        continue
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      const entry = bindings.elements.find(
        (candidate) =>
          (candidate.propertyName ?? candidate.name).text === exported,
      )
      if (
        entry &&
        (typeOnly || (!entry.isTypeOnly && !statement.importClause?.isTypeOnly))
      )
        return entry.name.text
    }
    return undefined
  }
  const topVariables = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
  const functionBody = (name: string) => {
    const initializer = topVariables.find(
      (entry) => identifier(entry.name) === name,
    )?.initializer
    return initializer &&
      ts.isArrowFunction(initializer) &&
      ts.isBlock(initializer.body)
      ? initializer.body
      : undefined
  }
  const run = functionBody('runCommand')
  check(run, 'missing-command-owner')
  if (!run) return violations
  const controllerConstructors = new Set([
    'AbortController',
    'globalThis.AbortController',
    'window.AbortController',
  ])
  for (const entry of [...topVariables, ...variables(run)]) {
    const name = identifier(entry.name)
    const constructor = path(entry.initializer)
    if (name && constructor && controllerConstructors.has(constructor))
      controllerConstructors.add(name)
  }
  check(
    !descendants(run).some(
      (node) =>
        ts.isNewExpression(node) &&
        controllerConstructors.has(path(node.expression) ?? ''),
    ),
    'command-local-controller',
  )

  const factory = imported(
    'createMarkdownEditorCommandSession',
    './markdown-editor-command-async',
  )
  const rebase = imported(
    'rebaseMarkdownEditorCommandSession',
    './markdown-editor-command-async',
  )
  const resolve = imported(
    'resolveMarkdownEditorCommandSession',
    './markdown-editor-command-async',
  )
  const abort = imported(
    'abortMarkdownEditorCommandSessions',
    './markdown-editor-command-async',
  )
  const execute = imported('runMarkdownEditorCommand', './markdown-editor')
  const shadowed = (name?: string, scope: ts.Node | undefined = run) =>
    !!name &&
    descendants(scope).some(
      (node) =>
        (ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isFunctionDeclaration(node)) &&
        identifier(node.name) === name,
    )
  const sessionDeclaration = variables(run).find(
    (entry) =>
      entry.parent.parent.parent === run && isCall(entry.initializer, factory),
  )
  const creation = sessionDeclaration?.initializer
  check(sessionDeclaration && !shadowed(factory), 'real-session-factory')
  if (!sessionDeclaration || !creation || !ts.isCallExpression(creation))
    return violations
  const session = identifier(sessionDeclaration.name)
  const key = path(creation.arguments[0])
  const owner = run.parent
  const parameter = ts.isArrowFunction(owner) ? owner.parameters[0] : undefined
  const command = identifier(parameter?.name)
  check(
    command &&
      parameter?.type &&
      ts.isTypeReferenceNode(parameter.type) &&
      samePath(
        parameter.type.typeName,
        imported('MarkdownEditorCommand', './markdown-editor', true),
      ) &&
      !shadowed(command) &&
      samePath(creation.arguments[0], `${command}.key`) &&
      !writes(run, aliases(descendants(run), [command]), reference),
    'original-command-key',
  )
  const registry = identifier(property(creation.arguments[2], 'activeSessions'))
  const registryDeclaration = topVariables.find(
    (entry) => identifier(entry.name) === registry,
  )
  // Entry operations are legitimate; rebinding this Map, its methods, or a
  // destructured/container alias invalidates the iterator/controller provenance.
  const registryIntact =
    !!registry &&
    !writes(source, aliases(descendants(source), [registry, 'Map']), reference)
  check(
    registry &&
      registryIntact &&
      !shadowed(registry) &&
      registryDeclaration?.initializer &&
      ts.isNewExpression(registryDeclaration.initializer) &&
      path(registryDeclaration.initializer.expression) === 'Map',
    'shared-session-registry',
  )
  const attempt = run.statements.find(ts.isTryStatement)
  check(attempt?.finallyBlock, 'session-finally')
  if (!attempt) return violations
  const registration = run.statements.find((statement) => {
    if (
      !directCall(statement, `${registry}.set`) ||
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression)
    )
      return false
    return (
      samePath(statement.expression.arguments[0], key) &&
      identifier(statement.expression.arguments[1]) === session
    )
  })
  check(
    registration &&
      sessionDeclaration.pos < registration.pos &&
      registration.pos < attempt.pos,
    'register-original-session',
  )
  check(
    run.statements.some(
      (statement) =>
        calls(statement).some(
          (call) =>
            path(call.expression) === 'commandRuntimeStates.value.set' &&
            samePath(call.arguments[0], key) &&
            isLiteral(property(call.arguments[1], 'state'), 'pending'),
        ) && statement.pos < attempt.pos,
    ),
    'publish-pending-session',
  )

  const awaited = variables(attempt.tryBlock).find(
    (entry) =>
      entry.parent.parent.parent === attempt.tryBlock &&
      entry.initializer &&
      ts.isAwaitExpression(entry.initializer) &&
      isCall(entry.initializer.expression, execute),
  )
  check(awaited && !shadowed(execute), 'await-real-command')
  const execution = awaited?.initializer
  const executionCall =
    execution &&
    ts.isAwaitExpression(execution) &&
    ts.isCallExpression(execution.expression)
      ? execution.expression
      : undefined
  const context = variables(attempt.tryBlock).find(
    (entry) =>
      identifier(entry.name) === identifier(executionCall?.arguments[1]),
  )
  const supplied = identifier(context?.name)
  // Track local aliases as well as the direct context/controller binding. A
  // write through either alias changes the object supplied to the executor.
  const beforeExecution = descendants(run).filter(
    (entry) =>
      entry.getStart(source) >= sessionDeclaration.end &&
      entry.end <= (executionCall?.getStart(source) ?? -1),
  )
  const bindings = aliases(
    beforeExecution,
    [supplied, session].filter((name): name is string => !!name),
  )
  check(
    samePath(executionCall?.arguments[0], command),
    'execute-original-command',
  )
  check(
    context &&
      path(property(context.initializer, 'signal')) ===
        `${session}.abort.signal` &&
      context.pos < (awaited?.pos ?? -1) &&
      ts.isObjectLiteralExpression(context.initializer!) &&
      context.initializer.properties.at(-1) &&
      ts.isPropertyAssignment(context.initializer.properties.at(-1)!) &&
      identifier(context.initializer.properties.at(-1)!.name) === 'signal' &&
      !beforeExecution.some((entry) => writes(entry, bindings, reference)),
    'original-session-signal',
  )
  const awaitedIndex = attempt.tryBlock.statements.findIndex((statement) =>
    descendants(statement).includes(awaited!),
  )
  const guard = attempt.tryBlock.statements[awaitedIndex + 1]
  const sameSessionGuard = (
    statement: ts.Statement | undefined,
    operator: ts.SyntaxKind,
  ) => {
    if (
      !statement ||
      !ts.isIfStatement(statement) ||
      !ts.isBinaryExpression(statement.expression)
    )
      return false
    const condition = statement.expression
    return (
      condition.operatorToken.kind === operator &&
      isCall(condition.left, `${registry}.get`) &&
      ts.isCallExpression(condition.left) &&
      samePath(condition.left.arguments[0], key) &&
      identifier(condition.right) === session
    )
  }
  check(
    sameSessionGuard(guard, ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
      guard &&
      ts.isIfStatement(guard) &&
      isExit(guard.thenStatement),
    'post-await-original-session',
  )

  const rebased = variables(attempt.tryBlock).find((entry) =>
    isCall(entry.initializer, rebase),
  )
  const resolved = variables(attempt.tryBlock).find((entry) =>
    isCall(entry.initializer, resolve),
  )
  const lifecycleCall = (entry: ts.VariableDeclaration | undefined) =>
    entry?.initializer && ts.isCallExpression(entry.initializer)
      ? entry.initializer
      : undefined
  const rebaseCall = lifecycleCall(rebased)
  const resolveCall = lifecycleCall(resolved)
  const currentContext = identifier(rebaseCall?.arguments[1])
  const map = variables(attempt.tryBlock).find(
    (entry) => identifier(entry.name) === identifier(rebaseCall?.arguments[2]),
  )
  const mapCall = lifecycleCall(map)
  check(
    rebased &&
      !shadowed(rebase) &&
      identifier(rebaseCall?.arguments[0]) === session &&
      mapCall &&
      path(mapCall.expression) === 'positionMapFromRevision' &&
      path(mapCall.arguments[0]) === `${session}.revision` &&
      path(mapCall.arguments[1]) === `${currentContext}.revision` &&
      (guard?.end ?? Infinity) < rebased.pos,
    'rebase-original-session',
  )
  check(
    resolved &&
      !shadowed(resolve) &&
      identifier(resolveCall?.arguments[0]) === session &&
      identifier(resolveCall?.arguments[1]) === currentContext &&
      isLiteral(resolveCall?.arguments[2], 'resolved-current') &&
      (rebased?.end ?? Infinity) < resolved.pos,
    'resolve-original-session',
  )
  const stateGuard = (
    entry: ts.VariableDeclaration | undefined,
    state: string,
  ) =>
    attempt.tryBlock.statements.find(
      (statement) =>
        ts.isIfStatement(statement) &&
        ts.isBinaryExpression(statement.expression) &&
        identifier(statement.expression.left) === identifier(entry?.name) &&
        statement.expression.operatorToken.kind ===
          ts.SyntaxKind.ExclamationEqualsEqualsToken &&
        isLiteral(statement.expression.right, state) &&
        isExit(statement.thenStatement) &&
        (entry?.end ?? Infinity) < statement.getStart(source),
    )
  const rebaseGuard = stateGuard(rebased, 'pending')
  const resolveGuard = stateGuard(resolved, 'resolved-current')
  const dispatches = calls(attempt.tryBlock).filter(
    (call) => path(call.expression) === 'dispatchTransaction',
  )
  check(
    rebaseGuard &&
      resolved &&
      rebaseGuard.end < resolved.pos &&
      resolveGuard &&
      dispatches.length > 0 &&
      dispatches.every((call) => resolveGuard.end < call.pos),
    'guard-current-commit',
  )
  check(
    attempt.finallyBlock?.statements.some(
      (statement) =>
        sameSessionGuard(statement, ts.SyntaxKind.EqualsEqualsEqualsToken) &&
        ts.isIfStatement(statement) &&
        calls(statement.thenStatement).some(
          (call) =>
            path(call.expression) === `${registry}.delete` &&
            samePath(call.arguments[0], key),
        ),
    ),
    'retire-original-session',
  )

  const cancellation = functionBody('abortPendingCommands')
  const cancelCall = cancellation?.statements.find((statement) =>
    directCall(statement, abort),
  )
  const cancelExpression =
    cancelCall &&
    ts.isExpressionStatement(cancelCall) &&
    ts.isCallExpression(cancelCall.expression)
      ? cancelCall.expression
      : undefined
  const clear = cancellation?.statements.find((statement) =>
    directCall(statement, `${registry}.clear`),
  )
  const sharedCancellation =
    registryIntact &&
    !shadowed(abort, cancellation) &&
    !shadowed(registry, cancellation) &&
    cancelExpression &&
    isCall(cancelExpression.arguments[0], `${registry}.values`) &&
    clear &&
    cancelExpression.end < clear.getStart(source) &&
    reachable(cancellation, cancelCall) &&
    reachable(cancellation, clear)
  check(sharedCancellation, 'abort-shared-sessions')
  check(
    cancellation?.statements.some((statement) => {
      if (
        !ts.isForOfStatement(statement) ||
        !isCall(statement.expression, `${registry}.values`) ||
        !ts.isVariableDeclarationList(statement.initializer)
      )
        return false
      const owned = identifier(statement.initializer.declarations[0]?.name)
      if (
        !owned ||
        !ts.isBlock(statement.statement) ||
        !reachable(cancellation, statement)
      )
        return false
      const abortStatement = statement.statement.statements.find((entry) =>
        directCall(entry, `${owned}.abort.abort`),
      )
      return reachable(statement.statement, abortStatement)
    }),
    'abort-original-controllers',
  )

  const watch = imported('watch', 'vue')
  const unmount = imported('onBeforeUnmount', 'vue')
  const hooks = source.statements
    .filter(ts.isExpressionStatement)
    .map((statement) => statement.expression)
    .filter(ts.isCallExpression)
  const cancels = (callback?: ts.Node) =>
    !!sharedCancellation &&
    !!callback &&
    ts.isArrowFunction(callback) &&
    ts.isBlock(callback.body) &&
    !shadowed('abortPendingCommands', callback.body) &&
    callback.body.statements.some(
      (statement) =>
        directCall(statement, 'abortPendingCommands') &&
        reachable(callback.body as ts.Block, statement),
    )
  const watches = hooks.filter((call) => isCall(call, watch))
  check(
    watches.some(
      (call) =>
        call.arguments[0] &&
        ts.isArrowFunction(call.arguments[0]) &&
        path(call.arguments[0].body) === 'props.modelValue' &&
        cancels(call.arguments[1]),
    ),
    'cancel-model-reset',
  )
  check(
    watches.some((call) => {
      const selectors = call.arguments[0]
      if (!selectors || !ts.isArrayLiteralExpression(selectors)) return false
      const identities = selectors.elements
        .filter(ts.isArrowFunction)
        .map((selector) => path(selector.body))
      return (
        identities.includes('props.documentIdentity.id') &&
        identities.includes('props.documentIdentity.epoch') &&
        cancels(call.arguments[1])
      )
    }),
    'cancel-document-reset',
  )
  check(
    hooks.some((call) => isCall(call, unmount) && cancels(call.arguments[0])),
    'cancel-unmount',
  )
  return violations
}
