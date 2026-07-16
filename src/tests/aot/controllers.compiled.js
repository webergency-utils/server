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
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["age", false, __val_12886f9d00055adf]
    ]);
    return data;
};
const __val_d31fde334b3f24e2 = (v, path, ctx) => validators.literal(v, path, ctx, false);
const __val_561da1284502fef1 = (v, path, ctx) => validators.literal(v, path, ctx, true);
const __val_ced862ef1505bc73 = (v, path, ctx) => validators.union(v, path, ctx, [__val_d31fde334b3f24e2, __val_561da1284502fef1], "Type<boolean>");
const __val_c67915707769fcf5 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: User; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_04c78f82f98a8cf4]
    ]);
    return data;
};
const __val_6d1570e5b8d6d45a = (v, path, ctx) => validators.literal(v, path, ctx, "simple");
const __val_2258654cc0f69d37 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["type", "val"], "{ type: \"simple\"; val: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
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
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};
const __val_5c5ed695091ba342 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["type", "data"], "{ type: \"complex\"; data: { id: number; tags: string[]; }; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["type", false, __val_68056e96638382b6],
        ["data", false, __val_b421a9236dfde58e]
    ]);
    return data;
};
const __val_a41824426b6b1ede = (v, path, ctx) => validators.union(v, path, ctx, [__val_2258654cc0f69d37, __val_5c5ed695091ba342], "Type<MyUnion>");
const __val_d74cefa44e345d17 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: MyUnion; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_a41824426b6b1ede]
    ]);
    return data;
};
const __val_55e3fcb8d722f805 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["reason"], "{ reason: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["reason", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_2d1db52869bf4329 = (v, path, ctx) => validators.literal(v, path, ctx, "active");
const __val_88e643147651d549 = (v, path, ctx) => validators.literal(v, path, ctx, "inactive");
const __val_857204a536cb022c = (v, path, ctx) => validators.union(v, path, ctx, [__val_55e3fcb8d722f805, __val_2d1db52869bf4329, __val_88e643147651d549], "Type<Status>");
const __val_2d6ea820a293bacf = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "s"], "{ success: boolean; s: Status; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["s", false, __val_857204a536cb022c]
    ]);
    return data;
};
const __val_affb28566d707e35 = (v, path, ctx) => validators.union(v, path, ctx, [__val_473287f8298dba71, __val_12886f9d00055adf], "Type<string|number>");
const __val_8c1c1b2d325f9de6 = (v, path, ctx) => validators.array(v, path, ctx, __val_affb28566d707e35);
const __val_a042f9877fc2376a = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: MixedArray; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_8c1c1b2d325f9de6]
    ]);
    return data;
};
const __val_eb045d78d2731073 = validators.undefined;
const __val_ca383f8818520f0b = (v, path, ctx) => validators.union(v, path, ctx, [__val_eb045d78d2731073, __val_04c78f82f98a8cf4], "Type<User|undefined>");
const __val_68aecd6fa646cade = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["id", "user", "tags"], "Nested"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["user", true, __val_ca383f8818520f0b],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};
const __val_f0ac6e3a29009cf1 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: Nested; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_68aecd6fa646cade]
    ]);
    return data;
};
const __val_1ecb4c157494e4eb = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["a"], "{ a: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["a", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_5a59b4127f6bdb93 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["b"], "{ b: number; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
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
const __val_0d157d33684c0018 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: Intersection; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_f28f8acf7e68cbfd]
    ]);
    return data;
};
const __val_85a41b63d9a32b8b = (v, path, ctx) => validators.union(v, path, ctx, [__val_2d1db52869bf4329, __val_88e643147651d549], "Type<\"active\"|\"inactive\">");
const __val_0084393b0d7248e4 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "status"], "{ success: boolean; status: \"active\" | \"inactive\"; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["status", false, __val_85a41b63d9a32b8b]
    ]);
    return data;
};
const __val_d9bb28ea073c815e = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "tags"], "{ success: boolean; tags: string[]; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};
const __val_52806c84462812de = validators.date;
const __val_b6e780bc51fff07e = validators.regexp;
const __val_75d012fe28656e0a = validators.bigint;
const __val_dfd1002a464a1dbf = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "age", "active", "date", "pattern", "big"], "{ success: boolean; age: number; active: boolean; date: string; pattern: string; big: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["age", false, __val_12886f9d00055adf],
        ["active", false, __val_ced862ef1505bc73],
        ["date", false, __val_473287f8298dba71],
        ["pattern", false, __val_473287f8298dba71],
        ["big", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_91d782a2d0de1354 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["name", "active"], "{ name: string; active: boolean; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["active", false, __val_ced862ef1505bc73]
    ]);
    return data;
};
const __val_d979aa00a685cb05 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "user"], "{ success: boolean; user: { name: string; active: boolean; }; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["user", false, __val_91d782a2d0de1354]
    ]);
    return data;
};
const __val_32873a7f224f38d8 = (v, path, ctx) => validators.literal(v, path, ctx, "string");
const __val_628f6ca4b78e6b50 = (v, path, ctx) => validators.literal(v, path, ctx, "number");
const __val_46a7c6afe9b432e6 = (v, path, ctx) => validators.literal(v, path, ctx, "bigint");
const __val_1207c37d006fe9f8 = (v, path, ctx) => validators.literal(v, path, ctx, "boolean");
const __val_046317c2cffaf10d = (v, path, ctx) => validators.literal(v, path, ctx, "symbol");
const __val_df6b16b0e625bf20 = (v, path, ctx) => validators.literal(v, path, ctx, "undefined");
const __val_e64d77191bc932bb = (v, path, ctx) => validators.literal(v, path, ctx, "object");
const __val_9120d5d091aa5bf3 = (v, path, ctx) => validators.literal(v, path, ctx, "function");
const __val_1e1a258db2184d0e = (v, path, ctx) => validators.union(v, path, ctx, [__val_32873a7f224f38d8, __val_628f6ca4b78e6b50, __val_46a7c6afe9b432e6, __val_1207c37d006fe9f8, __val_046317c2cffaf10d, __val_df6b16b0e625bf20, __val_e64d77191bc932bb, __val_9120d5d091aa5bf3], "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">");
const __val_87e266a791052d41 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "val", "type"], "{ success: boolean; val: string | number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["val", false, __val_affb28566d707e35],
        ["type", false, __val_1e1a258db2184d0e]
    ]);
    return data;
};
const __val_9a141e74a6c02429 = (v, path, ctx) => validators.templateLiteral(v, path, ctx, new RegExp("^id-[0-9]+(\\.[0-9]+)?$"), "`id-${number}`");
const __val_6b50e5736cb6bb55 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "id"], "{ success: boolean; id: `id-${number}`; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["id", false, __val_9a141e74a6c02429]
    ]);
    return data;
};
const __val_0caecfe8699f25b8 = (v, path, ctx) => {
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
const __val_1571502a4cf29710 = (v, path, ctx) => {
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
const __val_00069fea01d8de1c = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "pass", "age"], "{ success: boolean; pass: string & MinLength<8, string>; age: number & Minimum<18, string>; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["pass", false, __val_0caecfe8699f25b8],
        ["age", false, __val_1571502a4cf29710]
    ]);
    return data;
};
const __val_deea648a08085b8a = (v, path, ctx) => {
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
const __val_bfe717a7435044d9 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["val"], "CustomUser"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["val", false, __val_deea648a08085b8a]
    ]);
    return data;
};
const __val_6fb78ae896df3d55 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: CustomUser; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_bfe717a7435044d9]
    ]);
    return data;
};
const __val_b237870e8da1ad64 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["message"], "{ message: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["message", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_f5cefde6f4184d0a = (v, path, ctx) => {
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
const __val_8a71b293078b363b = (v, path, ctx) => {
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
const __val_c5049313b5648c12 = (v, path, ctx) => {
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
const __val_3e8eb7c863774273 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["min", "max", "mult"], "{ min: number & ExclusiveMinimum<10, string>; max: number & ExclusiveMaximum<20, string>; mult: number & MultipleOf<5, string>; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["min", false, __val_f5cefde6f4184d0a],
        ["max", false, __val_8a71b293078b363b],
        ["mult", false, __val_c5049313b5648c12]
    ]);
    return data;
};
const __val_6fa566a829e910e4 = (v, path, ctx) => {
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
const __val_f1fa4c95a2fd1510 = (v, path, ctx) => {
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
const __val_40fff573e6b6d78e = (v, path, ctx) => {
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
const __val_7ce81cd8a307e08c = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["email", "uuid", "date"], "{ email: string & Format<\"email\", string>; uuid: string & Format<\"uuid\", string>; date: string & Format<\"date\", string>; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["email", false, __val_6fa566a829e910e4],
        ["uuid", false, __val_f1fa4c95a2fd1510],
        ["date", false, __val_40fff573e6b6d78e]
    ]);
    return data;
};
const __val_7d7a88865ea2e56a = (v, path, ctx) => {
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
const __val_5a6f5d9e825bc197 = (v, path, ctx) => {
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
const __val_d6749fa8772de8dd = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["msg", "dbUrl", "logged"], "{ msg: string; dbUrl: string; logged: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["msg", false, __val_473287f8298dba71],
        ["dbUrl", false, __val_473287f8298dba71],
        ["logged", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_ab68d46bd18d4a0a = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["dbUrl"], "{ dbUrl: string; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["dbUrl", false, __val_473287f8298dba71]
    ]);
    return data;
};
const __val_e955dd67e417e2f5 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["success"], "{ success: boolean; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73]
    ]);
    return data;
};
const __val_ccb10958b6aa7739 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["a", "b"], "SumPayload"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["a", false, __val_12886f9d00055adf],
        ["b", false, __val_12886f9d00055adf]
    ]);
    return data;
};
const __val_74234e98afe7498f = validators.null;
const __val_6bd4d7da4d0dd205 = (v, path, ctx) => validators.union(v, path, ctx, [__val_74234e98afe7498f, __val_473287f8298dba71], "Type<string|null>");
const __val_8ee319793d943d85 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["one", "two"], "{ one: string | null; two: string | null; }"))
        return v;
    const data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["one", false, __val_6bd4d7da4d0dd205],
        ["two", false, __val_6bd4d7da4d0dd205]
    ]);
    return data;
};
import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Ws, Sse, Param, MessagePattern, EventPattern, Payload, Head, All, ResponseMode, Unprotect, Unintercept, Use, OverrideUse, Unuse, Public } from '../../index.js';
export const isEvenNumber = (val) => val % 2 === 0;
export class GlobalErrorSanitizer {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    async intercept(req, next) {
        const response = await next();
        if (response.status === 400) {
            const clone = response.clone();
            try {
                const data = await clone.json();
                if (data.success === false && data.errors) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Internal Server Error'
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
            catch (e) { }
        }
        return response;
    }
}
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
    Intercept(GlobalErrorSanitizer),
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
        if (key === 'db.url') {
            return 'mongodb://localhost:27017';
        }
        if (key === 'api.secret') {
            return 'super-secret-key';
        }
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
    guardedWithParams() {
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
__decorate([
    Get('/guarded-with-params'),
    Protect(DiGuard, 'admin', 123)
], DiTestController.prototype, "guardedWithParams", null);
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
let ReturnTypeController = class ReturnTypeController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    getExact() {
        return { name: 'Alice', age: 25 };
    }
    getStrip() {
        return { name: 'Bob', age: 30, extraField: 'should-be-stripped' };
    }
    getInvalid() {
        return { name: 'Charlie', age: 'thirty' };
    }
    getInferredBranch(branch) {
        if (branch === 'a') {
            return { name: 'Jack', age: 50 };
        }
        else {
            return { name: 'Jill', age: 60 };
        }
    }
    rpcExact() {
        return { name: 'Dave', age: 40 };
    }
    rpcStrip() {
        return { name: 'Eve', age: 45, secret: 'ignore-me' };
    }
    rpcInvalid() {
        return { name: 'Frank' };
    }
};
__decorate([
    Get('/exact')
], ReturnTypeController.prototype, "getExact", null);
__decorate([
    Get('/strip')
], ReturnTypeController.prototype, "getStrip", null);
__decorate([
    Get('/invalid')
], ReturnTypeController.prototype, "getInvalid", null);
__decorate([
    Get('/inferred-branch'),
    __param(0, Query('branch'))
], ReturnTypeController.prototype, "getInferredBranch", null);
__decorate([
    MessagePattern('rpc.exact')
], ReturnTypeController.prototype, "rpcExact", null);
__decorate([
    MessagePattern('rpc.strip')
], ReturnTypeController.prototype, "rpcStrip", null);
__decorate([
    MessagePattern('rpc.invalid')
], ReturnTypeController.prototype, "rpcInvalid", null);
ReturnTypeController = __decorate([
    Controller('/return-type')
], ReturnTypeController);
export { ReturnTypeController };
let StrictResponseController = class StrictResponseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    fail() {
        return { name: 'Strict', age: 10, extra: 'not-allowed' };
    }
    overrideRelaxed() {
        return { name: 'RelaxedOverride', age: 20, extra: 'kept' };
    }
};
__decorate([
    Get('/fail')
], StrictResponseController.prototype, "fail", null);
__decorate([
    Get('/override-relaxed'),
    ResponseMode('relaxed')
], StrictResponseController.prototype, "overrideRelaxed", null);
StrictResponseController = __decorate([
    Controller('/response-mode-strict'),
    ResponseMode('strict')
], StrictResponseController);
export { StrictResponseController };
let BaseRelaxedController = class BaseRelaxedController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
};
BaseRelaxedController = __decorate([
    Controller(),
    ResponseMode('relaxed')
], BaseRelaxedController);
export { BaseRelaxedController };
let InheritedResponseController = class InheritedResponseController extends BaseRelaxedController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    inheritedRelaxed() {
        return { name: 'InheritedRelaxed', age: 30, extra: 'inherited-kept' };
    }
    overrideStrict() {
        return { name: 'StrictOverride', age: 40, extra: 'fail' };
    }
};
__decorate([
    Get('/inherited-relaxed')
], InheritedResponseController.prototype, "inheritedRelaxed", null);
__decorate([
    Get('/override-strict'),
    ResponseMode('strict')
], InheritedResponseController.prototype, "overrideStrict", null);
InheritedResponseController = __decorate([
    Controller('/response-mode-inherited')
], InheritedResponseController);
export { InheritedResponseController };
let SimpleGuard = class SimpleGuard {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    use() {
        return true;
    }
};
SimpleGuard = __decorate([
    Injectable()
], SimpleGuard);
export { SimpleGuard };
let AnotherGuard = class AnotherGuard {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    use() {
        return true;
    }
};
AnotherGuard = __decorate([
    Injectable()
], AnotherGuard);
export { AnotherGuard };
let UnprotectedBaseController = class UnprotectedBaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
};
UnprotectedBaseController = __decorate([
    Controller('/unprotected-class-base'),
    Protect(SimpleGuard),
    Protect(AnotherGuard)
], UnprotectedBaseController);
export { UnprotectedBaseController };
let UnprotectedClassController = class UnprotectedClassController extends UnprotectedBaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test')
], UnprotectedClassController.prototype, "test", null);
UnprotectedClassController = __decorate([
    Controller('/unprotected-class'),
    Unprotect(SimpleGuard)
], UnprotectedClassController);
export { UnprotectedClassController };
let UnprotectedClassAllController = class UnprotectedClassAllController extends UnprotectedBaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test')
], UnprotectedClassAllController.prototype, "test", null);
UnprotectedClassAllController = __decorate([
    Controller('/unprotected-class-all'),
    Unprotect
], UnprotectedClassAllController);
export { UnprotectedClassAllController };
let UnprotectedMethodController = class UnprotectedMethodController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    getOne() {
        return 'ok';
    }
    getAll() {
        return 'ok';
    }
};
__decorate([
    Get('/one'),
    Unprotect(SimpleGuard)
], UnprotectedMethodController.prototype, "getOne", null);
__decorate([
    Get('/all'),
    Unprotect
], UnprotectedMethodController.prototype, "getAll", null);
UnprotectedMethodController = __decorate([
    Controller('/unprotected-method'),
    Protect(SimpleGuard),
    Protect(AnotherGuard)
], UnprotectedMethodController);
export { UnprotectedMethodController };
export class SimpleInterceptor {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    intercept(req, next) { return next(); }
}
export class AnotherInterceptor {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    intercept(req, next) { return next(); }
}
let UninterceptedBaseController = class UninterceptedBaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
};
UninterceptedBaseController = __decorate([
    Controller('/unintercepted-class-base'),
    Intercept(SimpleInterceptor),
    Intercept(AnotherInterceptor)
], UninterceptedBaseController);
export { UninterceptedBaseController };
let UninterceptedClassController = class UninterceptedClassController extends UninterceptedBaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test')
], UninterceptedClassController.prototype, "test", null);
UninterceptedClassController = __decorate([
    Controller('/unintercepted-class'),
    Unintercept(SimpleInterceptor)
], UninterceptedClassController);
export { UninterceptedClassController };
let UninterceptedClassAllController = class UninterceptedClassAllController extends UninterceptedBaseController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test')
], UninterceptedClassAllController.prototype, "test", null);
UninterceptedClassAllController = __decorate([
    Controller('/unintercepted-class-all'),
    Unintercept
], UninterceptedClassAllController);
export { UninterceptedClassAllController };
let UninterceptedMethodController = class UninterceptedMethodController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    getOne() {
        return 'ok';
    }
    getAll() {
        return 'ok';
    }
};
__decorate([
    Get('/one'),
    Unintercept(SimpleInterceptor)
], UninterceptedMethodController.prototype, "getOne", null);
__decorate([
    Get('/all'),
    Unintercept
], UninterceptedMethodController.prototype, "getAll", null);
UninterceptedMethodController = __decorate([
    Controller('/unintercepted-method'),
    Intercept(SimpleInterceptor),
    Intercept(AnotherInterceptor)
], UninterceptedMethodController);
export { UninterceptedMethodController };
// --- Middleware Integration Tests ---
let SimpleTestMiddleware = class SimpleTestMiddleware {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    use(req, res) {
        req.headers.set('x-middleware-one', 'active');
        res.headers.set('x-middleware-res-one', 'response-active');
    }
};
SimpleTestMiddleware = __decorate([
    Injectable()
], SimpleTestMiddleware);
export { SimpleTestMiddleware };
let CallbackTestMiddleware = class CallbackTestMiddleware {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    async useCallback(req, res, next) {
        req.headers.set('x-middleware-two', 'callback-active');
        res.headers.set('x-middleware-res-two', 'response-callback-active');
        await next();
    }
};
CallbackTestMiddleware = __decorate([
    Injectable()
], CallbackTestMiddleware);
export { CallbackTestMiddleware };
let MiddlewareCheckingGuard = class MiddlewareCheckingGuard {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    use(req) {
        const one = req.headers.get('x-middleware-one');
        if (!one) {
            throw { status: 403, message: 'Middleware did not run before Guard' };
        }
    }
};
MiddlewareCheckingGuard = __decorate([
    Injectable()
], MiddlewareCheckingGuard);
export { MiddlewareCheckingGuard };
let MiddlewareTestController = class MiddlewareTestController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    both(req) {
        return {
            one: req.headers.get('x-middleware-one'),
            two: req.headers.get('x-middleware-two')
        };
    }
    override(req) {
        return {
            one: req.headers.get('x-middleware-one'),
            two: req.headers.get('x-middleware-two')
        };
    }
};
__decorate([
    Get('/both'),
    Protect(MiddlewareCheckingGuard)
], MiddlewareTestController.prototype, "both", null);
__decorate([
    Get('/override'),
    OverrideUse(SimpleTestMiddleware)
], MiddlewareTestController.prototype, "override", null);
MiddlewareTestController = __decorate([
    Controller('/middleware-test'),
    Use(SimpleTestMiddleware, CallbackTestMiddleware)
], MiddlewareTestController);
export { MiddlewareTestController };
let MiddlewareUnmiddlewareController = class MiddlewareUnmiddlewareController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    removeOne(req) {
        return {
            one: req.headers.get('x-middleware-one'),
            two: req.headers.get('x-middleware-two')
        };
    }
    removeAll(req) {
        return {
            one: req.headers.get('x-middleware-one'),
            two: req.headers.get('x-middleware-two')
        };
    }
};
__decorate([
    Get('/remove-one'),
    Unuse(SimpleTestMiddleware)
], MiddlewareUnmiddlewareController.prototype, "removeOne", null);
__decorate([
    Get('/remove-all'),
    Unuse
], MiddlewareUnmiddlewareController.prototype, "removeAll", null);
MiddlewareUnmiddlewareController = __decorate([
    Controller('/middleware-unmiddleware'),
    Use(SimpleTestMiddleware, CallbackTestMiddleware)
], MiddlewareUnmiddlewareController);
export { MiddlewareUnmiddlewareController };
let FailingGuard = class FailingGuard {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    use() {
        throw { status: 403, message: 'Guard Failed' };
    }
};
FailingGuard = __decorate([
    Injectable()
], FailingGuard);
export { FailingGuard };
export class CountingInterceptor {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    static callCount = 0;
    async intercept(req, next) {
        CountingInterceptor.callCount++;
        return next();
    }
}
let GuardInterceptorOrderController = class GuardInterceptorOrderController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test'),
    Protect(FailingGuard),
    Intercept(CountingInterceptor)
], GuardInterceptorOrderController.prototype, "test", null);
GuardInterceptorOrderController = __decorate([
    Controller('/guard-interceptor-order')
], GuardInterceptorOrderController);
export { GuardInterceptorOrderController };
let PublicDenyGuard = class PublicDenyGuard {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    use() {
        throw { status: 403, message: 'Denied by PublicDenyGuard' };
    }
};
PublicDenyGuard = __decorate([
    Injectable()
], PublicDenyGuard);
export { PublicDenyGuard };
let ClassPublicController = class ClassPublicController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test'),
    Protect(PublicDenyGuard)
], ClassPublicController.prototype, "test", null);
ClassPublicController = __decorate([
    Controller('/class-public'),
    Public,
    Protect(PublicDenyGuard)
], ClassPublicController);
export { ClassPublicController };
let MethodPublicController = class MethodPublicController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    test() {
        return 'ok';
    }
};
__decorate([
    Get('/test'),
    Public
], MethodPublicController.prototype, "test", null);
MethodPublicController = __decorate([
    Controller('/method-public'),
    Protect(PublicDenyGuard)
], MethodPublicController);
export { MethodPublicController };
__server_metadata_store.providers.set("DiGuard", DiGuard);
__server_metadata_store.guardClasses.add("DiGuard");
__server_metadata_store.providers.set("SimpleGuard", SimpleGuard);
__server_metadata_store.guardClasses.add("SimpleGuard");
__server_metadata_store.providers.set("AnotherGuard", AnotherGuard);
__server_metadata_store.guardClasses.add("AnotherGuard");
__server_metadata_store.providers.set("MiddlewareCheckingGuard", MiddlewareCheckingGuard);
__server_metadata_store.guardClasses.add("MiddlewareCheckingGuard");
__server_metadata_store.providers.set("FailingGuard", FailingGuard);
__server_metadata_store.guardClasses.add("FailingGuard");
__server_metadata_store.providers.set("PublicDenyGuard", PublicDenyGuard);
__server_metadata_store.guardClasses.add("PublicDenyGuard");
__server_metadata_store.providers.set("GlobalErrorSanitizer", GlobalErrorSanitizer);
__server_metadata_store.interceptorClasses.add("GlobalErrorSanitizer");
__server_metadata_store.providers.set("SimpleInterceptor", SimpleInterceptor);
__server_metadata_store.interceptorClasses.add("SimpleInterceptor");
__server_metadata_store.providers.set("AnotherInterceptor", AnotherInterceptor);
__server_metadata_store.interceptorClasses.add("AnotherInterceptor");
__server_metadata_store.providers.set("CountingInterceptor", CountingInterceptor);
__server_metadata_store.interceptorClasses.add("CountingInterceptor");
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_c67915707769fcf5
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_c67915707769fcf5
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_c67915707769fcf5
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_c67915707769fcf5
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_d74cefa44e345d17
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_2d6ea820a293bacf
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_a042f9877fc2376a
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_f0ac6e3a29009cf1
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_0d157d33684c0018
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_0084393b0d7248e4
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_d9bb28ea073c815e
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
            validator: __val_52806c84462812de,
            mode: undefined
        }, {
            source: "Query",
            name: "pattern",
            validator: __val_b6e780bc51fff07e,
            mode: undefined
        }, {
            source: "Query",
            name: "big",
            validator: __val_75d012fe28656e0a,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_dfd1002a464a1dbf
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_d979aa00a685cb05
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_87e266a791052d41
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_6b50e5736cb6bb55
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "tags",
    httpMethod: "GET",
    path: "/type-safety/tags",
    params: [{
            source: "Query",
            name: "pass",
            validator: __val_0caecfe8699f25b8,
            mode: undefined
        }, {
            source: "Query",
            name: "age",
            validator: __val_1571502a4cf29710,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_00069fea01d8de1c
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "customValidator",
    httpMethod: "POST",
    path: "/type-safety/custom-validator",
    params: [{
            source: "Body",
            name: "",
            validator: __val_bfe717a7435044d9,
            mode: "strip"
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_6fb78ae896df3d55
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "headExplicit",
    httpMethod: "HEAD",
    path: "/type-safety/head-explicit",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_b237870e8da1ad64
});
__server_metadata_store.endpoints.push({
    controller: "TypeSafetyController",
    methodName: "allVerbs",
    httpMethod: "ALL",
    path: "/type-safety/all-verbs",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_b237870e8da1ad64
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "getNumber",
    httpMethod: "GET",
    path: "/tag-parity/number",
    params: [{
            source: "Query",
            name: "min",
            validator: __val_f5cefde6f4184d0a,
            mode: undefined
        }, {
            source: "Query",
            name: "max",
            validator: __val_8a71b293078b363b,
            mode: undefined
        }, {
            source: "Query",
            name: "mult",
            validator: __val_c5049313b5648c12,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_3e8eb7c863774273
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "getString",
    httpMethod: "GET",
    path: "/tag-parity/string",
    params: [{
            source: "Query",
            name: "email",
            validator: __val_6fa566a829e910e4,
            mode: undefined
        }, {
            source: "Query",
            name: "uuid",
            validator: __val_f1fa4c95a2fd1510,
            mode: undefined
        }, {
            source: "Query",
            name: "date",
            validator: __val_40fff573e6b6d78e,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_7ce81cd8a307e08c
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "postArray",
    httpMethod: "POST",
    path: "/tag-parity/array",
    params: [{
            source: "Body",
            name: "",
            validator: __val_7d7a88865ea2e56a,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_7d7a88865ea2e56a
});
__server_metadata_store.endpoints.push({
    controller: "TagParityController",
    methodName: "postUniqueArray",
    httpMethod: "POST",
    path: "/tag-parity/unique-array",
    params: [{
            source: "Body",
            name: "",
            validator: __val_5a6f5d9e825bc197,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_5a6f5d9e825bc197
});
__server_metadata_store.endpoints.push({
    controller: "SecureController",
    methodName: "getDefault",
    httpMethod: "GET",
    path: "/secure-controller/default",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71,
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71,
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71,
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71,
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_d6749fa8772de8dd
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_ab68d46bd18d4a0a
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
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_e955dd67e417e2f5
});
__server_metadata_store.endpoints.push({
    controller: "DiTestController",
    methodName: "guardedWithParams",
    httpMethod: "GET",
    path: "/di/guarded-with-params",
    params: [],
    guards: [{
            type: "class",
            name: "DiGuard",
            resolvers: ["admin", 123],
            params: [{
                    source: "Inject",
                    name: "DatabaseService",
                    validator: "",
                    mode: undefined
                }],
            isAsync: false
        }],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_e955dd67e417e2f5
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
    middlewares: [],
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
    middlewares: [],
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
    middlewares: [],
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
    middlewares: [],
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
    middlewares: [],
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
    middlewares: [],
    meta: {
        rpc: true
    },
    returnTypeValidator: __val_12886f9d00055adf
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
    middlewares: [],
    meta: {
        rpc: true
    },
    returnTypeValidator: __val_473287f8298dba71
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
    middlewares: [],
    meta: {
        rpc: true,
        event: true
    }
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "getExact",
    httpMethod: "GET",
    path: "/return-type/exact",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "getStrip",
    httpMethod: "GET",
    path: "/return-type/strip",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "getInvalid",
    httpMethod: "GET",
    path: "/return-type/invalid",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "getInferredBranch",
    httpMethod: "GET",
    path: "/return-type/inferred-branch",
    params: [{
            source: "Query",
            name: "branch",
            validator: __val_473287f8298dba71,
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "rpcExact",
    httpMethod: "RPC",
    path: "/return-typerpc.exact",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {
        rpc: true
    },
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "rpcStrip",
    httpMethod: "RPC",
    path: "/return-typerpc.strip",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {
        rpc: true
    },
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "ReturnTypeController",
    methodName: "rpcInvalid",
    httpMethod: "RPC",
    path: "/return-typerpc.invalid",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {
        rpc: true
    },
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "StrictResponseController",
    methodName: "fail",
    httpMethod: "GET",
    path: "/response-mode-strict/fail",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeMode: "strict",
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "StrictResponseController",
    methodName: "overrideRelaxed",
    httpMethod: "GET",
    path: "/response-mode-strict/override-relaxed",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeMode: "relaxed",
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "InheritedResponseController",
    methodName: "inheritedRelaxed",
    httpMethod: "GET",
    path: "/response-mode-inherited/inherited-relaxed",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeMode: "relaxed",
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "InheritedResponseController",
    methodName: "overrideStrict",
    httpMethod: "GET",
    path: "/response-mode-inherited/override-strict",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeMode: "strict",
    returnTypeValidator: __val_04c78f82f98a8cf4
});
__server_metadata_store.endpoints.push({
    controller: "UnprotectedClassController",
    methodName: "test",
    httpMethod: "GET",
    path: "/unprotected-class/test",
    params: [],
    guards: [{
            type: "class",
            name: "AnotherGuard",
            resolvers: [],
            params: [],
            isAsync: false
        }],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UnprotectedClassAllController",
    methodName: "test",
    httpMethod: "GET",
    path: "/unprotected-class-all/test",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UnprotectedMethodController",
    methodName: "getOne",
    httpMethod: "GET",
    path: "/unprotected-method/one",
    params: [],
    guards: [{
            type: "class",
            name: "AnotherGuard",
            resolvers: [],
            params: [],
            isAsync: false
        }],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UnprotectedMethodController",
    methodName: "getAll",
    httpMethod: "GET",
    path: "/unprotected-method/all",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UninterceptedClassController",
    methodName: "test",
    httpMethod: "GET",
    path: "/unintercepted-class/test",
    params: [],
    guards: [],
    interceptors: ["AnotherInterceptor"],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UninterceptedClassAllController",
    methodName: "test",
    httpMethod: "GET",
    path: "/unintercepted-class-all/test",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UninterceptedMethodController",
    methodName: "getOne",
    httpMethod: "GET",
    path: "/unintercepted-method/one",
    params: [],
    guards: [],
    interceptors: ["AnotherInterceptor"],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "UninterceptedMethodController",
    methodName: "getAll",
    httpMethod: "GET",
    path: "/unintercepted-method/all",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "MiddlewareTestController",
    methodName: "both",
    httpMethod: "GET",
    path: "/middleware-test/both",
    params: [{
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [{
            type: "class",
            name: "MiddlewareCheckingGuard",
            resolvers: [],
            params: [{
                    source: "Request",
                    name: "",
                    validator: "",
                    mode: undefined
                }],
            isAsync: false
        }],
    interceptors: [],
    middlewares: ["SimpleTestMiddleware", "CallbackTestMiddleware"],
    meta: {},
    returnTypeValidator: __val_8ee319793d943d85
});
__server_metadata_store.endpoints.push({
    controller: "MiddlewareTestController",
    methodName: "override",
    httpMethod: "GET",
    path: "/middleware-test/override",
    params: [{
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: ["SimpleTestMiddleware"],
    meta: {},
    returnTypeValidator: __val_8ee319793d943d85
});
__server_metadata_store.endpoints.push({
    controller: "MiddlewareUnmiddlewareController",
    methodName: "removeOne",
    httpMethod: "GET",
    path: "/middleware-unmiddleware/remove-one",
    params: [{
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: ["CallbackTestMiddleware"],
    meta: {},
    returnTypeValidator: __val_8ee319793d943d85
});
__server_metadata_store.endpoints.push({
    controller: "MiddlewareUnmiddlewareController",
    methodName: "removeAll",
    httpMethod: "GET",
    path: "/middleware-unmiddleware/remove-all",
    params: [{
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_8ee319793d943d85
});
__server_metadata_store.endpoints.push({
    controller: "GuardInterceptorOrderController",
    methodName: "test",
    httpMethod: "GET",
    path: "/guard-interceptor-order/test",
    params: [],
    guards: [{
            type: "class",
            name: "FailingGuard",
            resolvers: [],
            params: [],
            isAsync: false
        }],
    interceptors: ["CountingInterceptor"],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "ClassPublicController",
    methodName: "test",
    httpMethod: "GET",
    path: "/class-public/test",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
});
__server_metadata_store.endpoints.push({
    controller: "MethodPublicController",
    methodName: "test",
    httpMethod: "GET",
    path: "/method-public/test",
    params: [],
    guards: [],
    interceptors: [],
    middlewares: [],
    meta: {},
    returnTypeValidator: __val_473287f8298dba71
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
__server_metadata_store.providers.set("ReturnTypeController", ReturnTypeController);
__server_metadata_store.controllerClasses.add("ReturnTypeController");
__server_metadata_store.providers.set("StrictResponseController", StrictResponseController);
__server_metadata_store.controllerClasses.add("StrictResponseController");
__server_metadata_store.providers.set("BaseRelaxedController", BaseRelaxedController);
__server_metadata_store.controllerClasses.add("BaseRelaxedController");
__server_metadata_store.providers.set("InheritedResponseController", InheritedResponseController);
__server_metadata_store.controllerClasses.add("InheritedResponseController");
__server_metadata_store.providers.set("UnprotectedBaseController", UnprotectedBaseController);
__server_metadata_store.controllerClasses.add("UnprotectedBaseController");
__server_metadata_store.providers.set("UnprotectedClassController", UnprotectedClassController);
__server_metadata_store.controllerClasses.add("UnprotectedClassController");
__server_metadata_store.providers.set("UnprotectedClassAllController", UnprotectedClassAllController);
__server_metadata_store.controllerClasses.add("UnprotectedClassAllController");
__server_metadata_store.providers.set("UnprotectedMethodController", UnprotectedMethodController);
__server_metadata_store.controllerClasses.add("UnprotectedMethodController");
__server_metadata_store.providers.set("UninterceptedBaseController", UninterceptedBaseController);
__server_metadata_store.controllerClasses.add("UninterceptedBaseController");
__server_metadata_store.providers.set("UninterceptedClassController", UninterceptedClassController);
__server_metadata_store.controllerClasses.add("UninterceptedClassController");
__server_metadata_store.providers.set("UninterceptedClassAllController", UninterceptedClassAllController);
__server_metadata_store.controllerClasses.add("UninterceptedClassAllController");
__server_metadata_store.providers.set("UninterceptedMethodController", UninterceptedMethodController);
__server_metadata_store.controllerClasses.add("UninterceptedMethodController");
__server_metadata_store.providers.set("MiddlewareTestController", MiddlewareTestController);
__server_metadata_store.controllerClasses.add("MiddlewareTestController");
__server_metadata_store.providers.set("MiddlewareUnmiddlewareController", MiddlewareUnmiddlewareController);
__server_metadata_store.controllerClasses.add("MiddlewareUnmiddlewareController");
__server_metadata_store.providers.set("GuardInterceptorOrderController", GuardInterceptorOrderController);
__server_metadata_store.controllerClasses.add("GuardInterceptorOrderController");
__server_metadata_store.providers.set("ClassPublicController", ClassPublicController);
__server_metadata_store.controllerClasses.add("ClassPublicController");
__server_metadata_store.providers.set("MethodPublicController", MethodPublicController);
__server_metadata_store.controllerClasses.add("MethodPublicController");
__server_metadata_store.providers.set("ConfigService", ConfigService);
__server_metadata_store.providers.set("DatabaseService", DatabaseService);
__server_metadata_store.providers.set("LoggerService", LoggerService);
__server_metadata_store.providers.set("BaseService", BaseService);
__server_metadata_store.providers.set("ChildService", ChildService);
__server_metadata_store.providers.set("DiGuard", DiGuard);
__server_metadata_store.providers.set("SimpleGuard", SimpleGuard);
__server_metadata_store.providers.set("AnotherGuard", AnotherGuard);
__server_metadata_store.providers.set("SimpleTestMiddleware", SimpleTestMiddleware);
__server_metadata_store.providers.set("CallbackTestMiddleware", CallbackTestMiddleware);
__server_metadata_store.providers.set("MiddlewareCheckingGuard", MiddlewareCheckingGuard);
__server_metadata_store.providers.set("FailingGuard", FailingGuard);
__server_metadata_store.providers.set("PublicDenyGuard", PublicDenyGuard);
