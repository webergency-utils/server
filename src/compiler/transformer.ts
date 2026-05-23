import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { buildValidator, generateHash } from '@webergency-utils/typechecker/transformer';

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
  controllers: Map<string, { path: string; injections: Map<string, string> }>;
  providers: Map<string, { path: string }>;
  modules: Map<string, { path: string }>;
  guards: Map<string, { path: string; params?: any[] }>;
  interceptors: Map<string, { path: string }>;
  endpoints: any[];
  validators: Map<string, ts.Expression>;
  requiredUtils: Set<string>;
  externalManifests: Set<string>;
}

export function createRegistry(): ProjectRegistry {
  return {
    controllers: new Map(),
    providers: new Map(),
    modules: new Map(),
    guards: new Map(),
    interceptors: new Map(),
    endpoints: [],
    validators: new Map(),
    requiredUtils: new Set(),
    externalManifests: new Set()
  };
}

function parseExpression(expr: ts.Expression, sourceFile: ts.SourceFile): any {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isNumericLiteral(expr)) {
    return Number(expr.text);
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (expr.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (ts.isIdentifier(expr) && expr.text === 'undefined') {
    return undefined;
  }
  if (ts.isArrayLiteralExpression(expr)) {
    return expr.elements.map(e => parseExpression(e, sourceFile));
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const obj: Record<string, any> = {};
    for (const prop of expr.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : prop.name.getText(sourceFile);
        obj[key] = parseExpression(prop.initializer, sourceFile);
      }
    }
    return obj;
  }
  
  // Print expression to code for other node types
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const code = printer.printNode(ts.EmitHint.Expression, expr, sourceFile);
  return { __raw_code__: code };
}

function extractCorsConfig(decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile): any {
  if (!decorators) return undefined;
  for (const d of decorators) {
    const isCors = 
      (ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Cors') ||
      (ts.isIdentifier(d.expression) && d.expression.text === 'Cors');
      
    if (isCors) {
      if (ts.isCallExpression(d.expression)) {
        if (d.expression.arguments.length > 0) {
          return parseExpression(d.expression.arguments[0], sourceFile);
        }
        return {};
      }
      return {};
    }
  }
  return undefined;
}

function extractSecurityConfig(decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile): any {
  if (!decorators) return undefined;
  for (const d of decorators) {
    const isSecurity = 
      (ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Security') ||
      (ts.isIdentifier(d.expression) && d.expression.text === 'Security');
      
    if (isSecurity) {
      if (ts.isCallExpression(d.expression)) {
        if (d.expression.arguments.length > 0) {
          return parseExpression(d.expression.arguments[0], sourceFile);
        }
        return {};
      }
      return {};
    }
  }
  return undefined;
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
            const isInjectable = decText.includes('Injectable');
            const isModule = decText.includes('Module');

            // Better check using symbol if possible
            const decSymbol = checker.getSymbolAtLocation(ts.isCallExpression(dec.expression) ? dec.expression.expression : dec.expression);
            const decName = decSymbol?.getName();

            if (decName === 'Controller' || isController) {
              const className = node.name.text;
              const filePath = sourceFile.fileName;
              registry.controllers.set(className, { path: filePath, injections: new Map() });
              discoveredFiles.add(filePath);
              console.log(`- Discovered controller: ${className} in ${path.basename(filePath)}`);
            } else if (decName === 'Injectable' || isInjectable) {
              const className = node.name.text;
              const filePath = sourceFile.fileName;
              registry.providers.set(className, { path: filePath });
              discoveredFiles.add(filePath);
              console.log(`- Discovered provider: ${className} in ${path.basename(filePath)}`);
            } else if (decName === 'Module' || isModule) {
              const className = node.name.text;
              const filePath = sourceFile.fileName;
              registry.modules.set(className, { path: filePath });
              discoveredFiles.add(filePath);
              console.log(`- Discovered module: ${className} in ${path.basename(filePath)}`);
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    };

    walk(sourceFile);
  }

  return Array.from(discoveredFiles);
}

function getBaseClass(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker): ts.ClassDeclaration | null {
  if (!classDecl.heritageClauses) return null;
  for (const clause of classDecl.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      const typeNode = clause.types[0];
      if (typeNode) {
        const type = checker.getTypeAtLocation(typeNode);
        const symbol = type.getSymbol() || type.aliasSymbol;
        const decl = symbol?.valueDeclaration || symbol?.declarations?.[0];
        if (decl && ts.isClassDeclaration(decl)) {
          return decl;
        }
      }
    }
  }
  return null;
}

function resolveParamInjectionToken(param: ts.ParameterDeclaration, checker: ts.TypeChecker): string {
  const decorators = ts.getDecorators(param);
  if (decorators) {
    for (const dec of decorators) {
      const expr = dec.expression;
      const ident = ts.isCallExpression(expr) ? expr.expression : expr;
      if (ts.isIdentifier(ident) && ident.text === 'Inject') {
        if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
          const arg = expr.arguments[0];
          if (ts.isStringLiteral(arg)) return arg.text;
          if (ts.isIdentifier(arg)) return arg.text;
          return arg.getText();
        }
      }
    }
  }

  // Fallback to type
  if (param.type) {
    const type = checker.getTypeAtLocation(param);
    const symbol = type.getSymbol() || type.aliasSymbol;
    if (symbol) {
      const name = symbol.getName();
      const primitives = ['Object', 'Function', 'String', 'Number', 'Boolean', 'any', 'unknown', 'never'];
      if (!primitives.includes(name)) {
        return name;
      }
    }
  }

  return 'any';
}

function resolveConstructorDeps(constructorDecl: ts.ConstructorDeclaration, checker: ts.TypeChecker): string[] {
  return constructorDecl.parameters.map(param => resolveParamInjectionToken(param, checker));
}

function findConstructorDeps(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker): string[] | undefined {
  const constructorDecl = classDecl.members.find(ts.isConstructorDeclaration);
  if (constructorDecl) {
    return resolveConstructorDeps(constructorDecl, checker);
  }
  const baseClass = getBaseClass(classDecl, checker);
  if (baseClass) {
    return findConstructorDeps(baseClass, checker);
  }
  return undefined;
}

function resolvePropertyDeps(classDecl: ts.ClassDeclaration, checker: ts.TypeChecker): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const member of classDecl.members) {
    if (ts.isPropertyDeclaration(member) && member.name) {
      const propName = member.name.getText();
      const decorators = ts.getDecorators(member);
      if (decorators) {
        for (const dec of decorators) {
          const expr = dec.expression;
          const ident = ts.isCallExpression(expr) ? expr.expression : expr;
          if (ts.isIdentifier(ident) && ident.text === 'Inject') {
            let token: string | undefined;
            if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
              const arg = expr.arguments[0];
              if (ts.isStringLiteral(arg)) token = arg.text;
              else if (ts.isIdentifier(arg)) token = arg.text;
              else token = arg.getText();
            }
            if (!token && member.type) {
              const type = checker.getTypeAtLocation(member);
              const symbol = type.getSymbol() || type.aliasSymbol;
              if (symbol) {
                token = symbol.getName();
              }
            }
            if (token) {
              deps[propName] = token;
            }
          }
        }
      }
    }
  }
  return deps;
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

          let isInject = false;
          let injectToken = '';
          if (decs) {
            for (const dec of decs) {
              const e = dec.expression;
              const ident = ts.isCallExpression(e) ? e.expression : e;
              if (ts.isIdentifier(ident) && ident.text === 'Inject') {
                isInject = true;
                if (ts.isCallExpression(e) && e.arguments.length > 0) {
                  const arg = e.arguments[0];
                  if (ts.isStringLiteral(arg)) injectToken = arg.text;
                  else if (ts.isIdentifier(arg)) injectToken = arg.text;
                  else injectToken = arg.getText();
                }
                break;
              }
            }
          }

          if (isInject && !injectToken && p.type) {
            const type = checker.getTypeAtLocation(p);
            const symbol = type.getSymbol() || type.aliasSymbol;
            if (symbol) {
              injectToken = symbol.getName();
            }
          } else if (!isInject && p.type) {
            const type = checker.getTypeAtLocation(p);
            const symbol = type.getSymbol() || type.aliasSymbol;
            if (symbol) {
              const typeName = symbol.getName();
              if (registry.providers.has(typeName)) {
                isInject = true;
                injectToken = typeName;
              }
            }
          }

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

          if (!dName && isInject) {
            dName = 'Inject';
            pName = injectToken || 'any';
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
              let params: any[] = [];
              if (map === registry.guards) {
                const useMethod = decl.members.find(m => ts.isMethodDeclaration(m) && m.name.getText() === 'use') as ts.MethodDeclaration;
                if (useMethod) {
                  params = resolveParamsMetadata(useMethod.parameters);
                }
              }
              map.set(name, { path: decl.getSourceFile().fileName, params });
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

      const collectClassMetadata = (classDecl: ts.ClassDeclaration) => {
        const sourceFile = classDecl.getSourceFile();
        let corsConfigs: any[] = [];
        let securityConfigs: any[] = [];
        let guards: any[] = [];
        let interceptors: string[] = [];

        const type = checker.getTypeAtLocation(classDecl);
        const baseTypes = type.getBaseTypes();
        if (baseTypes) {
          for (const baseType of baseTypes) {
            const symbol = baseType.getSymbol() || baseType.aliasSymbol;
            const baseDecl = symbol?.valueDeclaration || symbol?.declarations?.[0];
            if (baseDecl && ts.isClassDeclaration(baseDecl)) {
              const parentMeta = collectClassMetadata(baseDecl);
              corsConfigs.push(...parentMeta.corsConfigs);
              securityConfigs.push(...parentMeta.securityConfigs);
              guards.push(...parentMeta.guards);
              interceptors.push(...parentMeta.interceptors);
            }
          }
        }

        const decorators = ts.getDecorators(classDecl);
        
        const directCors = extractCorsConfig(decorators, sourceFile);
        if (directCors !== undefined) {
          corsConfigs.push(directCors);
        }

        const directSecurity = extractSecurityConfig(decorators, sourceFile);
        if (directSecurity !== undefined) {
          securityConfigs.push(directSecurity);
        }

        const directGuards: any[] = [];
        let guardDec: ts.Decorator | null = null;
        if (decorators) {
          for (const d of decorators) {
            if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === 'Protect') {
              guardDec = d;
              break;
            }
          }
        }
        if (guardDec && ts.isCallExpression(guardDec.expression)) {
          for (const arg of guardDec.expression.arguments) {
            const g = resolveGuardMetadata(arg, classDecl);
            if (g) directGuards.push(g);
          }
        }
        guards.push(...directGuards);

        const directInterceptors: string[] = [];
        let interceptDec: ts.Decorator | null = null;
        if (decorators) {
          for (const d of decorators) {
            if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === 'Intercept') {
              interceptDec = d;
              break;
            }
          }
        }
        if (interceptDec && ts.isCallExpression(interceptDec.expression)) {
          for (const arg of interceptDec.expression.arguments) {
            const i = resolveClassRef(arg, registry.interceptors);
            if (i) directInterceptors.push(i);
          }
        }
        interceptors.push(...directInterceptors);

        return {
          corsConfigs,
          securityConfigs,
          guards,
          interceptors
        };
      };

      for (const statement of sourceFile.statements) {
        if (ts.isClassDeclaration(statement)) {
          const decorators = ts.getDecorators(statement);
          let controllerDec: ts.Decorator | null = null;
          if (decorators) for (const d of decorators) if (ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Controller') { controllerDec = d; break; }

          let injectableDec: ts.Decorator | null = null;
          if (decorators) {
            for (const d of decorators) {
              const ident = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
              if (ts.isIdentifier(ident) && ident.text === 'Injectable') {
                injectableDec = d;
                break;
              }
            }
          }

          if (injectableDec && statement.name) {
            const providerName = statement.name.text;
            if (!registry.providers.has(providerName)) {
              registry.providers.set(providerName, { path: sourceFile.fileName });
            }
          }

          if (controllerDec) {
            const controllerName = statement.name?.text || 'Anonymous';
            if (!registry.controllers.has(controllerName)) registry.controllers.set(controllerName, { path: sourceFile.fileName, injections: new Map() });

            const prefix = (controllerDec.expression as ts.CallExpression).arguments[0] as ts.StringLiteral;

            let classPublic = false;
            if (decorators) for (const d of decorators) if (d.expression.getText().includes('Public')) { classPublic = true; break; }

            const classMeta = collectClassMetadata(statement);

            // Merge CorsConfigs hierarchically (parent -> child)
            let classCors: any = undefined;
            if (classMeta.corsConfigs.length > 0) {
              classCors = {};
              for (const c of classMeta.corsConfigs) {
                if (typeof c === 'object') {
                  classCors = { ...classCors, ...c };
                } else {
                  classCors = c;
                }
              }
            }

            // Merge SecurityConfigs hierarchically (parent -> child)
            let classSecurity: any = undefined;
            if (classMeta.securityConfigs.length > 0) {
              classSecurity = {};
              for (const s of classMeta.securityConfigs) {
                if (typeof s === 'object') {
                  classSecurity = { ...classSecurity, ...s };
                } else {
                  classSecurity = s;
                }
              }
            }

            const classGuards = classMeta.guards;
            const classInterceptors = classMeta.interceptors;

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

                  const methodCors = extractCorsConfig(mDecs, sourceFile);
                  const activeCors = methodCors !== undefined ? methodCors : classCors;

                  const methodSecurity = extractSecurityConfig(mDecs, sourceFile);
                  const activeSecurity = methodSecurity !== undefined ? methodSecurity : classSecurity;

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

                  const endpoint: any = {
                    controller: controllerName, methodName: member.name.getText(), httpMethod: method.toUpperCase(), path: fullPath,
                    params: paramsMetadata, guards: activeGuards, interceptors: activeInterceptors, meta: {}
                  };
                  if (activeCors !== undefined) {
                    endpoint.cors = activeCors;
                  }
                  if (activeSecurity !== undefined) {
                    endpoint.security = activeSecurity;
                  }
                  registry.endpoints.push(endpoint);
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

      if (context && typeof context.factory !== 'undefined') {
        const visit = (node: ts.Node): ts.Node => {
          if (ts.isClassDeclaration(node)) {
            const className = node.name?.text || 'Anonymous';
            const isController = registry.controllers.has(className);
            const isProvider = registry.providers.has(className);
            const isModule = registry.modules.has(className);
            const isGuard = registry.guards.has(className);
            const isInterceptor = registry.interceptors.has(className);

            const decorators = ts.getDecorators(node);
            let hasInjectableDec = false;
            let hasControllerDec = false;
            let hasModuleDec = false;
            if (decorators) {
              for (const d of decorators) {
                const text = d.expression.getText();
                if (text.includes('Injectable')) hasInjectableDec = true;
                if (text.includes('Controller')) hasControllerDec = true;
                if (text.includes('Module')) hasModuleDec = true;
              }
            }

            if (isController || isProvider || isModule || isGuard || isInterceptor || hasInjectableDec || hasControllerDec || hasModuleDec) {
              const constructorDeps = findConstructorDeps(node, checker) || [];
              const propertyDeps = resolvePropertyDeps(node, checker) || {};

              const injectionsObj = ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  'constructorDeps',
                  ts.factory.createArrayLiteralExpression(
                    constructorDeps.map(dep => ts.factory.createStringLiteral(dep))
                  )
                ),
                ts.factory.createPropertyAssignment(
                  'propertyDeps',
                  ts.factory.createObjectLiteralExpression(
                    Object.entries(propertyDeps).map(([propName, depToken]) =>
                      ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier(propName),
                        ts.factory.createStringLiteral(depToken)
                      )
                    ),
                    true
                  )
                )
              ], true);

              const injectionsProperty = ts.factory.createPropertyDeclaration(
                [
                  ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)
                ],
                ts.factory.createIdentifier('__injections__'),
                undefined,
                undefined,
                injectionsObj
              );

              return ts.factory.updateClassDeclaration(
                node,
                node.modifiers,
                node.name,
                node.typeParameters,
                node.heritageClauses,
                ts.factory.createNodeArray([injectionsProperty, ...node.members])
              );
            }
          }
          return ts.visitEachChild(node, visit, context);
        };

        return ts.visitNode(sourceFile, visit) as ts.SourceFile;
      }

      return sourceFile;
    };
  };
}

export function generateManifestCode(registry: ProjectRegistry, controllerMap: Map<string, string>, manifestPath: string): string {
  const manifestDir = path.dirname(manifestPath);
  const finalControllerMap = controllerMap.size > 0 ? controllerMap : new Map(Array.from(registry.controllers.entries()).map(([k, v]) => [k, v.path]));

  const customImports = new Map<string, Set<string>>();
  const cleanedUtils = new Set<string>();
  
  for (const util of registry.requiredUtils) {
    if (util.startsWith('custom:')) {
      const parts = util.split(':');
      const fnName = parts[1];
      const filePath = parts.slice(2).join(':');
      if (!customImports.has(filePath)) {
        customImports.set(filePath, new Set());
      }
      customImports.get(filePath)!.add(fnName);
    } else {
      cleanedUtils.add(util);
    }
  }

  let imports = `import { MetadataStore } from '@webergency-utils/server';\n`;
  if (cleanedUtils.size > 0) {
    imports += `import { validators } from '@webergency-utils/typechecker';\n`;
  }

  for (const [fullPath, fnNames] of customImports.entries()) {
    let rel = path.relative(manifestDir, fullPath).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.') && !rel.startsWith('/')) {
      rel = './' + rel;
    }
    const names = Array.from(fnNames).join(', ');
    imports += `import { ${names} } from '${rel}';\n`;
  }

  let logic = `\n// --- SINGLETONS ---\n`;
  const importedAndRegistered = new Set<string>();

  // Collect Guards
  for (const [name, info] of registry.guards.entries()) {
    if (importedAndRegistered.has(name)) continue;
    let rel = path.relative(manifestDir, info.path).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.') && !rel.startsWith('/')) {
      rel = './' + rel;
    }
    imports += `import { ${name} } from '${rel}';\n`;
    logic += `MetadataStore.registerGuard('${name}', ${name});\n`;
    importedAndRegistered.add(name);
  }

  // Collect Interceptors
  for (const [name, info] of registry.interceptors.entries()) {
    if (importedAndRegistered.has(name)) continue;
    let rel = path.relative(manifestDir, info.path).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.') && !rel.startsWith('/')) {
      rel = './' + rel;
    }
    imports += `import { ${name} } from '${rel}';\n`;
    logic += `MetadataStore.registerInterceptor('${name}', ${name});\n`;
    importedAndRegistered.add(name);
  }

  // Collect Controllers
  for (const [name, fullPath] of finalControllerMap.entries()) {
    if (importedAndRegistered.has(name)) continue;
    let rel = path.relative(manifestDir, fullPath).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.') && !rel.startsWith('/')) {
      rel = './' + rel;
    }
    imports += `import { ${name} } from '${rel}';\n`;
    logic += `MetadataStore.registerController('${name}', ${name});\n`;
    importedAndRegistered.add(name);
  }

  // Collect Providers
  for (const [name, info] of registry.providers.entries()) {
    if (importedAndRegistered.has(name)) continue;
    let rel = path.relative(manifestDir, info.path).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.') && !rel.startsWith('/')) {
      rel = './' + rel;
    }
    imports += `import { ${name} } from '${rel}';\n`;
    logic += `MetadataStore.registerProvider('${name}', ${name});\n`;
    importedAndRegistered.add(name);
  }

  // Collect Modules
  for (const [name, info] of registry.modules.entries()) {
    if (importedAndRegistered.has(name)) continue;
    let rel = path.relative(manifestDir, info.path).replace(/\.ts$/, '.js');
    if (!rel.startsWith('.') && !rel.startsWith('/')) {
      rel = './' + rel;
    }
    imports += `import { ${name} } from '${rel}';\n`;
    logic += `MetadataStore.registerModule('${name}', ${name});\n`;
    importedAndRegistered.add(name);
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

    // Replace __raw_code__ placeholders before cleaning up quotes
    epJson = epJson.replace(/\{\s*"__raw_code__":\s*"([^"]+)"\s*\}/g, (match, rawCode) => {
      try {
        return JSON.parse('"' + rawCode + '"');
      } catch (e) {
        return rawCode;
      }
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
    if (typeof obj.__raw_code__ === 'string') {
      const tempSourceFile = ts.createSourceFile('temp_ast.ts', `(${obj.__raw_code__})`, ts.ScriptTarget.Latest, true);
      const statement = tempSourceFile.statements[0];
      if (statement && ts.isExpressionStatement(statement)) {
        return statement.expression;
      }
      return ts.factory.createIdentifier(obj.__raw_code__);
    }
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
      // 1. Check if the file has any class with a @Controller or @Injectable decorator
      let shouldProcess = false;
      const checkNode = (node: ts.Node) => {
        if (ts.isClassDeclaration(node)) {
          const decorators = ts.getDecorators(node);
          if (decorators) {
            for (const d of decorators) {
              const text = d.expression.getText();
              if (text.includes('Controller') || text.includes('Injectable') || text.includes('Module')) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (!shouldProcess) {
          ts.forEachChild(node, checkNode);
        }
      };
      checkNode(sourceFile);

      if (!shouldProcess) {
        return sourceFile;
      }

      // 2. Run our standard analysis transformer on this file to collect all endpoints and validators
      const registry = createRegistry();
      const runTransform = transformer(program, registry)(context);
      const transformedSourceFile = runTransform(sourceFile);

      // 3. Generate and append the self-registration nodes
      const registrations: ts.Statement[] = [];

      const prepends: ts.Statement[] = [];
      const appends: ts.Statement[] = [];

      // Initialize __server_metadata_store locally from globalThis to ensure 100% ESM & CommonJS compatibility
      // with zero module alias/symbol binding dependencies.
      prepends.push(
        ts.factory.createVariableStatement(
          undefined,
          ts.factory.createVariableDeclarationList([
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier('__server_metadata_store'),
              undefined,
              undefined,
              ts.factory.createBinaryExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('globalThis'),
                  '__WEBERGENCY_SERVER_METADATA_STORE__'
                ),
                ts.SyntaxKind.BarBarToken,
                ts.factory.createParenthesizedExpression(
                  ts.factory.createBinaryExpression(
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createIdentifier('globalThis'),
                      '__WEBERGENCY_SERVER_METADATA_STORE__'
                    ),
                    ts.SyntaxKind.EqualsToken,
                    ts.factory.createObjectLiteralExpression([
                      ts.factory.createPropertyAssignment('endpoints', ts.factory.createArrayLiteralExpression([])),
                      ts.factory.createPropertyAssignment('controllers', ts.factory.createNewExpression(ts.factory.createIdentifier('Map'), undefined, [])),
                      ts.factory.createPropertyAssignment('guards', ts.factory.createNewExpression(ts.factory.createIdentifier('Map'), undefined, [])),
                      ts.factory.createPropertyAssignment('interceptors', ts.factory.createNewExpression(ts.factory.createIdentifier('Map'), undefined, [])),
                      ts.factory.createPropertyAssignment('providers', ts.factory.createNewExpression(ts.factory.createIdentifier('Map'), undefined, [])),
                      ts.factory.createPropertyAssignment('modules', ts.factory.createNewExpression(ts.factory.createIdentifier('Map'), undefined, [])),
                      ts.factory.createPropertyAssignment('instances', ts.factory.createNewExpression(ts.factory.createIdentifier('Map'), undefined, [])),
                      ts.factory.createPropertyAssignment('resolving', ts.factory.createNewExpression(ts.factory.createIdentifier('Set'), undefined, [])),
                      ts.factory.createPropertyAssignment('controllerClasses', ts.factory.createNewExpression(ts.factory.createIdentifier('Set'), undefined, [])),
                      ts.factory.createPropertyAssignment('guardClasses', ts.factory.createNewExpression(ts.factory.createIdentifier('Set'), undefined, [])),
                      ts.factory.createPropertyAssignment('interceptorClasses', ts.factory.createNewExpression(ts.factory.createIdentifier('Set'), undefined, []))
                    ], true)
                  )
                )
              )
            )
          ], ts.NodeFlags.Const)
        )
      );

      // Import typechecker runtime side-effects if we have validators
      if (registry.validators.size > 0) {
        prepends.push(
          ts.factory.createImportDeclaration(
            undefined,
            undefined,
            ts.factory.createStringLiteral('@webergency-utils/typechecker/runtime'),
            undefined
          )
        );

        if (!hasVariableDeclaration(transformedSourceFile.statements, 'validators') &&
            !hasVariableDeclaration(prepends, 'validators')) {
          prepends.push(
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
            !hasVariableDeclaration(prepends, `__val_${hash}`)) {
          prepends.push(
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
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'providers'
                ),
                'set'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createIdentifier(name)
              ]
            )
          )
        );
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'guardClasses'
                ),
                'add'
              ),
              undefined,
              [ts.factory.createStringLiteral(name)]
            )
          )
        );
      }

      // Register Interceptors
      for (const name of registry.interceptors.keys()) {
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'providers'
                ),
                'set'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createIdentifier(name)
              ]
            )
          )
        );
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'interceptorClasses'
                ),
                'add'
              ),
              undefined,
              [ts.factory.createStringLiteral(name)]
            )
          )
        );
      }

      // Register Endpoints
      for (const ep of registry.endpoints) {
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'endpoints'
                ),
                'push'
              ),
              undefined,
              [objectToExpression(ep)]
            )
          )
        );
      }

      // Register Controllers
      for (const name of registry.controllers.keys()) {
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'providers'
                ),
                'set'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createIdentifier(name)
              ]
            )
          )
        );
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'controllerClasses'
                ),
                'add'
              ),
              undefined,
              [ts.factory.createStringLiteral(name)]
            )
          )
        );
      }

      // Register Providers
      for (const name of registry.providers.keys()) {
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'providers'
                ),
                'set'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createIdentifier(name)
              ]
            )
          )
        );
      }

      // Register Modules
      for (const name of registry.modules.keys()) {
        appends.push(
          ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier('__server_metadata_store'),
                  'modules'
                ),
                'set'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(name),
                ts.factory.createIdentifier(name)
              ]
            )
          )
        );
      }


      const mergedStatements = [...prepends, ...transformedSourceFile.statements];
      const insertIndex = findInsertionIndex(mergedStatements);

      const finalStatements = [
        ...mergedStatements.slice(0, insertIndex),
        ...appends,
        ...mergedStatements.slice(insertIndex)
      ];

      return ts.factory.updateSourceFile(transformedSourceFile, finalStatements);

    };
  };
}


function findInsertionIndex(statements: readonly ts.Statement[]): number {
  let lastClassIndex = -1;
  for (let i = 0; i < statements.length; i++) {
    if (ts.isClassDeclaration(statements[i])) {
      lastClassIndex = i;
    }
  }

  const startIndex = lastClassIndex !== -1 ? lastClassIndex + 1 : 0;

  for (let i = startIndex; i < statements.length; i++) {
    const s = statements[i];

    if (ts.isImportDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) {
      continue;
    }

    if (ts.isVariableStatement(s)) {
      let isPrependedVar = true;
      for (const decl of s.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const text = decl.name.text;
          if (text !== 'validators' && text !== 'MetadataStore' && text !== '__server_metadata_store' && !text.startsWith('__val_')) {
            isPrependedVar = false;
            break;
          }
        } else {
          isPrependedVar = false;
          break;
        }
      }
      if (isPrependedVar) {
        continue;
      }
    }

    return i;
  }
  return statements.length;
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


