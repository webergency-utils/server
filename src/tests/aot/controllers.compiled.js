var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import * as __tcRuntime from "@webergency-utils/typechecker/runtime";
const validators = __tcRuntime.validators;
const __val_473287f8298dba71 = validators.string;
const __val_12886f9d00055adf = validators.number;
const __val_04c78f82f98a8cf4 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["name", "age"]), "User");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["age", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, new Set(["name", "age"]));
    return data;
};
const __val_d31fde334b3f24e2 = (v, path, ctx) => validators.literal(v, path, ctx, false);
const __val_561da1284502fef1 = (v, path, ctx) => validators.literal(v, path, ctx, true);
const __val_ced862ef1505bc73 = (v, path, ctx) => validators.union(v, path, ctx, [__val_d31fde334b3f24e2, __val_561da1284502fef1], "Type<boolean>");
const __val_c67915707769fcf5 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "data"]), "{ success: boolean; data: User; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_04c78f82f98a8cf4]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "data"]));
    return data;
};
const __val_6d1570e5b8d6d45a = (v, path, ctx) => validators.literal(v, path, ctx, "simple");
const __val_2258654cc0f69d37 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["type", "val"]), "{ type: \"simple\"; val: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["type", false, __val_6d1570e5b8d6d45a],
        ["val", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["type", "val"]));
    return data;
};
const __val_68056e96638382b6 = (v, path, ctx) => validators.literal(v, path, ctx, "complex");
const __val_e5da2f9fabafe20e = (v, path, ctx) => validators.array(v, path, ctx, __val_473287f8298dba71);
const __val_b421a9236dfde58e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["id", "tags"]), "{ id: number; tags: string[]; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    validators.stripExtras(data, ctx, new Set(["id", "tags"]));
    return data;
};
const __val_5c5ed695091ba342 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["type", "data"]), "{ type: \"complex\"; data: { id: number; tags: string[]; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["type", false, __val_68056e96638382b6],
        ["data", false, __val_b421a9236dfde58e]
    ]);
    validators.stripExtras(data, ctx, new Set(["type", "data"]));
    return data;
};
const __val_a41824426b6b1ede = (v, path, ctx) => validators.union(v, path, ctx, [__val_2258654cc0f69d37, __val_5c5ed695091ba342], "Type<MyUnion>");
const __val_d74cefa44e345d17 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "data"]), "{ success: boolean; data: MyUnion; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_a41824426b6b1ede]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "data"]));
    return data;
};
const __val_55e3fcb8d722f805 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["reason"]), "{ reason: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["reason", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["reason"]));
    return data;
};
const __val_2d1db52869bf4329 = (v, path, ctx) => validators.literal(v, path, ctx, "active");
const __val_88e643147651d549 = (v, path, ctx) => validators.literal(v, path, ctx, "inactive");
const __val_857204a536cb022c = (v, path, ctx) => validators.union(v, path, ctx, [__val_55e3fcb8d722f805, __val_2d1db52869bf4329, __val_88e643147651d549], "Type<Status>");
const __val_2d6ea820a293bacf = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "s"]), "{ success: boolean; s: Status; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["s", false, __val_857204a536cb022c]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "s"]));
    return data;
};
const __val_affb28566d707e35 = (v, path, ctx) => validators.union(v, path, ctx, [__val_473287f8298dba71, __val_12886f9d00055adf], "Type<string|number>");
const __val_8c1c1b2d325f9de6 = (v, path, ctx) => validators.array(v, path, ctx, __val_affb28566d707e35);
const __val_a042f9877fc2376a = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "data"]), "{ success: boolean; data: MixedArray; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_8c1c1b2d325f9de6]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "data"]));
    return data;
};
const __val_eb045d78d2731073 = validators.undefined;
const __val_ca383f8818520f0b = (v, path, ctx) => validators.union(v, path, ctx, [__val_eb045d78d2731073, __val_04c78f82f98a8cf4], "Type<User|undefined>");
const __val_68aecd6fa646cade = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["id", "user", "tags"]), "Nested");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["user", true, __val_ca383f8818520f0b],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    validators.stripExtras(data, ctx, new Set(["id", "user", "tags"]));
    return data;
};
const __val_f0ac6e3a29009cf1 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "data"]), "{ success: boolean; data: Nested; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_68aecd6fa646cade]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "data"]));
    return data;
};
const __val_f28f8acf7e68cbfd = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["a", "b"]), "Intersection");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["a", false, __val_473287f8298dba71],
        ["b", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, new Set(["a", "b"]));
    return data;
};
const __val_0d157d33684c0018 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "data"]), "{ success: boolean; data: Intersection; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_f28f8acf7e68cbfd]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "data"]));
    return data;
};
const __val_85a41b63d9a32b8b = (v, path, ctx) => validators.union(v, path, ctx, [__val_2d1db52869bf4329, __val_88e643147651d549], "Type<\"active\"|\"inactive\">");
const __val_0084393b0d7248e4 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "status"]), "{ success: boolean; status: \"active\" | \"inactive\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["status", false, __val_85a41b63d9a32b8b]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "status"]));
    return data;
};
const __val_d9bb28ea073c815e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "tags"]), "{ success: boolean; tags: string[]; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "tags"]));
    return data;
};
const __val_99c40ab405926cb5 = validators.date;
const __val_eefd1c8d7e793bf3 = validators.regexp;
const __val_75d012fe28656e0a = validators.bigint;
const __val_dfd1002a464a1dbf = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "age", "active", "date", "pattern", "big"]), "{ success: boolean; age: number; active: boolean; date: string; pattern: string; big: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["age", false, __val_12886f9d00055adf],
        ["active", false, __val_ced862ef1505bc73],
        ["date", false, __val_473287f8298dba71],
        ["pattern", false, __val_473287f8298dba71],
        ["big", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "age", "active", "date", "pattern", "big"]));
    return data;
};
const __val_91d782a2d0de1354 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["name", "active"]), "{ name: string; active: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["active", false, __val_ced862ef1505bc73]
    ]);
    validators.stripExtras(data, ctx, new Set(["name", "active"]));
    return data;
};
const __val_d979aa00a685cb05 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "user"]), "{ success: boolean; user: { name: string; active: boolean; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["user", false, __val_91d782a2d0de1354]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "user"]));
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
    const obj = validators.object(v, path, ctx, new Set(["success", "val", "type"]), "{ success: boolean; val: string | number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["val", false, __val_affb28566d707e35],
        ["type", false, __val_1e1a258db2184d0e]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "val", "type"]));
    return data;
};
const __val_9a141e74a6c02429 = (v, path, ctx) => validators.templateLiteral(v, path, ctx, validators.safeRegExp("^id-[0-9]+(\\.[0-9]+)?$"), "`id-${number}`");
const __val_6b50e5736cb6bb55 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "id"]), "{ success: boolean; id: `id-${number}`; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["id", false, __val_9a141e74a6c02429]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "id"]));
    return data;
};
const __val_c615b105fba1f965 = (v, path, ctx) => {
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
const __val_ed601a97123e74a5 = (v, path, ctx) => {
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
const __val_80803d497f4cbcc3 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "pass", "age"]), "{ success: boolean; pass: string & MinLength<8, string>; age: number & Minimum<18, string>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["pass", false, __val_c615b105fba1f965],
        ["age", false, __val_ed601a97123e74a5]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "pass", "age"]));
    return data;
};
const __val_61eb849c9ae845b0 = (v, path, ctx) => {
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
const __val_bf0f00a269610757 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["val"]), "CustomUser");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["val", false, __val_61eb849c9ae845b0]
    ]);
    validators.stripExtras(data, ctx, new Set(["val"]));
    return data;
};
const __val_70c31e2e47f17c8e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success", "data"]), "{ success: boolean; data: CustomUser; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_bf0f00a269610757]
    ]);
    validators.stripExtras(data, ctx, new Set(["success", "data"]));
    return data;
};
const __val_b237870e8da1ad64 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["message"]), "{ message: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["message", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["message"]));
    return data;
};
const __val_0cedac632a9d5281 = (v, path, ctx) => {
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
const __val_cfef021b8ec13350 = (v, path, ctx) => {
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
const __val_51b5abe7e1ba2c24 = (v, path, ctx) => {
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
const __val_a421e7e861811a22 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["min", "max", "mult"]), "{ min: number & ExclusiveMinimum<10, string>; max: number & ExclusiveMaximum<20, string>; mult: number & MultipleOf<5, string>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["min", false, __val_0cedac632a9d5281],
        ["max", false, __val_cfef021b8ec13350],
        ["mult", false, __val_51b5abe7e1ba2c24]
    ]);
    validators.stripExtras(data, ctx, new Set(["min", "max", "mult"]));
    return data;
};
const __val_354ede58aec83f6c = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        v = validators.format(v, path, ctx, "email");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_646f574aa5d2b8f1 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        v = validators.format(v, path, ctx, "uuid");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_4c9f67db765233c6 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.success && v !== undefined && v !== null) {
        v = validators.format(v, path, ctx, "date");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_3142ae88ce6e4c32 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["email", "uuid", "date"]), "{ email: string & Format<\"email\", string>; uuid: string & Format<\"uuid\", string>; date: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["email", false, __val_354ede58aec83f6c],
        ["uuid", false, __val_646f574aa5d2b8f1],
        ["date", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["email", "uuid", "date"]));
    return data;
};
const __val_669d5b02a3e3ee23 = (v, path, ctx) => {
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
const __val_68211ffefc1b2e01 = (v, path, ctx) => {
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
    const obj = validators.object(v, path, ctx, new Set(["msg", "dbUrl", "logged"]), "{ msg: string; dbUrl: string; logged: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["msg", false, __val_473287f8298dba71],
        ["dbUrl", false, __val_473287f8298dba71],
        ["logged", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["msg", "dbUrl", "logged"]));
    return data;
};
const __val_ab68d46bd18d4a0a = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["dbUrl"]), "{ dbUrl: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["dbUrl", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, new Set(["dbUrl"]));
    return data;
};
const __val_e955dd67e417e2f5 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["success"]), "{ success: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73]
    ]);
    validators.stripExtras(data, ctx, new Set(["success"]));
    return data;
};
const __val_07a8cc3cc8aea7a1 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["val"]), "{ val: number; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["val", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, new Set(["val"]));
    return data;
};
const __val_ccb10958b6aa7739 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["a", "b"]), "SumPayload");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["a", false, __val_12886f9d00055adf],
        ["b", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, new Set(["a", "b"]));
    return data;
};
const __val_74234e98afe7498f = validators.null;
const __val_6bd4d7da4d0dd205 = (v, path, ctx) => validators.union(v, path, ctx, [__val_74234e98afe7498f, __val_473287f8298dba71], "Type<string|null>");
const __val_13a05136ba37eb80 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, new Set(["one", "two"]), "{ one: string | null; two: string | null; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["one", false, __val_6bd4d7da4d0dd205],
        ["two", false, __val_6bd4d7da4d0dd205]
    ]);
    validators.stripExtras(data, ctx, new Set(["one", "two"]));
    return data;
};
import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Ws, Sse, Param, MessagePattern, EventPattern, Payload, Head, Options, All, ResponseMode, Unprotect, Unintercept, Use, OverrideUse, Unuse, Public } from '../../index.js';
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
    optionsExplicit() {
        return { message: 'hello from options' };
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
    Options('/options-explicit')
], TypeSafetyController.prototype, "optionsExplicit", null);
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
        // from:query revives format.Date to a Date; serialize back for the string return shape
        const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;
        return { email, uuid, date: dateStr };
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
    async *handleSseStrip() {
        yield { event: 'update', data: { val: 1, extra: 'gone' } };
    }
    async *handleSseInvalid() {
        yield { event: 'update', data: { val: 'nope' } };
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
__decorate([
    Sse('/sse-strip'),
    ResponseMode('strip')
], RealtimeController.prototype, "handleSseStrip", null);
__decorate([
    Sse('/sse-invalid'),
    ResponseMode('strict')
], RealtimeController.prototype, "handleSseInvalid", null);
RealtimeController = __decorate([
    Controller('/realtime')
], RealtimeController);
export { RealtimeController };
let MathMicroserviceController = class MathMicroserviceController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    lastNotify;
    sum(data) {
        return data.a + data.b;
    }
    greet(name) {
        return `Hello, ${name}!`;
    }
    notify(msg) {
        this.lastNotify = msg;
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
DiGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "DiGuard"
};
SimpleGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "SimpleGuard"
};
AnotherGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "AnotherGuard"
};
MiddlewareCheckingGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "MiddlewareCheckingGuard"
};
FailingGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "FailingGuard"
};
PublicDenyGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "PublicDenyGuard"
};
GlobalErrorSanitizer[Symbol.for("webergency.server.injectable")] = {
    kind: "interceptor",
    token: "GlobalErrorSanitizer"
};
SimpleInterceptor[Symbol.for("webergency.server.injectable")] = {
    kind: "interceptor",
    token: "SimpleInterceptor"
};
AnotherInterceptor[Symbol.for("webergency.server.injectable")] = {
    kind: "interceptor",
    token: "AnotherInterceptor"
};
CountingInterceptor[Symbol.for("webergency.server.injectable")] = {
    kind: "interceptor",
    token: "CountingInterceptor"
};
ConfigService[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "ConfigService"
};
DatabaseService[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "DatabaseService"
};
LoggerService[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "LoggerService"
};
BaseService[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "BaseService"
};
ChildService[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "ChildService"
};
SimpleTestMiddleware[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "SimpleTestMiddleware"
};
CallbackTestMiddleware[Symbol.for("webergency.server.injectable")] = {
    kind: "provider",
    token: "CallbackTestMiddleware"
};
TypeSafetyController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
                    validator: __val_99c40ab405926cb5,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "pattern",
                    validator: __val_eefd1c8d7e793bf3,
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
            controller: "TypeSafetyController",
            methodName: "tags",
            httpMethod: "GET",
            path: "/type-safety/tags",
            params: [{
                    source: "Query",
                    name: "pass",
                    validator: __val_c615b105fba1f965,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "age",
                    validator: __val_ed601a97123e74a5,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_80803d497f4cbcc3
        },
        {
            controller: "TypeSafetyController",
            methodName: "customValidator",
            httpMethod: "POST",
            path: "/type-safety/custom-validator",
            params: [{
                    source: "Body",
                    name: "",
                    validator: __val_bf0f00a269610757,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_70c31e2e47f17c8e
        },
        {
            controller: "TypeSafetyController",
            methodName: "headExplicit",
            httpMethod: "HEAD",
            path: "/type-safety/head-explicit",
            params: [],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {}
        },
        {
            controller: "TypeSafetyController",
            methodName: "optionsExplicit",
            httpMethod: "OPTIONS",
            path: "/type-safety/options-explicit",
            params: [],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_b237870e8da1ad64
        },
        {
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
        },
        {
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
        }
    ]
};
TypeSafetyController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "TypeSafetyController"
};
TagParityController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
            controller: "TagParityController",
            methodName: "getNumber",
            httpMethod: "GET",
            path: "/tag-parity/number",
            params: [{
                    source: "Query",
                    name: "min",
                    validator: __val_0cedac632a9d5281,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "max",
                    validator: __val_cfef021b8ec13350,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "mult",
                    validator: __val_51b5abe7e1ba2c24,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_a421e7e861811a22
        },
        {
            controller: "TagParityController",
            methodName: "getString",
            httpMethod: "GET",
            path: "/tag-parity/string",
            params: [{
                    source: "Query",
                    name: "email",
                    validator: __val_354ede58aec83f6c,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "uuid",
                    validator: __val_646f574aa5d2b8f1,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "date",
                    validator: __val_4c9f67db765233c6,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_3142ae88ce6e4c32
        },
        {
            controller: "TagParityController",
            methodName: "postArray",
            httpMethod: "POST",
            path: "/tag-parity/array",
            params: [{
                    source: "Body",
                    name: "",
                    validator: __val_669d5b02a3e3ee23,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_669d5b02a3e3ee23
        },
        {
            controller: "TagParityController",
            methodName: "postUniqueArray",
            httpMethod: "POST",
            path: "/tag-parity/unique-array",
            params: [{
                    source: "Body",
                    name: "",
                    validator: __val_68211ffefc1b2e01,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_68211ffefc1b2e01
        }
    ]
};
TagParityController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "TagParityController"
};
SecureController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        }
    ]
};
SecureController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "SecureController"
};
BaseController[Symbol.for("webergency.server.controller")] = {
    endpoints: []
};
BaseController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "BaseController"
};
InheritedController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        }
    ]
};
InheritedController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "InheritedController"
};
DiTestController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        }
    ]
};
DiTestController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "DiTestController"
};
RealtimeController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
            },
            returnTypeValidator: __val_07a8cc3cc8aea7a1
        },
        {
            controller: "RealtimeController",
            methodName: "handleSseStrip",
            httpMethod: "GET",
            path: "/realtime/sse-strip",
            params: [],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {
                sse: true
            },
            returnTypeMode: "strip",
            returnTypeValidator: __val_07a8cc3cc8aea7a1
        },
        {
            controller: "RealtimeController",
            methodName: "handleSseInvalid",
            httpMethod: "GET",
            path: "/realtime/sse-invalid",
            params: [],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {
                sse: true
            },
            returnTypeMode: "strict",
            returnTypeValidator: __val_07a8cc3cc8aea7a1
        }
    ]
};
RealtimeController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "RealtimeController"
};
MathMicroserviceController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        },
        {
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
        }
    ]
};
MathMicroserviceController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "MathMicroserviceController"
};
ReturnTypeController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        }
    ]
};
ReturnTypeController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "ReturnTypeController"
};
StrictResponseController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        }
    ]
};
StrictResponseController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "StrictResponseController"
};
BaseRelaxedController[Symbol.for("webergency.server.controller")] = {
    endpoints: []
};
BaseRelaxedController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "BaseRelaxedController"
};
InheritedResponseController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        }
    ]
};
InheritedResponseController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "InheritedResponseController"
};
UnprotectedBaseController[Symbol.for("webergency.server.controller")] = {
    endpoints: []
};
UnprotectedBaseController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UnprotectedBaseController"
};
UnprotectedClassController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
UnprotectedClassController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UnprotectedClassController"
};
UnprotectedClassAllController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
UnprotectedClassAllController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UnprotectedClassAllController"
};
UnprotectedMethodController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        }
    ]
};
UnprotectedMethodController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UnprotectedMethodController"
};
UninterceptedBaseController[Symbol.for("webergency.server.controller")] = {
    endpoints: []
};
UninterceptedBaseController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UninterceptedBaseController"
};
UninterceptedClassController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
UninterceptedClassController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UninterceptedClassController"
};
UninterceptedClassAllController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
UninterceptedClassAllController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UninterceptedClassAllController"
};
UninterceptedMethodController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        },
        {
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
        }
    ]
};
UninterceptedMethodController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "UninterceptedMethodController"
};
MiddlewareTestController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
            returnTypeValidator: __val_13a05136ba37eb80
        },
        {
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
            returnTypeValidator: __val_13a05136ba37eb80
        }
    ]
};
MiddlewareTestController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "MiddlewareTestController"
};
MiddlewareUnmiddlewareController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
            returnTypeValidator: __val_13a05136ba37eb80
        },
        {
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
            returnTypeValidator: __val_13a05136ba37eb80
        }
    ]
};
MiddlewareUnmiddlewareController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "MiddlewareUnmiddlewareController"
};
GuardInterceptorOrderController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
GuardInterceptorOrderController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "GuardInterceptorOrderController"
};
ClassPublicController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
ClassPublicController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "ClassPublicController"
};
MethodPublicController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
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
        }
    ]
};
MethodPublicController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "MethodPublicController"
};
