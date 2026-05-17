import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { buildValidator, generateHash } from '../../typechecker/src/engine/resolver.js';

const HTTP_METHOD_DECORATORS = ['Get', 'Post', 'Put', 'Delete', 'Patch'];

const PARAM_DECORATORS: Record<string, string> = {
  'Request': 'Request',
  'Headers': 'Headers',
  'Header': 'Header',
  'Ip': 'Ip',
  'Url': 'Url',
  'Hostname': 'Hostname',
  'Path': 'Path',
  'Param': 'Param',
  'Params': 'Param',
  'Query': 'Query',
  'Body': 'Body',
  'RawBody': 'Body',
  'Ctx': 'Context',
  'Context': 'Context'
};

export interface ProjectRegistry {
  endpoints: any[];
  validators: Map<string, ts.Expression>;
  requiredUtils: Set<string>;
  controllers: Map<string, { path: string, injections: Map<string, string> }>;
  guards: Map<string, { path: string, params: any[] }>;
  interceptors: Map<string, { path: string }>;
  externalManifests: Set<string>;
}

export function createRegistry(): ProjectRegistry {
  return {
    endpoints: [],
    validators: new Map(),
    requiredUtils: new Set(),
    controllers: new Map(),
    guards: new Map(),
    interceptors: new Map(),
    externalManifests: new Set()
  };
}

export function discoverFromEntryPoint(program: ts.Program, entryFile: string, registry: ProjectRegistry) {
  const checker = program.getTypeChecker();
  const discoveredFiles = new Set<string>();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;

    if (sourceFile.fileName.includes('node_modules')) {
      // Try to find a manifest in this package
      let current = path.dirname(sourceFile.fileName);
      while (current.includes('node_modules') && current !== path.parse(current).root) {
        const manifestPath = path.join(current, '_metadata.webergency-server.js');
        if (fs.existsSync(manifestPath)) {
          registry.externalManifests.add(manifestPath);
          break;
        }
        if (fs.existsSync(path.join(current, 'package.json'))) break;
        current = path.dirname(current);
      }
      continue;
    }

    const walk = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const decorators = ts.getDecorators(node);
        if (decorators) {
          for (const dec of decorators) {
            const decText = dec.expression.getText();
            const isController = decText.includes('Controller');
            const isGuard = decText.includes('Guard') || decText.includes('Protect'); // Basic heuristic
            const isInterceptor = decText.includes('Intercept');

            // Better check using symbol if possible
            const decSymbol = checker.getSymbolAtLocation(ts.isCallExpression(dec.expression) ? dec.expression.expression : dec.expression);
            const decName = decSymbol?.getName();

            if (decName === 'Controller' || isController) {
              const className = node.name.text;
              const filePath = sourceFile.fileName;
              registry.controllers.set(className, { path: filePath, injections: new Map() });
              discoveredFiles.add(filePath);
              console.log(`- Discovered controller: ${className} in ${path.basename(filePath)}`);
            }
            // Note: Guards and Interceptors are usually discovered via @Protect/@Intercept on controllers
            // but we can also find them if they are classes. 
            // For now, let's focus on controllers as the entry point for analysis.
          }
        }
      }
      ts.forEachChild(node, walk);
    };

    walk(sourceFile);
  }

  return Array.from(discoveredFiles);
}

export function transformer(program: ts.Program, registry: ProjectRegistry) {
  const checker = program.getTypeChecker();

  return (context: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {

      const resolveParamsMetadata = (params: ts.NodeArray<ts.ParameterDeclaration>, skipCount: number = 0) => {
        const metadata: any[] = [];
        const pArray = Array.from(params);
        for (let i = 0; i < pArray.length; i++) {
          if (i < skipCount) continue;
          const p = pArray[i];
          const decs = ts.getDecorators(p);
          let dName = '', pName = '', vHash = '', vMode: any = undefined;

          if (decs) {
            for (const dec of decs) {
              const e = dec.expression;
              const ident = ts.isCallExpression(e) ? e.expression : e;
              if (ts.isIdentifier(ident) && PARAM_DECORATORS[ident.text]) {
                dName = PARAM_DECORATORS[ident.text];
                if (ts.isCallExpression(e)) {
                   if (dName === 'Body') {
                      if (e.arguments[0] && ts.isStringLiteral(e.arguments[0])) {
                         vMode = e.arguments[0].text as any;
                      }
                   } else if (dName === 'Query') {
                      if (e.arguments[0] && ts.isStringLiteral(e.arguments[0])) {
                         pName = e.arguments[0].text;
                      }
                      if (e.arguments[1] && ts.isStringLiteral(e.arguments[1])) {
                         vMode = e.arguments[1].text as any;
                      }
                   } else if (e.arguments[0] && ts.isStringLiteral(e.arguments[0])) {
                      pName = e.arguments[0].text;
                   }
                }
                break;
              }
            }
          }

          if (dName) {
            const type = checker.getTypeAtLocation(p);
            const hash = generateHash(type, checker);
            if (['Body', 'Query', 'Param'].includes(dName)) {
              if (!registry.validators.has(hash)) {
                buildValidator(type, checker, registry.validators, registry.requiredUtils);
              }
              vHash = hash;
            }
            metadata.push({ source: dName, name: pName, validator: vHash, mode: vMode });
          } else {
            metadata.push({ source: 'Request', name: '', validator: '', mode: undefined });
          }
        }
        return metadata;
      };

      const resolveClassRef = (expr: ts.Expression, map: Map<string, any>) => {
        let ident: ts.Identifier | null = null;
        if (ts.isIdentifier(expr)) ident = expr;
        else if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) ident = expr.expression;
        if (ts.isStringLiteral(expr)) return expr.text;
        if (ident) {
          let symbol = checker.getSymbolAtLocation(ident);
          if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol);
          const decl = symbol?.declarations?.[0];
          if (decl && ts.isClassDeclaration(decl)) {
            const name = ident.text;
            if (!map.has(name)) {
              map.set(name, { path: decl.getSourceFile().fileName, params: [] });
            }
            return name;
          }
        }
        return null;
      };

      const resolveGuardMetadata = (expr: ts.Expression, currentController: ts.ClassDeclaration) => {
        if (ts.isStringLiteral(expr)) {
          const methodName = expr.text;
          const member = currentController.members.find(m => ts.isMethodDeclaration(m) && m.name.getText() === methodName) as ts.MethodDeclaration;
          const params = member ? resolveParamsMetadata(member.parameters) : [];
          return { type: 'method', name: methodName, resolvers: [], params, isAsync: false };
        }
        const name = resolveClassRef(expr, registry.guards);
        if (name) {
          const staticArgs: any[] = [];
          if (ts.isCallExpression(expr)) {
            for (const arg of expr.arguments) {
              if (ts.isStringLiteral(arg)) staticArgs.push(arg.text);
              else if (ts.isNumericLiteral(arg)) staticArgs.push(Number(arg.text));
              else if (arg.kind === ts.SyntaxKind.TrueKeyword) staticArgs.push(true);
              else if (arg.kind === ts.SyntaxKind.FalseKeyword) staticArgs.push(false);
              else if (ts.isArrayLiteralExpression(arg)) {
                staticArgs.push(arg.elements.map(e => (e as any).text || e.getText()));
              }
            }
          }
          const guardInfo = registry.guards.get(name);
          return { type: 'class', name, resolvers: staticArgs, params: guardInfo?.params || [], isAsync: false };
        }
        return null;
      };

      const scanInjections = (cls: ts.ClassDeclaration, controllerName: string) => {
        const info = registry.controllers.get(controllerName);
        if (!info) return;

        const type = checker.getTypeAtLocation(cls);
        const properties = checker.getPropertiesOfType(type);

        for (const prop of properties) {
          const propDecl = prop.valueDeclaration;
          if (propDecl && (ts.isPropertyDeclaration(propDecl) || ts.isPropertySignature(propDecl))) {
            const propType = checker.getTypeAtLocation(propDecl);
            const typeSymbol = propType.getSymbol() || propType.aliasSymbol;
            if (typeSymbol) {
              const typeName = typeSymbol.getName();
              // Check if type matches a registered singleton
              if (registry.guards.has(typeName) || registry.interceptors.has(typeName) || registry.controllers.has(typeName)) {
                info.injections.set(prop.getName(), typeName);
              }
            }
          }
        }
      };

      for (const statement of sourceFile.statements) {
        if (ts.isClassDeclaration(statement)) {
          const decorators = ts.getDecorators(statement);
          let controllerDec: ts.Decorator | null = null;
          if (decorators) for (const d of decorators) if (ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Controller') { controllerDec = d; break; }

          if (controllerDec) {
            const controllerName = statement.name?.text || 'Anonymous';
            if (!registry.controllers.has(controllerName)) registry.controllers.set(controllerName, { path: sourceFile.fileName, injections: new Map() });

            const prefix = (controllerDec.expression as ts.CallExpression).arguments[0] as ts.StringLiteral;

            let classPublic = false;
            if (decorators) for (const d of decorators) if (d.expression.getText().includes('Public')) { classPublic = true; break; }

            const classGuards: any[] = [];
            let classGuardDec: ts.Decorator | null = null;
            if (decorators) for (const d of decorators) if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === 'Protect') { classGuardDec = d; break; }
            if (classGuardDec && ts.isCallExpression(classGuardDec.expression)) for (const arg of classGuardDec.expression.arguments) { const g = resolveGuardMetadata(arg, statement); if (g) classGuards.push(g); }

            const classInterceptors: string[] = [];
            let classInterceptDec: ts.Decorator | null = null;
            if (decorators) for (const d of decorators) if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === 'Intercept') { classInterceptDec = d; break; }
            if (classInterceptDec && ts.isCallExpression(classInterceptDec.expression)) for (const arg of classInterceptDec.expression.arguments) { const i = resolveClassRef(arg, registry.interceptors); if (i) classInterceptors.push(i); }

            // Scan for property injections AFTER decorators have registered their classes
            scanInjections(statement, controllerName);

            const type = checker.getTypeAtLocation(statement);
            for (const symbol of type.getProperties()) {
              const member = symbol.valueDeclaration || symbol.declarations?.[0];
              if (member && ts.isMethodDeclaration(member)) {
                const mDecs = ts.getDecorators(member);
                let httpDec: ts.Decorator | null = null;
                if (mDecs) for (const d of mDecs) if (ts.isCallExpression(d.expression) && HTTP_METHOD_DECORATORS.includes(d.expression.expression.getText())) { httpDec = d; break; }

                if (httpDec) {
                  const method = (httpDec.expression as ts.CallExpression).expression.getText();
                  const pathArg = (httpDec.expression as ts.CallExpression).arguments[0] as ts.StringLiteral;
                  const fullPath = (prefix?.text || '') + (pathArg?.text || '');

                  let methodPublic = false;
                  if (mDecs) for (const d of mDecs) if (d.expression.getText().includes('Public')) { methodPublic = true; break; }

                  const methodGuards: any[] = [];
                  let mGuardDec: ts.Decorator | null = null;
                  if (mDecs) for (const d of mDecs) if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === 'Protect') { mGuardDec = d; break; }
                  if (mGuardDec && ts.isCallExpression(mGuardDec.expression)) for (const arg of mGuardDec.expression.arguments) { const g = resolveGuardMetadata(arg, statement); if (g) methodGuards.push(g); }

                  const methodInterceptors: string[] = [];
                  let mInterceptDec: ts.Decorator | null = null;
                  if (mDecs) for (const d of mDecs) if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === 'Intercept') { mInterceptDec = d; break; }
                  if (mInterceptDec && ts.isCallExpression(mInterceptDec.expression)) for (const arg of mInterceptDec.expression.arguments) { const i = resolveClassRef(arg, registry.interceptors); if (i) methodInterceptors.push(i); }

                  const activeGuards = methodPublic ? [] : (methodGuards.length > 0 ? methodGuards : (classPublic ? [] : classGuards));
                  const activeInterceptors = [...classInterceptors, ...methodInterceptors];
                  const paramsMetadata = resolveParamsMetadata(member.parameters);

                  registry.endpoints.push({
                    controller: controllerName, methodName: member.name.getText(), httpMethod: method.toUpperCase(), path: fullPath,
                    params: paramsMetadata, guards: activeGuards, interceptors: activeInterceptors, meta: {}
                  });
                }
              }
            }
          }

          const possibleGuardName = statement.name?.text;
          if (possibleGuardName && registry.guards.has(possibleGuardName)) {
            const guardInfo = registry.guards.get(possibleGuardName)!;
            const useMethod = statement.members.find(m => ts.isMethodDeclaration(m) && m.name.getText() === 'use') as ts.MethodDeclaration;
            if (useMethod) {
              guardInfo.params = resolveParamsMetadata(useMethod.parameters);
            }
          }
        }
      }

      return sourceFile;
    };
  };
}

export function generateManifestCode(registry: ProjectRegistry, controllerMap: Map<string, string>, manifestPath: string): string {
  const manifestDir = path.dirname(manifestPath);
  const finalControllerMap = controllerMap.size > 0 ? controllerMap : new Map(Array.from(registry.controllers.entries()).map(([k, v]) => [k, v.path]));

  let imports = `import { MetadataStore } from '@webergency-utils/server';\n`;
  if (registry.requiredUtils.size > 0) {
    imports += `import { validators } from '@webergency-utils/typechecker';\n`;
  }

  let logic = `\n// --- SINGLETONS ---\n`;

  // Collect Guards and Interceptors
  for (const [name, info] of registry.guards.entries()) {
    const rel = path.relative(manifestDir, info.path).replace(/\.ts$/, '.js');
    imports += `import { ${name} } from './${rel}';\n`;
    logic += `MetadataStore.registerGuard('${name}', new ${name}());\n`;
  }
  for (const [name, info] of registry.interceptors.entries()) {
    const rel = path.relative(manifestDir, info.path).replace(/\.ts$/, '.js');
    imports += `import { ${name} } from './${rel}';\n`;
    logic += `MetadataStore.registerInterceptor('${name}', new ${name}());\n`;
  }

  // Collect Controllers
  for (const [name, fullPath] of finalControllerMap.entries()) {
    const rel = path.relative(manifestDir, fullPath).replace(/\.ts$/, '.js');
    imports += `import { ${name} } from './${rel}';\n`;
  }

  for (const name of registry.controllers.keys()) {
    const info = registry.controllers.get(name)!;
    if (info.injections.size > 0) {
      for (const [propName, typeName] of info.injections.entries()) {
        if (registry.guards.has(typeName)) {
          logic += `_instance_${name}.${propName} = MetadataStore.getGuard('${typeName}');\n`;
        } else if (registry.interceptors.has(typeName)) {
          logic += `_instance_${name}.${propName} = MetadataStore.getInterceptor('${typeName}');\n`;
        } else if (registry.controllers.has(typeName)) {
          logic += `_instance_${name}.${propName} = MetadataStore.getController('${typeName}');\n`;
        }
      }
    }
    logic += `const _instance_${name} = new ${name}();\n`;
    logic += `MetadataStore.registerController('${name}', _instance_${name});\n`;
  }

  // External Manifests (using dynamic import for top-level await)
  let external = `\n// --- EXTERNAL MANIFESTS ---\n`;
  for (const manifestPath of registry.externalManifests) {
    const relPath = path.relative(manifestDir, manifestPath);
    external += `try { await import('./${relPath}'); } catch(e) { console.warn("⚠️ Failed to load external manifest: ${relPath}", e.message); }\n`;
  }

  const validatorCodeMap = new Map<string, string>();
  let validatorsCode = `\n// --- VALIDATORS ---\n`;
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const tempFile = ts.createSourceFile('temp.ts', '', ts.ScriptTarget.Latest);

  const formatCode = (node: ts.Node) => {
    return printer.printNode(ts.EmitHint.Expression, node, undefined as any);
  };

  for (const [hash, expr] of registry.validators.entries()) {
    const code = formatCode(expr);
    validatorsCode += `var __val_${hash} = ${code};\n\n`;
    validatorCodeMap.set(hash, `__val_${hash}`);
  }

  let endpointsCode = `\n// --- ENDPOINTS ---\n`;
  for (const ep of registry.endpoints) {
    for (const g of ep.guards) {
      if (g.type === 'class' && registry.guards.has(g.name)) {
        g.params = registry.guards.get(g.name)!.params || [];
      }
    }

    // Replace validator hashes with actual code references
    let epJson = JSON.stringify(ep, null, 4);
    epJson = epJson.replace(/"validator":\s*"([^"]+)"/g, (match, hash) => {
      const code = validatorCodeMap.get(hash);
      return code ? `"validator": ${code}` : match;
    });

    // Clean up JSON for JS (remove quotes from keys, use single quotes)
    epJson = epJson
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'")
      .replace(/    /g, '\t');

    endpointsCode += `MetadataStore.registerEndpoint(${epJson});\n\n`;
  }

  return imports + external + logic + (validatorCodeMap.size > 0 ? validatorsCode : '') + endpointsCode;
}

function objectToExpression(obj: any): ts.Expression {
  if (obj === null) return ts.factory.createNull();
  if (obj === undefined) return ts.factory.createIdentifier('undefined');
  if (typeof obj === 'string') return ts.factory.createStringLiteral(obj);
  if (typeof obj === 'number') return ts.factory.createNumericLiteral(obj.toString());
  if (typeof obj === 'boolean') return obj ? ts.factory.createTrue() : ts.factory.createFalse();
  if (Array.isArray(obj)) {
    return ts.factory.createArrayLiteralExpression(obj.map(item => objectToExpression(item)));
  }
  if (typeof obj === 'object') {
    const properties: ts.ObjectLiteralElementLike[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'validator' && typeof value === 'string' && value !== '') {
        properties.push(
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier(key),
            ts.factory.createIdentifier(`__val_${value}`)
          )
        );
      } else {
        properties.push(
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier(key),
            objectToExpression(value)
          )
        );
      }
    }
    return ts.factory.createObjectLiteralExpression(properties, true);
  }
  throw new Error(`Unsupported object type: ${typeof obj}`);
}

export default function compilerPlugin(program: ts.Program) {
  const checker = program.getTypeChecker();

  return (context: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {
      // 1. Check if the file has any class with a @Controller decorator
      let hasController = false;
      const checkNode = (node: ts.Node) => {
        if (ts.isClassDeclaration(node)) {
          const decorators = ts.getDecorators(node);
          if (decorators) {
            for (const d of decorators) {
              if (ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Controller') {
                hasController = true;
                break;
              }
            }
          }
        }
        ts.forEachChild(node, checkNode);
      };
      checkNode(sourceFile);

      if (!hasController) {
        return sourceFile;
      }

      // 2. Run our standard analysis transformer on this file to collect all endpoints and validators
      const registry = createRegistry();
      const runTransform = transformer(program, registry)(context);
      const transformedSourceFile = runTransform(sourceFile);

      // 3. Generate and append the self-registration nodes
      const registrations: ts.Statement[] = [];

      // Import MetadataStore as __server_metadata_store from '@webergency-utils/server'
      registrations.push(
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([
              ts.factory.createImportSpecifier(
                false,
                ts.factory.createIdentifier('MetadataStore'),
                ts.factory.createIdentifier('__server_metadata_store')
              )
            ])
          ),
          ts.factory.createStringLiteral('@webergency-utils/server'),
          undefined
        )
      );

      // Import typechecker runtime side-effects if we have validators
      if (registry.validators.size > 0) {
        registrations.push(
          ts.factory.createImportDeclaration(
            undefined,
            undefined,
            ts.factory.createStringLiteral('@webergency-utils/typechecker/runtime'),
            undefined
          )
        );

        if (!hasVariableDeclaration(transformedSourceFile.statements, 'validators')) {
          registrations.push(
            ts.factory.createVariableStatement(
              undefined,
              ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(
                  ts.factory.createIdentifier('validators'),
                  undefined,
                  undefined,
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier('globalThis'),
                    '__WEBERGENCY_TYPECHECKER_VALIDATORS__'
                  )
                )
              ], ts.NodeFlags.Const)
            )
          );
        }
      }

      // Declare all the validators in local variables: const __val_[hash] = expr;
      for (const [hash, expr] of registry.validators.entries()) {
        if (!hasVariableDeclaration(transformedSourceFile.statements, `__val_${hash}`) &&
            !hasVariableDeclaration(registrations, `__val_${hash}`)) {
          registrations.push(
            ts.factory.createVariableStatement(
              undefined,
              ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(
                  ts.factory.createIdentifier(`__val_${hash}`),
                  undefined,
                  undefined,
                  expr
                )
              ], ts.NodeFlags.Const)
            )
          );
        }
      }

      // Register Guards
      for (const name of registry.guards.keys()) {
        registrations.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('__server_metadata_store'),
                'registerGuard'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createNewExpression(
                  ts.factory.createIdentifier(name),
                  undefined,
                  []
                )
              ]
            )
          )
        );
      }

      // Register Interceptors
      for (const name of registry.interceptors.keys()) {
        registrations.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('__server_metadata_store'),
                'registerInterceptor'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createNewExpression(
                  ts.factory.createIdentifier(name),
                  undefined,
                  []
                )
              ]
            )
          )
        );
      }

      // Register Endpoints
      for (const ep of registry.endpoints) {
        registrations.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('__server_metadata_store'),
                'registerEndpoint'
              ),
              undefined,
              [objectToExpression(ep)]
            )
          )
        );
      }

      // Register Controllers (instantiate and handle injections)
      for (const controllerName of registry.controllers.keys()) {
        const controllerInfo = registry.controllers.get(controllerName);
        if (controllerInfo && controllerInfo.injections.size > 0) {
          // const _instance_Name = new Name();
          registrations.push(
            ts.factory.createVariableStatement(
              undefined,
              ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(
                  ts.factory.createIdentifier(`_instance_${controllerName}`),
                  undefined,
                  undefined,
                  ts.factory.createNewExpression(
                    ts.factory.createIdentifier(controllerName),
                    undefined,
                    []
                  )
                )
              ], ts.NodeFlags.Const)
            )
          );

          // Inject properties
          for (const [propName, typeName] of controllerInfo.injections.entries()) {
            let storeMethod = 'getController';
            if (registry.guards.has(typeName)) storeMethod = 'getGuard';
            else if (registry.interceptors.has(typeName)) storeMethod = 'getInterceptor';

            registrations.push(
              ts.factory.createExpressionStatement(
                ts.factory.createBinaryExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(`_instance_${controllerName}`),
                    propName
                  ),
                  ts.SyntaxKind.EqualsToken,
                  ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createIdentifier('__server_metadata_store'),
                      storeMethod
                    ),
                    undefined,
                    [ts.factory.createStringLiteral(typeName)]
                  )
                )
              )
            );
          }

          // Register populated instance
          registrations.push(
            ts.factory.createExpressionStatement(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'registerController'
                ),
                undefined,
                [
                  ts.factory.createStringLiteral(controllerName),
                  ts.factory.createIdentifier(`_instance_${controllerName}`)
                ]
              )
            )
          );
        } else {
          // No injections: direct registration
          registrations.push(
            ts.factory.createExpressionStatement(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'registerController'
                ),
                undefined,
                [
                  ts.factory.createStringLiteral(controllerName),
                  ts.factory.createNewExpression(
                    ts.factory.createIdentifier(controllerName),
                    undefined,
                    []
                  )
                ]
              )
            )
          );
        }
      }

      // Append registrations to the bottom of the sourceFile
      return ts.factory.updateSourceFile(transformedSourceFile, [
        ...transformedSourceFile.statements,
        ...registrations
      ]);
    };
  };
}

function hasVariableDeclaration(statements: readonly ts.Statement[], name: string): boolean {
  for (const statement of statements) {
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) {
          return true;
        }
      }
    }
  }
  return false;
}

