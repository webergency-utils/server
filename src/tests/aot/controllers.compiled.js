var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
const __server_metadata_store = globalThis.__WEBERGENCY_SERVER_METADATA_STORE__ || (globalThis.__WEBERGENCY_SERVER_METADATA_STORE__ = {
    endpoints: [],
    controllers: new Map(),
    guards: new Map(),
    interceptors: new Map(),
    providers: new Map(),
    modules: new Map(),
    instances: new Map(),
    resolving: new Set(),
    controllerClasses: new Set(),
    guardClasses: new Set(),
    interceptorClasses: new Set()
});
import "@webergency-utils/typechecker/runtime";
const validators = globalThis.__WEBERGENCY_TYPECHECKER_VALIDATORS__;
const __val_473287f8298dba71 = validators.string;
const __val_12886f9d00055adf = validators.number;
const __val_04c78f82f98a8cf4 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["name", "age"], "User"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["name", "age"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["age", false, __val_12886f9d00055adf]
    ]);
    return data;
};
const __val_6d1570e5b8d6d45a = (v, path, ctx) => validators.literal(v, path, ctx, "simple");
const __val_2258654cc0f69d37 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["type", "val"], "{ type: \"simple\"; val: string; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["type", "val"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["type", false, __val_6d1570e5b8d6d45a],
        ["val", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_68056e96638382b6 = (v, path, ctx) => validators.literal(v, path, ctx, "complex");
const __val_e5da2f9fabafe20e = (v, path, ctx) => validators.array(v, path, ctx, __val_473287f8298dba71);
const __val_b421a9236dfde58e = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["id", "tags"], "{ id: number; tags: string[]; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["id", "tags"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};
const __val_5c5ed695091ba342 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["type", "data"], "{ type: \"complex\"; data: { id: number; tags: string[]; }; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["type", "data"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["type", false, __val_68056e96638382b6],
        ["data", false, __val_b421a9236dfde58e]
    ]);
    return data;
};
const __val_a41824426b6b1ede = (v, path, ctx) => validators.union(v, path, ctx, [__val_2258654cc0f69d37, __val_5c5ed695091ba342]);
const __val_55e3fcb8d722f805 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["reason"], "{ reason: string; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["reason"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["reason", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_2d1db52869bf4329 = (v, path, ctx) => validators.literal(v, path, ctx, "active");
const __val_88e643147651d549 = (v, path, ctx) => validators.literal(v, path, ctx, "inactive");
const __val_857204a536cb022c = (v, path, ctx) => validators.union(v, path, ctx, [__val_55e3fcb8d722f805, __val_2d1db52869bf4329, __val_88e643147651d549]);
const __val_affb28566d707e35 = (v, path, ctx) => validators.union(v, path, ctx, [__val_473287f8298dba71, __val_12886f9d00055adf]);
const __val_8c1c1b2d325f9de6 = (v, path, ctx) => validators.array(v, path, ctx, __val_affb28566d707e35);
const __val_eb045d78d2731073 = validators.undefined;
const __val_ca383f8818520f0b = (v, path, ctx) => validators.union(v, path, ctx, [__val_eb045d78d2731073, __val_04c78f82f98a8cf4]);
const __val_68aecd6fa646cade = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["id", "user", "tags"], "Nested"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["id", "user", "tags"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["user", true, __val_ca383f8818520f0b],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};
const __val_1ecb4c157494e4eb = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["a"], "{ a: string; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["a"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["a", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_5a59b4127f6bdb93 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["b"], "{ b: number; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["b"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["b", false, __val_12886f9d00055adf]
    ]);
    return data;
};
const __val_f28f8acf7e68cbfd = (v, path, ctx) => {
    const checks = [__val_1ecb4c157494e4eb, __val_5a59b4127f6bdb93];
    let data = ctx.mode === "strip" ? (typeof v === "object" && v !== null && !Array.isArray(v) ? {} : v) : v;
    for (let i = 0; i < checks.length; i++) {
        const val = checks[i](v, path, ctx);
        if (ctx.mode === "strip" && typeof val === "object" && val !== null)
            Object.assign(data, val);
    }
    return data;
};
const __val_85a41b63d9a32b8b = (v, path, ctx) => validators.union(v, path, ctx, [__val_2d1db52869bf4329, __val_88e643147651d549]);
const __val_d31fde334b3f24e2 = (v, path, ctx) => validators.literal(v, path, ctx, false);
const __val_561da1284502fef1 = (v, path, ctx) => validators.literal(v, path, ctx, true);
const __val_ced862ef1505bc73 = (v, path, ctx) => validators.union(v, path, ctx, [__val_d31fde334b3f24e2, __val_561da1284502fef1]);
const __val_1b07349e25c26601 = validators.date;
const __val_925fde611c826103 = validators.regexp;
const __val_75d012fe28656e0a = validators.bigint;
const __val_91d782a2d0de1354 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["name", "active"], "{ name: string; active: boolean; }"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["name", "active"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["active", false, __val_ced862ef1505bc73]
    ]);
    return data;
};
const __val_9a141e74a6c02429 = (v, path, ctx) => validators.templateLiteral(v, path, ctx, new RegExp("^id-[0-9]+(\\.[0-9]+)?$"), "`id-${number}`");
const __val_1ec226ab681d53d9 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.minLength(v, path, ctx, 8);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_37c14191d7986595 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.minimum(v, path, ctx, 18);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_68c5a02a527ab0fc = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.custom(v, path, ctx, isEvenNumber);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_e07351f5c6fe82e2 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["val"], "CustomUser"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["val"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["val", false, __val_68c5a02a527ab0fc]
    ]);
    return data;
};
const __val_6e9d6dc4e79aca25 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.exclusiveMinimum(v, path, ctx, 10);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_3f5a160666ebabc6 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.exclusiveMaximum(v, path, ctx, 20);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_ef10024629c72e9e = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.multipleOf(v, path, ctx, 5);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_56d21ddd31fd7b13 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.format(v, path, ctx, "email");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_f1148b0341282e7b = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.format(v, path, ctx, "uuid");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_dbeae6ee7b504b21 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.format(v, path, ctx, "date");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_6140e60a8304d25a = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = __val_e5da2f9fabafe20e(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.minItems(v, path, ctx, 2);
        validators.maxItems(v, path, ctx, 3);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_3bf071592f56335a = (v, path, ctx) => validators.array(v, path, ctx, __val_12886f9d00055adf);
const __val_8eb9a2d0e4390fe9 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = __val_3bf071592f56335a(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        validators.uniqueItems(v, path, ctx);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_ccb10958b6aa7739 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["a", "b"], "SumPayload"))
        return v;
    let data = v;
    if (ctx.mode === "strip") {
        let hasAdditional = false;
        const keys = Object.keys(v);
        const allowed = ["a", "b"];
        if (keys.length > allowed.length) {
            hasAdditional = true;
        }
        else {
            for (let i = 0; i < keys.length; i++) {
                if (!allowed.includes(keys[i])) {
                    hasAdditional = true;
                    break;
                }
            }
        }
        if (hasAdditional)
            data = {};
    }
    validators.props(v, data, path, ctx, [
        ["a", false, __val_12886f9d00055adf],
        ["b", false, __val_12886f9d00055adf]
    ]);
    return data;
};
import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Ws, Sse, Param, MessagePattern, EventPattern, Payload, Head, All } from '../../index.js';
export const isEvenNumber = (val) => val % 2 === 0;
let TypeSafetyController = class TypeSafetyController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    strict(data) {
        return { success: true, data };
    }
    strictIntercepted(data) {
        return { success: true, data };
    }
    strip(data) {
        return { success: true, data };
    }
    relaxed(data) {
        return { success: true, data };
    }
    union(data) {
        return { success: true, data };
    }
    status(s) {
        return { success: true, s };
    }
    mixedArray(data) {
        return { success: true, data };
    }
    nested(data) {
        return { success: true, data };
    }
    intersection(data) {
        return { success: true, data };
    }
    queryUnion(status) {
        return { success: true, status };
    }
    arrayQuery(tags) {
        return { success: true, tags };
    }
    coerce(age, active, date, pattern, big) {
        return { success: true, age, active, date: date.toISOString(), pattern: pattern.toString(), big: big.toString() };
    }
    deepBoolean(user) {
        return { success: true, user };
    }
    coerceUnion(val) {
        return { success: true, val, type: typeof val };
    }
    templateLiteral(id) {
        return { success: true, id };
    }
    tags(pass, age) {
        return { success: true, pass, age };
    }
    customValidator(data) {
        return { success: true, data };
    }
    headExplicit() {
        // void return
    }
    getFallback() {
        return { message: 'hello from get fallback' };
    }
    allVerbs() {
        return { message: 'hello from all verbs' };
    }
};
__decorate([
    Post('/strict'),
    __param(0, Body('strict'))
], TypeSafetyController.prototype, "strict", null);
__decorate([
    Post('/strict-intercepted'),
    Intercept('GlobalErrorSanitizer'),
    __param(0, Body('strict'))
], TypeSafetyController.prototype, "strictIntercepted", null);
__decorate([
    Post('/strip'),
    __param(0, Body('strip'))
], TypeSafetyController.prototype, "strip", null);
__decorate([
    Post('/relaxed'),
    __param(0, Body('relaxed'))
], TypeSafetyController.prototype, "relaxed", null);
__decorate([
    Post('/union'),
    __param(0, Body('strip'))
], TypeSafetyController.prototype, "union", null);
__decorate([
    Get('/status'),
    __param(0, Query('s', 'strip'))
], TypeSafetyController.prototype, "status", null);
__decorate([
    Post('/mixed-array'),
    __param(0, Body('strip'))
], TypeSafetyController.prototype, "mixedArray", null);
__decorate([
    Post('/nested'),
    __param(0, Body('strip'))
], TypeSafetyController.prototype, "nested", null);
__decorate([
    Post('/intersection'),
    __param(0, Body('strip'))
], TypeSafetyController.prototype, "intersection", null);
__decorate([
    Get('/query-union'),
    __param(0, Query('status'))
], TypeSafetyController.prototype, "queryUnion", null);
__decorate([
    Get('/array-query'),
    __param(0, Query('tags', 'strip'))
], TypeSafetyController.prototype, "arrayQuery", null);
__decorate([
    Get('/coerce'),
    __param(0, Query('age')),
    __param(1, Query('active')),
    __param(2, Query('date')),
    __param(3, Query('pattern')),
    __param(4, Query('big'))
], TypeSafetyController.prototype, "coerce", null);
__decorate([
    Get('/deep-boolean'),
    __param(0, Query('user'))
], TypeSafetyController.prototype, "deepBoolean", null);
__decorate([
    Get('/coerce-union'),
    __param(0, Query('val'))
], TypeSafetyController.prototype, "coerceUnion", null);
__decorate([
    Get('/template-literal'),
    __param(0, Query('id'))
], TypeSafetyController.prototype, "templateLiteral", null);
__decorate([
    Get('/tags'),
    __param(0, Query('pass')),
    __param(1, Query('age'))
], TypeSafetyController.prototype, "tags", null);
__decorate([
    Post('/custom-validator'),
    __param(0, Body('strip'))
], TypeSafetyController.prototype, "customValidator", null);
__decorate([
    Head('/head-explicit')
], TypeSafetyController.prototype, "headExplicit", null);
__decorate([
    Get('/get-fallback')
], TypeSafetyController.prototype, "getFallback", null);
__decorate([
    All('/all-verbs')
], TypeSafetyController.prototype, "allVerbs", null);
TypeSafetyController = __decorate([
    Controller('/type-safety')
], TypeSafetyController);
export { TypeSafetyController };
let TagParityController = class TagParityController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    getNumber(min, max, mult) {
        return { min, max, mult };
    }
    getString(email, uuid, date) {
        return { email, uuid, date };
    }
    postArray(items) {
        return items;
    }
    postUniqueArray(items) {
        return items;
    }
};
__decorate([
    Get('/number'),
    __param(0, Query('min')),
    __param(1, Query('max')),
    __param(2, Query('mult'))
], TagParityController.prototype, "getNumber", null);
__decorate([
    Get('/string'),
    __param(0, Query('email')),
    __param(1, Query('uuid')),
    __param(2, Query('date'))
], TagParityController.prototype, "getString", null);
__decorate([
    Post('/array'),
    __param(0, Body())
], TagParityController.prototype, "postArray", null);
__decorate([
    Post('/unique-array'),
    __param(0, Body())
], TagParityController.prototype, "postUniqueArray", null);
TagParityController = __decorate([
    Controller('/tag-parity')
], TagParityController);
export { TagParityController };
let SecureController = class SecureController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    getDefault() {
        return 'ok';
    }
    getOverride() {
        return 'ok';
    }
};
__decorate([
    Get('/default')
], SecureController.prototype, "getDefault", null);
__decorate([
    Get('/override'),
    Security({ frameguard: false })
], SecureController.prototype, "getOverride", null);
SecureController = __decorate([
    Controller('/secure-controller'),
    Security({ frameguard: 'deny' })
], SecureController);
export { SecureController };
let BaseController = class BaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
};
BaseController = __decorate([
    Controller(),
    Security({ frameguard: 'deny', timeout: 500 })
], BaseController);
export { BaseController };
let InheritedController = class InheritedController extends BaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    getTest() {
        return 'ok';
    }
    getOverride() {
        return 'ok';
    }
};
__decorate([
    Get('/test')
], InheritedController.prototype, "getTest", null);
__decorate([
    Get('/override'),
    Security({ frameguard: false })
], InheritedController.prototype, "getOverride", null);
InheritedController = __decorate([
    Controller('/inherited')
], InheritedController);
export { InheritedController };
// --- Dependency Injection (DI) Tests ---
let ConfigService = class ConfigService {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    get(key) {
        if (key === 'db.url')
            return 'mongodb://localhost:27017';
        if (key === 'api.secret')
            return 'super-secret-key';
        return '';
    }
};
ConfigService = __decorate([
    Injectable()
], ConfigService);
export { ConfigService };
let DatabaseService = class DatabaseService {
    configService;
    static __injections__ = {
        constructorDeps: ["ConfigService"],
        propertyDeps: {}
    };
    constructor(configService) {
        this.configService = configService;
    }
    getUrl() {
        return this.configService.get('db.url');
    }
};
DatabaseService = __decorate([
    Injectable()
], DatabaseService);
export { DatabaseService };
let LoggerService = class LoggerService {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    log(msg) {
        return `[LOG] ${msg}`;
    }
};
LoggerService = __decorate([
    Injectable()
], LoggerService);
export { LoggerService };
let BaseService = class BaseService {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {
            logger: "LoggerService"
        }
    };
    logger;
};
__decorate([
    Inject(LoggerService)
], BaseService.prototype, "logger", void 0);
BaseService = __decorate([
    Injectable()
], BaseService);
export { BaseService };
let ChildService = class ChildService extends BaseService {
    dbService;
    static __injections__ = {
        constructorDeps: ["DatabaseService"],
        propertyDeps: {}
    };
    constructor(dbService) {
        super();
        this.dbService = dbService;
    }
    getMessage() {
        return this.logger.log(`DB URL is ${this.dbService.getUrl()}`);
    }
};
ChildService = __decorate([
    Injectable()
], ChildService);
export { ChildService };
let DiGuard = class DiGuard {
    configService;
    static __injections__ = {
        constructorDeps: ["ConfigService"],
        propertyDeps: {
            logger: "LoggerService"
        }
    };
    logger;
    constructor(configService) {
        this.configService = configService;
    }
    use(db) {
        const url = db.getUrl();
        if (url !== 'mongodb://localhost:27017') {
            throw { code: 403, message: 'Forbidden by Guard' };
        }
        this.logger.log(`Guard checked URL: ${url}`);
    }
};
__decorate([
    Inject(LoggerService)
], DiGuard.prototype, "logger", void 0);
__decorate([
    __param(0, Inject(DatabaseService))
], DiGuard.prototype, "use", null);
DiGuard = __decorate([
    Injectable()
], DiGuard);
export { DiGuard };
let DiTestController = class DiTestController {
    childService;
    configService;
    static __injections__ = {
        constructorDeps: ["ChildService", "ConfigService"],
        propertyDeps: {
            logger: "LoggerService"
        }
    };
    logger;
    constructor(childService, configService) {
        this.childService = childService;
        this.configService = configService;
    }
    test() {
        return {
            msg: this.childService.getMessage(),
            dbUrl: this.configService.get('db.url'),
            logged: this.logger.log('hello')
        };
    }
    paramInject(db) {
        return { dbUrl: db.getUrl() };
    }
    guarded() {
        return { success: true };
    }
};
__decorate([
    Inject(LoggerService)
], DiTestController.prototype, "logger", void 0);
__decorate([
    Get('/test')
], DiTestController.prototype, "test", null);
__decorate([
    Get('/param-inject'),
    __param(0, Inject(DatabaseService))
], DiTestController.prototype, "paramInject", null);
__decorate([
    Get('/guarded'),
    Protect(DiGuard)
], DiTestController.prototype, "guarded", null);
DiTestController = __decorate([
    Controller('/di')
], DiTestController);
export { DiTestController };
let RealtimeController = class RealtimeController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    handleWs(ws) {
        ws.on('message', (msg) => {
            ws.send(`Echo: ${msg}`);
        });
    }
    handleWsParams(ws, room, token) {
        ws.send(`Room: ${room}, Token: ${token}`);
        ws.on('message', (msg) => {
            ws.send(msg);
        });
    }
    handleWsLimited(ws) {
        ws.on('message', (msg) => {
            ws.send(msg);
        });
    }
    handleWsHeartbeat(ws) {
        // Heartbeat verification endpoint
    }
    async *handleSse() {
        yield { event: 'update', data: { val: 1 } };
        yield { event: 'update', data: { val: 2 } };
    }
};
__decorate([
    Ws('/ws')
], RealtimeController.prototype, "handleWs", null);
__decorate([
    Ws('/ws-params/:room'),
    __param(1, Param('room')),
    __param(2, Query('token'))
], RealtimeController.prototype, "handleWsParams", null);
__decorate([
    Ws('/ws-limited', { maxPayload: 10 })
], RealtimeController.prototype, "handleWsLimited", null);
__decorate([
    Ws('/ws-heartbeat', { pingInterval: 100, pingTimeout: 50 })
], RealtimeController.prototype, "handleWsHeartbeat", null);
__decorate([
    Sse('/sse')
], RealtimeController.prototype, "handleSse", null);
RealtimeController = __decorate([
    Controller('/realtime')
], RealtimeController);
export { RealtimeController };
let MathMicroserviceController = class MathMicroserviceController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    sum(data) {
        return data.a + data.b;
    }
    greet(name) {
        return `Hello, ${name}!`;
    }
    notify(msg) {
        // Event listener
    }
};
__decorate([
    MessagePattern('math.sum'),
    __param(0, Payload())
], MathMicroserviceController.prototype, "sum", null);
__decorate([
    MessagePattern('math.greet'),
    __param(0, Payload())
], MathMicroserviceController.prototype, "greet", null);
__decorate([
    EventPattern('logs.notify'),
    __param(0, Payload())
], MathMicroserviceController.prototype, "notify", null);
MathMicroserviceController = __decorate([
    Controller()
], MathMicroserviceController);
export { MathMicroserviceController };
__server_metadata_store.providers.set("DiGuard", DiGuard);
__server_metadata_store.guardClasses.add("DiGuard");
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "strict",
    httpMethod: "POST",
    path: "/type-safety/strict",
    params: [{
            source: "Body",
            name: "",
            validator: __val_04c78f82f98a8cf4,
            mode: "strict"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "strictIntercepted",
    httpMethod: "POST",
    path: "/type-safety/strict-intercepted",
    params: [{
            source: "Body",
            name: "",
            validator: __val_04c78f82f98a8cf4,
            mode: "strict"
        }],
    guards: [],
    interceptors: ["GlobalErrorSanitizer"],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "strip",
    httpMethod: "POST",
    path: "/type-safety/strip",
    params: [{
            source: "Body",
            name: "",
            validator: __val_04c78f82f98a8cf4,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "relaxed",
    httpMethod: "POST",
    path: "/type-safety/relaxed",
    params: [{
            source: "Body",
            name: "",
            validator: __val_04c78f82f98a8cf4,
            mode: "relaxed"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "union",
    httpMethod: "POST",
    path: "/type-safety/union",
    params: [{
            source: "Body",
            name: "",
            validator: __val_a41824426b6b1ede,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "status",
    httpMethod: "GET",
    path: "/type-safety/status",
    params: [{
            source: "Query",
            name: "s",
            validator: __val_857204a536cb022c,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "mixedArray",
    httpMethod: "POST",
    path: "/type-safety/mixed-array",
    params: [{
            source: "Body",
            name: "",
            validator: __val_8c1c1b2d325f9de6,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "nested",
    httpMethod: "POST",
    path: "/type-safety/nested",
    params: [{
            source: "Body",
            name: "",
            validator: __val_68aecd6fa646cade,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "intersection",
    httpMethod: "POST",
    path: "/type-safety/intersection",
    params: [{
            source: "Body",
            name: "",
            validator: __val_f28f8acf7e68cbfd,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "queryUnion",
    httpMethod: "GET",
    path: "/type-safety/query-union",
    params: [{
            source: "Query",
            name: "status",
            validator: __val_85a41b63d9a32b8b,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "arrayQuery",
    httpMethod: "GET",
    path: "/type-safety/array-query",
    params: [{
            source: "Query",
            name: "tags",
            validator: __val_e5da2f9fabafe20e,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "coerce",
    httpMethod: "GET",
    path: "/type-safety/coerce",
    params: [{
            source: "Query",
            name: "age",
            validator: __val_12886f9d00055adf,
            mode: undefined
        }, {
            source: "Query",
            name: "active",
            validator: __val_ced862ef1505bc73,
            mode: undefined
        }, {
            source: "Query",
            name: "date",
            validator: __val_1b07349e25c26601,
            mode: undefined
        }, {
            source: "Query",
            name: "pattern",
            validator: __val_925fde611c826103,
            mode: undefined
        }, {
            source: "Query",
            name: "big",
            validator: __val_75d012fe28656e0a,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "deepBoolean",
    httpMethod: "GET",
    path: "/type-safety/deep-boolean",
    params: [{
            source: "Query",
            name: "user",
            validator: __val_91d782a2d0de1354,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "coerceUnion",
    httpMethod: "GET",
    path: "/type-safety/coerce-union",
    params: [{
            source: "Query",
            name: "val",
            validator: __val_affb28566d707e35,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "templateLiteral",
    httpMethod: "GET",
    path: "/type-safety/template-literal",
    params: [{
            source: "Query",
            name: "id",
            validator: __val_9a141e74a6c02429,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "tags",
    httpMethod: "GET",
    path: "/type-safety/tags",
    params: [{
            source: "Query",
            name: "pass",
            validator: __val_1ec226ab681d53d9,
            mode: undefined
        }, {
            source: "Query",
            name: "age",
            validator: __val_37c14191d7986595,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "customValidator",
    httpMethod: "POST",
    path: "/type-safety/custom-validator",
    params: [{
            source: "Body",
            name: "",
            validator: __val_e07351f5c6fe82e2,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "headExplicit",
    httpMethod: "HEAD",
    path: "/type-safety/head-explicit",
    params: [],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "getFallback",
    httpMethod: "GET",
    path: "/type-safety/get-fallback",
    params: [],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "allVerbs",
    httpMethod: "ALL",
    path: "/type-safety/all-verbs",
    params: [],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "getNumber",
    httpMethod: "GET",
    path: "/tag-parity/number",
    params: [{
            source: "Query",
            name: "min",
            validator: __val_6e9d6dc4e79aca25,
            mode: undefined
        }, {
            source: "Query",
            name: "max",
            validator: __val_3f5a160666ebabc6,
            mode: undefined
        }, {
            source: "Query",
            name: "mult",
            validator: __val_ef10024629c72e9e,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "getString",
    httpMethod: "GET",
    path: "/tag-parity/string",
    params: [{
            source: "Query",
            name: "email",
            validator: __val_56d21ddd31fd7b13,
            mode: undefined
        }, {
            source: "Query",
            name: "uuid",
            validator: __val_f1148b0341282e7b,
            mode: undefined
        }, {
            source: "Query",
            name: "date",
            validator: __val_dbeae6ee7b504b21,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "postArray",
    httpMethod: "POST",
    path: "/tag-parity/array",
    params: [{
            source: "Body",
            name: "",
            validator: __val_6140e60a8304d25a,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "postUniqueArray",
    httpMethod: "POST",
    path: "/tag-parity/unique-array",
    params: [{
            source: "Body",
            name: "",
            validator: __val_8eb9a2d0e4390fe9,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "SecureController",
    methodName: "getDefault",
    httpMethod: "GET",
    path: "/secure-controller/default",
    params: [],
    guards: [],
    interceptors: [],
    meta: {},
    security: {
        frameguard: "deny"
    }
});
__server_metadata_store.endpoints.push({
    controller: "SecureController",
    methodName: "getOverride",
    httpMethod: "GET",
    path: "/secure-controller/override",
    params: [],
    guards: [],
    interceptors: [],
    meta: {},
    security: {
        frameguard: false
    }
});
__server_metadata_store.endpoints.push({
    controller: "InheritedController",
    methodName: "getTest",
    httpMethod: "GET",
    path: "/inherited/test",
    params: [],
    guards: [],
    interceptors: [],
    meta: {},
    security: {
        frameguard: "deny",
        timeout: 500
    }
});
__server_metadata_store.endpoints.push({
    controller: "InheritedController",
    methodName: "getOverride",
    httpMethod: "GET",
    path: "/inherited/override",
    params: [],
    guards: [],
    interceptors: [],
    meta: {},
    security: {
        frameguard: false
    }
});
__server_metadata_store.endpoints.push({
    controller: "DiTestController",
    methodName: "test",
    httpMethod: "GET",
    path: "/di/test",
    params: [],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "DiTestController",
    methodName: "paramInject",
    httpMethod: "GET",
    path: "/di/param-inject",
    params: [{
            source: "Inject",
            name: "DatabaseService",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "DiTestController",
    methodName: "guarded",
    httpMethod: "GET",
    path: "/di/guarded",
    params: [],
    guards: [{
            type: "class",
            name: "DiGuard",
            resolvers: [],
            params: [{
                    source: "Inject",
                    name: "DatabaseService",
                    validator: "",
                    mode: undefined
                }],
            isAsync: false
        }],
    interceptors: [],
    meta: {}
});
__server_metadata_store.endpoints.push({
    controller: "RealtimeController",
    methodName: "handleWs",
    httpMethod: "WS",
    path: "/realtime/ws",
    params: [{
            source: "WebSocket",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        ws: true
    }
});
__server_metadata_store.endpoints.push({
    controller: "RealtimeController",
    methodName: "handleWsParams",
    httpMethod: "WS",
    path: "/realtime/ws-params/:room",
    params: [{
            source: "WebSocket",
            name: "",
            validator: "",
            mode: undefined
        }, {
            source: "Param",
            name: "room",
            validator: __val_473287f8298dba71,
            mode: undefined
        }, {
            source: "Query",
            name: "token",
            validator: __val_473287f8298dba71,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        ws: true
    }
});
__server_metadata_store.endpoints.push({
    controller: "RealtimeController",
    methodName: "handleWsLimited",
    httpMethod: "WS",
    path: "/realtime/ws-limited",
    params: [{
            source: "WebSocket",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        ws: true,
        wsOptions: {
            maxPayload: 10
        }
    }
});
__server_metadata_store.endpoints.push({
    controller: "RealtimeController",
    methodName: "handleWsHeartbeat",
    httpMethod: "WS",
    path: "/realtime/ws-heartbeat",
    params: [{
            source: "WebSocket",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        ws: true,
        wsOptions: {
            pingInterval: 100,
            pingTimeout: 50
        }
    }
});
__server_metadata_store.endpoints.push({
    controller: "RealtimeController",
    methodName: "handleSse",
    httpMethod: "GET",
    path: "/realtime/sse",
    params: [],
    guards: [],
    interceptors: [],
    meta: {
        sse: true
    }
});
__server_metadata_store.endpoints.push({
    controller: "MathMicroserviceController",
    methodName: "sum",
    httpMethod: "RPC",
    path: "math.sum",
    params: [{
            source: "Body",
            name: "",
            validator: __val_ccb10958b6aa7739,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        rpc: true
    }
});
__server_metadata_store.endpoints.push({
    controller: "MathMicroserviceController",
    methodName: "greet",
    httpMethod: "RPC",
    path: "math.greet",
    params: [{
            source: "Body",
            name: "",
            validator: __val_473287f8298dba71,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        rpc: true
    }
});
__server_metadata_store.endpoints.push({
    controller: "MathMicroserviceController",
    methodName: "notify",
    httpMethod: "RPC",
    path: "logs.notify",
    params: [{
            source: "Body",
            name: "",
            validator: __val_473287f8298dba71,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    meta: {
        rpc: true,
        event: true
    }
});
__server_metadata_store.providers.set("TypeSafetyController", TypeSafetyController);
__server_metadata_store.controllerClasses.add("TypeSafetyController");
__server_metadata_store.providers.set("TagParityController", TagParityController);
__server_metadata_store.controllerClasses.add("TagParityController");
__server_metadata_store.providers.set("SecureController", SecureController);
__server_metadata_store.controllerClasses.add("SecureController");
__server_metadata_store.providers.set("BaseController", BaseController);
__server_metadata_store.controllerClasses.add("BaseController");
__server_metadata_store.providers.set("InheritedController", InheritedController);
__server_metadata_store.controllerClasses.add("InheritedController");
__server_metadata_store.providers.set("DiTestController", DiTestController);
__server_metadata_store.controllerClasses.add("DiTestController");
__server_metadata_store.providers.set("RealtimeController", RealtimeController);
__server_metadata_store.controllerClasses.add("RealtimeController");
__server_metadata_store.providers.set("MathMicroserviceController", MathMicroserviceController);
__server_metadata_store.controllerClasses.add("MathMicroserviceController");
__server_metadata_store.providers.set("ConfigService", ConfigService);
__server_metadata_store.providers.set("DatabaseService", DatabaseService);
__server_metadata_store.providers.set("LoggerService", LoggerService);
__server_metadata_store.providers.set("BaseService", BaseService);
__server_metadata_store.providers.set("ChildService", ChildService);
__server_metadata_store.providers.set("DiGuard", DiGuard);
