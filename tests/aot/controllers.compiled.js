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
const __val_04c78f82f98a8cf4 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "User");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["name", "age"]), [
    ["name", false, __val_473287f8298dba71],
    ["age", false, __val_12886f9d00055adf]
]);
const __val_d31fde334b3f24e2 = (v, path, ctx) => validators.literal(v, path, ctx, false);
const __val_561da1284502fef1 = (v, path, ctx) => validators.literal(v, path, ctx, true);
const __val_ced862ef1505bc73 = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<boolean>"))([__val_d31fde334b3f24e2, __val_561da1284502fef1]);
const __val_c67915707769fcf5 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: User; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_04c78f82f98a8cf4]
]);
const __val_6d1570e5b8d6d45a = (v, path, ctx) => validators.literal(v, path, ctx, "simple");
const __val_2258654cc0f69d37 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ type: \"simple\"; val: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["type", "val"]), [
    ["type", false, __val_6d1570e5b8d6d45a],
    ["val", false, __val_473287f8298dba71]
]);
const __val_68056e96638382b6 = (v, path, ctx) => validators.literal(v, path, ctx, "complex");
const __val_e5da2f9fabafe20e = (v, path, ctx) => validators.array(v, path, ctx, __val_473287f8298dba71);
const __val_b421a9236dfde58e = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ id: number; tags: string[]; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["id", "tags"]), [
    ["id", false, __val_12886f9d00055adf],
    ["tags", false, __val_e5da2f9fabafe20e]
]);
const __val_5c5ed695091ba342 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ type: \"complex\"; data: { id: number; tags: string[]; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["type", "data"]), [
    ["type", false, __val_68056e96638382b6],
    ["data", false, __val_b421a9236dfde58e]
]);
const __val_0b60aa399d818c05 = (byTag => (v, path, ctx) => validators.taggedUnion(v, path, ctx, "type", byTag, "Type<MyUnion>"))(new Map([
    ["simple", __val_2258654cc0f69d37],
    ["complex", __val_5c5ed695091ba342]
]));
const __val_a068761681a0a813 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: MyUnion; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_0b60aa399d818c05]
]);
const __val_55e3fcb8d722f805 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ reason: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["reason"]), [
    ["reason", false, __val_473287f8298dba71]
]);
const __val_2d1db52869bf4329 = (v, path, ctx) => validators.literal(v, path, ctx, "active");
const __val_88e643147651d549 = (v, path, ctx) => validators.literal(v, path, ctx, "inactive");
const __val_857204a536cb022c = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<Status>"))([__val_55e3fcb8d722f805, __val_2d1db52869bf4329, __val_88e643147651d549]);
const __val_2d6ea820a293bacf = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; s: Status; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "s"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["s", false, __val_857204a536cb022c]
]);
const __val_affb28566d707e35 = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<string|number>"))([__val_473287f8298dba71, __val_12886f9d00055adf]);
const __val_8c1c1b2d325f9de6 = (v, path, ctx) => validators.array(v, path, ctx, __val_affb28566d707e35);
const __val_a042f9877fc2376a = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: MixedArray; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_8c1c1b2d325f9de6]
]);
const __val_ca383f8818520f0b = (v, path, ctx) => validators.optional(v, path, ctx, __val_04c78f82f98a8cf4);
const __val_fdba127064c2547c = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "Nested");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["id", "user", "tags"]), [
    ["id", false, __val_12886f9d00055adf],
    ["user", true, __val_ca383f8818520f0b],
    ["tags", false, __val_e5da2f9fabafe20e]
]);
const __val_d0b53ff733685c2c = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: Nested; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_fdba127064c2547c]
]);
const __val_f28f8acf7e68cbfd = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "Intersection");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["a", "b"]), [
    ["a", false, __val_473287f8298dba71],
    ["b", false, __val_12886f9d00055adf]
]);
const __val_0d157d33684c0018 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: Intersection; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_f28f8acf7e68cbfd]
]);
const __val_85a41b63d9a32b8b = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<\"active\"|\"inactive\">"))([__val_2d1db52869bf4329, __val_88e643147651d549]);
const __val_0084393b0d7248e4 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; status: \"active\" | \"inactive\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "status"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["status", false, __val_85a41b63d9a32b8b]
]);
const __val_d9bb28ea073c815e = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; tags: string[]; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "tags"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["tags", false, __val_e5da2f9fabafe20e]
]);
const __val_0dcd607745c5cb3e = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; age: number; active: boolean; date: string; pattern: string; big: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "age", "active", "date", "pattern", "big"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["age", false, __val_12886f9d00055adf],
    ["active", false, __val_ced862ef1505bc73],
    ["date", false, __val_473287f8298dba71],
    ["pattern", false, __val_473287f8298dba71],
    ["big", false, __val_473287f8298dba71]
]);
const __val_91d782a2d0de1354 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ name: string; active: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["name", "active"]), [
    ["name", false, __val_473287f8298dba71],
    ["active", false, __val_ced862ef1505bc73]
]);
const __val_4ac5d9e4f4205e53 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; user: { name: string; active: boolean; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "user"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["user", false, __val_91d782a2d0de1354]
]);
const __val_32873a7f224f38d8 = (v, path, ctx) => validators.literal(v, path, ctx, "string");
const __val_628f6ca4b78e6b50 = (v, path, ctx) => validators.literal(v, path, ctx, "number");
const __val_46a7c6afe9b432e6 = (v, path, ctx) => validators.literal(v, path, ctx, "bigint");
const __val_1207c37d006fe9f8 = (v, path, ctx) => validators.literal(v, path, ctx, "boolean");
const __val_046317c2cffaf10d = (v, path, ctx) => validators.literal(v, path, ctx, "symbol");
const __val_df6b16b0e625bf20 = (v, path, ctx) => validators.literal(v, path, ctx, "undefined");
const __val_e64d77191bc932bb = (v, path, ctx) => validators.literal(v, path, ctx, "object");
const __val_9120d5d091aa5bf3 = (v, path, ctx) => validators.literal(v, path, ctx, "function");
const __val_1e1a258db2184d0e = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">"))([__val_32873a7f224f38d8, __val_628f6ca4b78e6b50, __val_46a7c6afe9b432e6, __val_1207c37d006fe9f8, __val_046317c2cffaf10d, __val_df6b16b0e625bf20, __val_e64d77191bc932bb, __val_9120d5d091aa5bf3]);
const __val_87e266a791052d41 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; val: string | number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "val", "type"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["val", false, __val_affb28566d707e35],
    ["type", false, __val_1e1a258db2184d0e]
]);
const __val_9a141e74a6c02429 = (v, path, ctx) => validators.templateLiteral(v, path, ctx, validators.safeRegExp("^id-[0-9]+(\\.[0-9]+)?$"), "`id-${number}`");
const __val_6b50e5736cb6bb55 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; id: `id-${number}`; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "id"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["id", false, __val_9a141e74a6c02429]
]);
const __val_e5fc42b4aba2c6d1 = (v, path, ctx) => {
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
const __val_a1975336d1e3a054 = (v, path, ctx) => {
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
const __val_68075fba117f092a = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; pass: string & constraint_MinLength<8>; age: number & constraint_Minimum<18>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "pass", "age"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["pass", false, __val_e5fc42b4aba2c6d1],
    ["age", false, __val_a1975336d1e3a054]
]);
const __val_bb2935cf2223ae40 = (v, path, ctx) => {
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
const __val_796c4eac83a7a861 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "CustomUser");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["val"]), [
    ["val", false, __val_bb2935cf2223ae40]
]);
const __val_4a8765d306ac1e9b = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: CustomUser; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_796c4eac83a7a861]
]);
const __val_b237870e8da1ad64 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ message: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["message"]), [
    ["message", false, __val_473287f8298dba71]
]);
const __val_36b3db4fc7b251a9 = (v, path, ctx) => {
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
const __val_397edf756fbe38e0 = (v, path, ctx) => {
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
const __val_a564a7ce790d29ed = (v, path, ctx) => {
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
const __val_fb804057ab9cb051 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ min: number & constraint_ExclusiveMinimum<10>; max: number & constraint_ExclusiveMaximum<20>; mult: number & constraint_MultipleOf<...>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["min", "max", "mult"]), [
    ["min", false, __val_36b3db4fc7b251a9],
    ["max", false, __val_397edf756fbe38e0],
    ["mult", false, __val_a564a7ce790d29ed]
]);
const __val_871344223c5ce37c = (v, path, ctx) => {
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
const __val_a9030587ebb4386c = (v, path, ctx) => {
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
const __val_a744c47def1902a9 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ email: string & constraint_Format<\"email\">; uuid: string & constraint_Format<\"uuid\">; date: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["email", "uuid", "date"]), [
    ["email", false, __val_871344223c5ce37c],
    ["uuid", false, __val_a9030587ebb4386c],
    ["date", false, __val_473287f8298dba71]
]);
const __val_78d9364193f14947 = (v, path, ctx) => {
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
const __val_e932e0ca2e5a5a04 = (v, path, ctx) => {
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
const __val_263dff44d887120e = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ msg: string; dbUrl: string; logged: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["msg", "dbUrl", "logged"]), [
    ["msg", false, __val_473287f8298dba71],
    ["dbUrl", false, __val_473287f8298dba71],
    ["logged", false, __val_473287f8298dba71]
]);
const __val_ab68d46bd18d4a0a = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ dbUrl: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["dbUrl"]), [
    ["dbUrl", false, __val_473287f8298dba71]
]);
const __val_e955dd67e417e2f5 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success"]), [
    ["success", false, __val_ced862ef1505bc73]
]);
const __val_07a8cc3cc8aea7a1 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ val: number; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["val"]), [
    ["val", false, __val_12886f9d00055adf]
]);
const __val_0b6ca95199f89861 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "SumPayload");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["a", "b"]), [
    ["a", false, __val_12886f9d00055adf],
    ["b", false, __val_12886f9d00055adf]
]);
const __val_6bd4d7da4d0dd205 = (v, path, ctx) => validators.nullable(v, path, ctx, __val_473287f8298dba71);
const __val_d78a5e9e3b797aa6 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ one: string | null; two: string | null; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["one", "two"]), [
    ["one", false, __val_6bd4d7da4d0dd205],
    ["two", false, __val_6bd4d7da4d0dd205]
]);
const __val_3854fe5bb34caec3 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ id: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["id"]), [
    ["id", false, __val_473287f8298dba71]
]);
const __val_10fc726648976d5a = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ secret: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["secret"]), [
    ["secret", false, __val_ced862ef1505bc73]
]);
const __val_1cf64ebdd7fe6766 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ id: string; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["id", "type"]), [
    ["id", false, __val_473287f8298dba71],
    ["type", false, __val_1e1a258db2184d0e]
]);
const __val_ad7cc50180a59d88 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ n: number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["n", "type"]), [
    ["n", false, __val_12886f9d00055adf],
    ["type", false, __val_1e1a258db2184d0e]
]);
const __val_592aa28226ef808b = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ token: string; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["token", "type"]), [
    ["token", false, __val_473287f8298dba71],
    ["type", false, __val_1e1a258db2184d0e]
]);
const __val_c73a5cfb4b62c0e6 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ session: string; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["session", "type"]), [
    ["session", false, __val_473287f8298dba71],
    ["type", false, __val_1e1a258db2184d0e]
]);
const __val_f0f7a2626b66a4d9 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ attachmentId: string; token: string; flag: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["attachmentId", "token", "flag"]), [
    ["attachmentId", false, __val_473287f8298dba71],
    ["token", false, __val_473287f8298dba71],
    ["flag", false, __val_473287f8298dba71]
]);
const __val_4b3ffd86cc4f9e24 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: User; ageType: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data", "ageType"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_04c78f82f98a8cf4],
    ["ageType", false, __val_1e1a258db2184d0e]
]);
const __parse_04c78f82f98a8cf4_strict_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const __keys = new Set(["name", "age"]); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "age": __tcRuntime.expectNumber(o.age, (path) ? (path) + "." + "age" : "age") }; for (const k in o) {
    if (!__keys.has(k)) {
        throw new __tcRuntime.ParseError(p, "PropertyNotAllowed<" + k + ">");
    }
} return res; })(obj, path); });
const __parse_04c78f82f98a8cf4_strict_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const __keys = new Set(["name", "age"]); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "age": __tcRuntime.coerceNumber(o.age, (path) ? (path) + "." + "age" : "age") }; for (const k in o) {
    if (!__keys.has(k)) {
        throw new __tcRuntime.ParseError(p, "PropertyNotAllowed<" + k + ">");
    }
} return res; })(rawQuery, path); });
const __parse_04c78f82f98a8cf4_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "age": __tcRuntime.expectNumber(o.age, (path) ? (path) + "." + "age" : "age") }; return res; })(obj, path); });
const __parse_04c78f82f98a8cf4_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "age": __tcRuntime.coerceNumber(o.age, (path) ? (path) + "." + "age" : "age") }; return res; })(rawQuery, path); });
const __parse_04c78f82f98a8cf4_relaxed_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const __keys = new Set(["name", "age"]); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "age": __tcRuntime.expectNumber(o.age, (path) ? (path) + "." + "age" : "age") }; for (const k in o) {
    if (!__keys.has(k)) {
        res[k] = o[k];
    }
} return res; })(obj, path); });
const __parse_04c78f82f98a8cf4_relaxed_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const __keys = new Set(["name", "age"]); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "age": __tcRuntime.coerceNumber(o.age, (path) ? (path) + "." + "age" : "age") }; for (const k in o) {
    if (!__keys.has(k)) {
        res[k] = o[k];
    }
} return res; })(rawQuery, path); });
const __parse_0b60aa399d818c05_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (v, p) { switch (v && v["type"]) {
    case "simple": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": (function (v, path) { if (v !== "simple") {
            throw new __tcRuntime.ParseError(path, "Literal<'simple'>");
        } return v; })(o.type, (p) ? (p) + "." + "type" : "type"), "val": __tcRuntime.expectString(o.val, (p) ? (p) + "." + "val" : "val") }; return res; })(v, p);
    case "complex": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": (function (v, path) { if (v !== "complex") {
            throw new __tcRuntime.ParseError(path, "Literal<'complex'>");
        } return v; })(o.type, (p) ? (p) + "." + "type" : "type"), "data": (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.expectNumber(o.id, ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "id" : "id"), "tags": (function (arr, p) { __tcRuntime.expectArray(arr, p); return arr.map((item, i) => { const itemP = (p ? p + "[" + i + "]" : "[" + i + "]"); return __tcRuntime.expectString(item, itemP); }); })(o.tags, ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "tags" : "tags") }; return res; })(o.data, (p) ? (p) + "." + "data" : "data") }; return res; })(v, p);
    default: throw new __tcRuntime.ParseError(p, "Type<MyUnion>");
} })(obj, path); });
const __parse_0b60aa399d818c05_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (v, p) { switch (v && v["type"]) {
    case "simple": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": (function (v, path) { if (typeof v !== "string") {
            throw new __tcRuntime.ParseError(path, "Literal<'simple'>");
        } if (v !== "simple") {
            throw new __tcRuntime.ParseError(path, "Literal<'simple'>");
        } return v; })(o.type, (p) ? (p) + "." + "type" : "type"), "val": __tcRuntime.expectString(o.val, (p) ? (p) + "." + "val" : "val") }; return res; })(v, p);
    case "complex": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": (function (v, path) { if (typeof v !== "string") {
            throw new __tcRuntime.ParseError(path, "Literal<'complex'>");
        } if (v !== "complex") {
            throw new __tcRuntime.ParseError(path, "Literal<'complex'>");
        } return v; })(o.type, (p) ? (p) + "." + "type" : "type"), "data": (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.coerceNumber(o.id, ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "id" : "id"), "tags": __tcRuntime.coerceArray(o.tags, ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "tags" : "tags", (item, itemP) => __tcRuntime.expectString(item, itemP)) }; return res; })(o.data, (p) ? (p) + "." + "data" : "data") }; return res; })(v, p);
    default: throw new __tcRuntime.ParseError(p, "Type<MyUnion>");
} })(rawQuery, path); });
const __parse_857204a536cb022c_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.parseUnion(rawQuery, path, "Type<Status>", [(v, p) => (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "reason": __tcRuntime.expectString(o.reason, (p) ? (p) + "." + "reason" : "reason") }; return res; })(v, p), (v, p) => (function (v, path) { if (typeof v !== "string") {
        throw new __tcRuntime.ParseError(path, "Literal<'active'>");
    } if (v !== "active") {
        throw new __tcRuntime.ParseError(path, "Literal<'active'>");
    } return v; })(v, p), (v, p) => (function (v, path) { if (typeof v !== "string") {
        throw new __tcRuntime.ParseError(path, "Literal<'inactive'>");
    } if (v !== "inactive") {
        throw new __tcRuntime.ParseError(path, "Literal<'inactive'>");
    } return v; })(v, p)]); });
const __parse_8c1c1b2d325f9de6_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (arr, p) { __tcRuntime.expectArray(arr, p); return arr.map((item, i) => { const itemP = (p ? p + "[" + i + "]" : "[" + i + "]"); return __tcRuntime.parseUnion(item, itemP, "Type<string|number>", [(v, p) => __tcRuntime.expectString(v, p), (v, p) => __tcRuntime.expectNumber(v, p)]); }); })(obj, path); });
const __parse_8c1c1b2d325f9de6_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.coerceArray(rawQuery, path, (item, itemP) => __tcRuntime.parseUnion(item, itemP, "Type<string|number>", [(v, p) => __tcRuntime.expectString(v, p), (v, p) => __tcRuntime.coerceNumber(v, p)])); });
const __parse_fdba127064c2547c_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.expectNumber(o.id, (path) ? (path) + "." + "id" : "id"), "user": o.user === undefined ? undefined : __tcRuntime.parseUnion(o.user, (path) ? (path) + "." + "user" : "user", "Type<User|undefined>", [(v, p) => (function (v, path) { if (v !== undefined) {
            throw new __tcRuntime.ParseError(path, "Type<undefined>");
        } return v; })(v, p), (v, p) => (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.expectString(o.name, (p) ? (p) + "." + "name" : "name"), "age": __tcRuntime.expectNumber(o.age, (p) ? (p) + "." + "age" : "age") }; return res; })(v, p)]), "tags": (function (arr, p) { __tcRuntime.expectArray(arr, p); return arr.map((item, i) => { const itemP = (p ? p + "[" + i + "]" : "[" + i + "]"); return __tcRuntime.expectString(item, itemP); }); })(o.tags, (path) ? (path) + "." + "tags" : "tags") }; return res; })(obj, path); });
const __parse_fdba127064c2547c_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.coerceNumber(o.id, (path) ? (path) + "." + "id" : "id"), "user": o.user === undefined ? undefined : __tcRuntime.parseUnion(o.user, (path) ? (path) + "." + "user" : "user", "Type<User|undefined>", [(v, p) => (function (v, path) { if (v !== undefined) {
            throw new __tcRuntime.ParseError(path, "Type<undefined>");
        } return v; })(v, p), (v, p) => (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.expectString(o.name, (p) ? (p) + "." + "name" : "name"), "age": __tcRuntime.coerceNumber(o.age, (p) ? (p) + "." + "age" : "age") }; return res; })(v, p)]), "tags": __tcRuntime.coerceArray(o.tags, (path) ? (path) + "." + "tags" : "tags", (item, itemP) => __tcRuntime.expectString(item, itemP)) }; return res; })(rawQuery, path); });
const __parse_f28f8acf7e68cbfd_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.expectString(o.a, (path) ? (path) + "." + "a" : "a"), "b": __tcRuntime.expectNumber(o.b, (path) ? (path) + "." + "b" : "b") }; return res; })(obj, path); });
const __parse_f28f8acf7e68cbfd_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.expectString(o.a, (path) ? (path) + "." + "a" : "a"), "b": __tcRuntime.coerceNumber(o.b, (path) ? (path) + "." + "b" : "b") }; return res; })(rawQuery, path); });
const __parse_85a41b63d9a32b8b_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.parseUnion(rawQuery, path, "Type<\"active\"|\"inactive\">", [(v, p) => (function (v, path) { if (typeof v !== "string") {
        throw new __tcRuntime.ParseError(path, "Literal<'active'>");
    } if (v !== "active") {
        throw new __tcRuntime.ParseError(path, "Literal<'active'>");
    } return v; })(v, p), (v, p) => (function (v, path) { if (typeof v !== "string") {
        throw new __tcRuntime.ParseError(path, "Literal<'inactive'>");
    } if (v !== "inactive") {
        throw new __tcRuntime.ParseError(path, "Literal<'inactive'>");
    } return v; })(v, p)]); });
const __parse_e5da2f9fabafe20e_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.coerceArray(rawQuery, path, (item, itemP) => __tcRuntime.expectString(item, itemP)); });
const __parse_12886f9d00055adf_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.coerceNumber(rawQuery, path); });
const __parse_ced862ef1505bc73_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.coerceBoolean(rawQuery, path); });
const __parse_99c40ab405926cb5_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.coerceDate(rawQuery, path); });
const __parse_eefd1c8d7e793bf3_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (v, path) { if (v instanceof RegExp) {
    return v;
} if (typeof v === "string") {
    const match = v.match(/^\/(.*)\/([gimuy]*)$/);
    if (match) {
        try {
            return new RegExp(match[1], match[2]);
        }
        catch (e) { }
    }
    try {
        return new RegExp(v);
    }
    catch (e) { }
} if (v && typeof v === "object" && typeof v.source === "string") {
    try {
        return new RegExp(v.source, typeof v.flags === "string" ? v.flags : "");
    }
    catch (e) { }
} throw new __tcRuntime.ParseError(path, "Type<RegExp>"); })(rawQuery, path); });
const __parse_75d012fe28656e0a_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.coerceBigInt(rawQuery, path); });
const __parse_91d782a2d0de1354_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.expectString(o.name, (path) ? (path) + "." + "name" : "name"), "active": __tcRuntime.coerceBoolean(o.active, (path) ? (path) + "." + "active" : "active") }; return res; })(rawQuery, path); });
const __parse_affb28566d707e35_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.parseUnion(rawQuery, path, "Type<string|number>", [(v, p) => __tcRuntime.expectString(v, p), (v, p) => __tcRuntime.coerceNumber(v, p)]); });
const __parse_9a141e74a6c02429_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (v, path) { if (typeof v !== "string" || !(new RegExp("^id-[0-9]+(\\.[0-9]+)?$")).test(v)) {
    throw new __tcRuntime.ParseError(path, "`id-${number}`");
} return v; })(rawQuery, path); });
const __parse_e5fc42b4aba2c6d1_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.expectString(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "minLength", "value": 8 }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_a1975336d1e3a054_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceNumber(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "minimum", "value": 18 }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_796c4eac83a7a861_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "val": (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "json"); __v = __tcRuntime.expectNumber(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [], "json"); if (__v !== undefined && __v !== null) {
        {
            const _ctx = { success: true, errors: [], mode: "strict", from: "json", root: root };
            __tcRuntime.validators.custom(__v, p, _ctx, isEvenNumber);
            if (!_ctx.success) {
                throw new __tcRuntime.ParseError(p, (_ctx.errors[0] && _ctx.errors[0].error) || "Custom");
            }
        }
    } return __v; })(o.val, (path) ? (path) + "." + "val" : "val", obj) }; return res; })(obj, path); });
const __parse_796c4eac83a7a861_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "val": (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceNumber(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [], "query"); if (__v !== undefined && __v !== null) {
        {
            const _ctx = { success: true, errors: [], mode: "strict", from: "query", root: root };
            __tcRuntime.validators.custom(__v, p, _ctx, isEvenNumber);
            if (!_ctx.success) {
                throw new __tcRuntime.ParseError(p, (_ctx.errors[0] && _ctx.errors[0].error) || "Custom");
            }
        }
    } return __v; })(o.val, (path) ? (path) + "." + "val" : "val", rawQuery) }; return res; })(rawQuery, path); });
const __parse_36b3db4fc7b251a9_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceNumber(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "exclusiveMinimum", "value": 10 }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_397edf756fbe38e0_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceNumber(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "exclusiveMaximum", "value": 20 }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_a564a7ce790d29ed_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceNumber(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "multipleOf", "value": 5 }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_871344223c5ce37c_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.expectString(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "format", "value": "email" }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_a9030587ebb4386c_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.expectString(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "format", "value": "uuid" }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_a3b8237cd422e3c4_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.expectString(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "format", "value": "date" }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_78d9364193f14947_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "json"); __v = (function (arr, p) { __tcRuntime.expectArray(arr, p); return arr.map((item, i) => { const itemP = (p ? p + "[" + i + "]" : "[" + i + "]"); return __tcRuntime.expectString(item, itemP); }); })(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "minItems", "value": 2 }, { "type": "maxItems", "value": 3 }], "json"); return __v; })(obj, path, obj); });
const __parse_78d9364193f14947_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceArray(__v, p, (item, itemP) => __tcRuntime.expectString(item, itemP)); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "minItems", "value": 2 }, { "type": "maxItems", "value": 3 }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_e932e0ca2e5a5a04_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "json"); __v = (function (arr, p) { __tcRuntime.expectArray(arr, p); return arr.map((item, i) => { const itemP = (p ? p + "[" + i + "]" : "[" + i + "]"); return __tcRuntime.expectNumber(item, itemP); }); })(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "uniqueItems", "value": true }], "json"); return __v; })(obj, path, obj); });
const __parse_e932e0ca2e5a5a04_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (raw, p, root) { let __v = __tcRuntime.applyParseConstraints(raw, p, [], "query"); __v = __tcRuntime.coerceArray(__v, p, (item, itemP) => __tcRuntime.coerceNumber(item, itemP)); __v = __tcRuntime.applyParseConstraints(__v, p, [{ "type": "uniqueItems", "value": true }], "query"); return __v; })(rawQuery, path, rawQuery); });
const __parse_473287f8298dba71_strip_string = (function (input, path = "") { return __tcRuntime.expectString(input, path); });
const __parse_473287f8298dba71_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return __tcRuntime.expectString(rawQuery, path); });
const __parse_0b6ca95199f89861_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.expectNumber(o.a, (path) ? (path) + "." + "a" : "a"), "b": __tcRuntime.expectNumber(o.b, (path) ? (path) + "." + "b" : "b") }; return res; })(obj, path); });
const __parse_0b6ca95199f89861_strip_query = (function (input, path = "") { const rawQuery = (typeof input === "string" ? (/[=%&]/.test(input) ? __tcRuntime.parseQueryString(input) : input) : (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams ? __tcRuntime.parseQueryString(input.toString()) : input)); return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.coerceNumber(o.a, (path) ? (path) + "." + "a" : "a"), "b": __tcRuntime.coerceNumber(o.b, (path) ? (path) + "." + "b" : "b") }; return res; })(rawQuery, path); });
const __parse_473287f8298dba71_strip_json = (function (input, path = "") { let obj; if (typeof input === "string") {
    const t = input.trim();
    if (t.startsWith("{") || t.startsWith("[") || t.startsWith("\"") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
        try {
            obj = JSON.parse(input);
        }
        catch (e) {
            throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
        }
    }
    else {
        obj = input;
    }
}
else {
    obj = input;
} return __tcRuntime.expectString(obj, path); });
const __parse_12886f9d00055adf_strip_string = (function (input, path = "") { return __tcRuntime.coerceNumber(input, path); });
const __ser_c67915707769fcf5_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "data.name")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("data.age", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(obj.data)); return "{" + parts.join(",") + "}"; })(input); });
const __ser_a068761681a0a813_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + (function (val) { switch (val["type"]) {
    case "simple": return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        throw new __tcRuntime.SerializationError("data", "Type<Object>");
    } let parts = []; parts.push("\"type\":" + (obj.type === "simple" ? "\"simple\"" : (function () { throw new __tcRuntime.SerializationError("data.type", "Literal<'simple'>"); })())); parts.push("\"val\":" + __tcRuntime.serializeString(obj.val, "data.val")); return "{" + parts.join(",") + "}"; })(obj.data);
    case "complex": return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        throw new __tcRuntime.SerializationError("data", "Type<Object>");
    } let parts = []; parts.push("\"type\":" + (obj.type === "complex" ? "\"complex\"" : (function () { throw new __tcRuntime.SerializationError("data.type", "Literal<'complex'>"); })())); parts.push("\"data\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        throw new __tcRuntime.SerializationError("data.data", "Type<Object>");
    } let parts = []; parts.push("\"id\":" + (typeof obj.id === "number" && !Number.isNaN(obj.id) ? String(obj.id) : (function () { throw new __tcRuntime.SerializationError("data.data.id", "Type<number>"); })())); parts.push("\"tags\":" + __tcRuntime.serializeArray(obj.tags, item => __tcRuntime.serializeString(item, "data.data.tags[]"), "data.data.tags")); return "{" + parts.join(",") + "}"; })(obj.data)); return "{" + parts.join(",") + "}"; })(obj.data);
    default: throw new __tcRuntime.SerializationError("data", "Type<MyUnion>");
} })(obj.data)); return "{" + parts.join(",") + "}"; })(input); });
const __ser_2d6ea820a293bacf_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"s\":" + __tcRuntime.serializeUnion(obj.s, "s", "Type<Status>", [val => (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        throw new __tcRuntime.SerializationError("s", "Type<Object>");
    } let parts = []; parts.push("\"reason\":" + __tcRuntime.serializeString(obj.reason, "s.reason")); return "{" + parts.join(",") + "}"; })(val), val => (val === "active" ? "\"active\"" : (function () { throw new __tcRuntime.SerializationError("s", "Literal<'active'>"); })()), val => (val === "inactive" ? "\"inactive\"" : (function () { throw new __tcRuntime.SerializationError("s", "Literal<'inactive'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_a042f9877fc2376a_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + __tcRuntime.serializeArray(obj.data, item => __tcRuntime.serializeUnion(item, "data[]", "Type<string|number>", [val => __tcRuntime.serializeString(val, "data[]"), val => (typeof val === "number" && !Number.isNaN(val) ? String(val) : (function () { throw new __tcRuntime.SerializationError("data[]", "Type<number>"); })())]), "data")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_d0b53ff733685c2c_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"id\":" + (typeof obj.id === "number" && !Number.isNaN(obj.id) ? String(obj.id) : (function () { throw new __tcRuntime.SerializationError("data.id", "Type<number>"); })())); if (obj.user !== undefined) {
    parts.push("\"user\":" + __tcRuntime.serializeUnion(obj.user, "data.user", "Type<User|undefined>", [val => (val === undefined ? "null" : (function () { throw new __tcRuntime.SerializationError("data.user", "Type<undefined>"); })()), val => (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
            throw new __tcRuntime.SerializationError("data.user", "Type<Object>");
        } let parts = []; parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "data.user.name")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("data.user.age", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(val)]));
} parts.push("\"tags\":" + __tcRuntime.serializeArray(obj.tags, item => __tcRuntime.serializeString(item, "data.tags[]"), "data.tags")); return "{" + parts.join(",") + "}"; })(obj.data)); return "{" + parts.join(",") + "}"; })(input); });
const __ser_0d157d33684c0018_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"a\":" + __tcRuntime.serializeString(obj.a, "data.a")); parts.push("\"b\":" + (typeof obj.b === "number" && !Number.isNaN(obj.b) ? String(obj.b) : (function () { throw new __tcRuntime.SerializationError("data.b", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(obj.data)); return "{" + parts.join(",") + "}"; })(input); });
const __ser_0084393b0d7248e4_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"status\":" + __tcRuntime.serializeUnion(obj.status, "status", "Type<\"active\"|\"inactive\">", [val => (val === "active" ? "\"active\"" : (function () { throw new __tcRuntime.SerializationError("status", "Literal<'active'>"); })()), val => (val === "inactive" ? "\"inactive\"" : (function () { throw new __tcRuntime.SerializationError("status", "Literal<'inactive'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_d9bb28ea073c815e_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"tags\":" + __tcRuntime.serializeArray(obj.tags, item => __tcRuntime.serializeString(item, "tags[]"), "tags")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_0dcd607745c5cb3e_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })())); parts.push("\"active\":" + (typeof obj.active === "boolean" ? (obj.active ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("active", "Type<boolean>"); })())); parts.push("\"date\":" + __tcRuntime.serializeString(obj.date, "date")); parts.push("\"pattern\":" + __tcRuntime.serializeString(obj.pattern, "pattern")); parts.push("\"big\":" + __tcRuntime.serializeString(obj.big, "big")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_4ac5d9e4f4205e53_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"user\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("user", "Type<Object>");
} let parts = []; parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "user.name")); parts.push("\"active\":" + (typeof obj.active === "boolean" ? (obj.active ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("user.active", "Type<boolean>"); })())); return "{" + parts.join(",") + "}"; })(obj.user)); return "{" + parts.join(",") + "}"; })(input); });
const __ser_87e266a791052d41_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"val\":" + __tcRuntime.serializeUnion(obj.val, "val", "Type<string|number>", [val => __tcRuntime.serializeString(val, "val"), val => (typeof val === "number" && !Number.isNaN(val) ? String(val) : (function () { throw new __tcRuntime.SerializationError("val", "Type<number>"); })())])); parts.push("\"type\":" + __tcRuntime.serializeUnion(obj.type, "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val => (val === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()), val => (val === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()), val => (val === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()), val => (val === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()), val => (val === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()), val => (val === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()), val => (val === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()), val => (val === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_6b50e5736cb6bb55_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"id\":" + __tcRuntime.serializeString(obj.id, "id")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_68075fba117f092a_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"pass\":" + __tcRuntime.serializeString(obj.pass, "pass")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(input); });
const __ser_4a8765d306ac1e9b_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"val\":" + (typeof obj.val === "number" && !Number.isNaN(obj.val) ? String(obj.val) : (function () { throw new __tcRuntime.SerializationError("data.val", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(obj.data)); return "{" + parts.join(",") + "}"; })(input); });
const __ser_b237870e8da1ad64_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"message\":" + __tcRuntime.serializeString(obj.message, "message")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_fb804057ab9cb051_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"min\":" + (typeof obj.min === "number" && !Number.isNaN(obj.min) ? String(obj.min) : (function () { throw new __tcRuntime.SerializationError("min", "Type<number>"); })())); parts.push("\"max\":" + (typeof obj.max === "number" && !Number.isNaN(obj.max) ? String(obj.max) : (function () { throw new __tcRuntime.SerializationError("max", "Type<number>"); })())); parts.push("\"mult\":" + (typeof obj.mult === "number" && !Number.isNaN(obj.mult) ? String(obj.mult) : (function () { throw new __tcRuntime.SerializationError("mult", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(input); });
const __ser_a744c47def1902a9_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"email\":" + __tcRuntime.serializeString(obj.email, "email")); parts.push("\"uuid\":" + __tcRuntime.serializeString(obj.uuid, "uuid")); parts.push("\"date\":" + __tcRuntime.serializeString(obj.date, "date")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_78d9364193f14947_strip_json = (function (input) { return __tcRuntime.serializeArray(input, item => __tcRuntime.serializeString(item, "[]"), ""); });
const __ser_e932e0ca2e5a5a04_strip_json = (function (input) { return __tcRuntime.serializeArray(input, item => (typeof item === "number" && !Number.isNaN(item) ? String(item) : (function () { throw new __tcRuntime.SerializationError("[]", "Type<number>"); })()), ""); });
const __ser_473287f8298dba71_strip_json = (function (input) { return __tcRuntime.serializeString(input, ""); });
const __ser_263dff44d887120e_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"msg\":" + __tcRuntime.serializeString(obj.msg, "msg")); parts.push("\"dbUrl\":" + __tcRuntime.serializeString(obj.dbUrl, "dbUrl")); parts.push("\"logged\":" + __tcRuntime.serializeString(obj.logged, "logged")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_ab68d46bd18d4a0a_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"dbUrl\":" + __tcRuntime.serializeString(obj.dbUrl, "dbUrl")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_e955dd67e417e2f5_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); return "{" + parts.join(",") + "}"; })(input); });
const __ser_07a8cc3cc8aea7a1_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"val\":" + (typeof obj.val === "number" && !Number.isNaN(obj.val) ? String(obj.val) : (function () { throw new __tcRuntime.SerializationError("val", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(input); });
const __ser_07a8cc3cc8aea7a1_strict_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; const __keys = new Set(["val"]); parts.push("\"val\":" + (typeof obj.val === "number" && !Number.isNaN(obj.val) ? String(obj.val) : (function () { throw new __tcRuntime.SerializationError("val", "Type<number>"); })())); for (const k in obj) {
    if (!__keys.has(k) && obj[k] !== undefined) {
        throw new __tcRuntime.SerializationError("", "PropertyNotAllowed<" + k + ">");
    }
} return "{" + parts.join(",") + "}"; })(input); });
const __ser_12886f9d00055adf_strip_json = (function (input) { return (typeof input === "number" && !Number.isNaN(input) ? String(input) : (function () { throw new __tcRuntime.SerializationError("", "Type<number>"); })()); });
const __ser_04c78f82f98a8cf4_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "name")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(input); });
const __ser_04c78f82f98a8cf4_strict_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; const __keys = new Set(["name", "age"]); parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "name")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })())); for (const k in obj) {
    if (!__keys.has(k) && obj[k] !== undefined) {
        throw new __tcRuntime.SerializationError("", "PropertyNotAllowed<" + k + ">");
    }
} return "{" + parts.join(",") + "}"; })(input); });
const __ser_04c78f82f98a8cf4_relaxed_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; const __keys = new Set(["name", "age"]); parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "name")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })())); for (const k in obj) {
    if (!__keys.has(k) && obj[k] !== undefined) {
        parts.push(JSON.stringify(k) + ":" + JSON.stringify(obj[k]));
    }
} return "{" + parts.join(",") + "}"; })(input); });
const __ser_d78a5e9e3b797aa6_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"one\":" + __tcRuntime.serializeUnion(obj.one, "one", "Type<string|null>", [val => (val === null ? "null" : (function () { throw new __tcRuntime.SerializationError("one", "Type<null>"); })()), val => __tcRuntime.serializeString(val, "one")])); parts.push("\"two\":" + __tcRuntime.serializeUnion(obj.two, "two", "Type<string|null>", [val => (val === null ? "null" : (function () { throw new __tcRuntime.SerializationError("two", "Type<null>"); })()), val => __tcRuntime.serializeString(val, "two")])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_3854fe5bb34caec3_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"id\":" + __tcRuntime.serializeString(obj.id, "id")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_10fc726648976d5a_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"secret\":" + (typeof obj.secret === "boolean" ? (obj.secret ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("secret", "Type<boolean>"); })())); return "{" + parts.join(",") + "}"; })(input); });
const __ser_1cf64ebdd7fe6766_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"id\":" + __tcRuntime.serializeString(obj.id, "id")); parts.push("\"type\":" + __tcRuntime.serializeUnion(obj.type, "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val => (val === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()), val => (val === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()), val => (val === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()), val => (val === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()), val => (val === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()), val => (val === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()), val => (val === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()), val => (val === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_ad7cc50180a59d88_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"n\":" + (typeof obj.n === "number" && !Number.isNaN(obj.n) ? String(obj.n) : (function () { throw new __tcRuntime.SerializationError("n", "Type<number>"); })())); parts.push("\"type\":" + __tcRuntime.serializeUnion(obj.type, "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val => (val === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()), val => (val === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()), val => (val === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()), val => (val === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()), val => (val === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()), val => (val === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()), val => (val === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()), val => (val === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_592aa28226ef808b_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"token\":" + __tcRuntime.serializeString(obj.token, "token")); parts.push("\"type\":" + __tcRuntime.serializeUnion(obj.type, "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val => (val === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()), val => (val === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()), val => (val === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()), val => (val === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()), val => (val === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()), val => (val === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()), val => (val === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()), val => (val === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_c73a5cfb4b62c0e6_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"session\":" + __tcRuntime.serializeString(obj.session, "session")); parts.push("\"type\":" + __tcRuntime.serializeUnion(obj.type, "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val => (val === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()), val => (val === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()), val => (val === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()), val => (val === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()), val => (val === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()), val => (val === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()), val => (val === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()), val => (val === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
const __ser_f0f7a2626b66a4d9_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"attachmentId\":" + __tcRuntime.serializeString(obj.attachmentId, "attachmentId")); parts.push("\"token\":" + __tcRuntime.serializeString(obj.token, "token")); parts.push("\"flag\":" + __tcRuntime.serializeString(obj.flag, "flag")); return "{" + parts.join(",") + "}"; })(input); });
const __ser_4b3ffd86cc4f9e24_strip_json = (function (input) { return (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (typeof obj.success === "boolean" ? (obj.success ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })())); parts.push("\"data\":" + (function (obj) { if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"name\":" + __tcRuntime.serializeString(obj.name, "data.name")); parts.push("\"age\":" + (typeof obj.age === "number" && !Number.isNaN(obj.age) ? String(obj.age) : (function () { throw new __tcRuntime.SerializationError("data.age", "Type<number>"); })())); return "{" + parts.join(",") + "}"; })(obj.data)); parts.push("\"ageType\":" + __tcRuntime.serializeUnion(obj.ageType, "ageType", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val => (val === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'string'>"); })()), val => (val === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'number'>"); })()), val => (val === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'bigint'>"); })()), val => (val === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'boolean'>"); })()), val => (val === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'symbol'>"); })()), val => (val === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'undefined'>"); })()), val => (val === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'object'>"); })()), val => (val === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'function'>"); })())])); return "{" + parts.join(",") + "}"; })(input); });
import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Ws, Sse, Param, Header, Cookie, MessagePattern, EventPattern, Payload, Head, Options, All, ResponseMode, Unprotect, Unintercept, Use, OverrideUse, Unuse, Public, Seo, Internal } from '../../src/index.js';
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
        req.headers['x-middleware-one'] = 'active';
        res.header('x-middleware-res-one', 'response-active');
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
        req.headers['x-middleware-two'] = 'callback-active';
        res.header('x-middleware-res-two', 'response-callback-active');
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
        const one = req.headers['x-middleware-one'];
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
            one: req.headers['x-middleware-one'] ?? null,
            two: req.headers['x-middleware-two'] ?? null
        };
    }
    override(req) {
        return {
            one: req.headers['x-middleware-one'] ?? null,
            two: req.headers['x-middleware-two'] ?? null
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
            one: req.headers['x-middleware-one'] ?? null,
            two: req.headers['x-middleware-two'] ?? null
        };
    }
    removeAll(req) {
        return {
            one: req.headers['x-middleware-one'] ?? null,
            two: req.headers['x-middleware-two'] ?? null
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
let SeoEmitController = class SeoEmitController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    blog(slug) {
        if (slug === 'miss') {
            return;
        }
        return { method: 'GET', path: `/seo/posts/${slug}` };
    }
};
__decorate([
    Get('/seo/blog/:slug'),
    __param(0, Param('slug'))
], SeoEmitController.prototype, "blog", null);
SeoEmitController = __decorate([
    Controller(),
    Seo
], SeoEmitController);
export { SeoEmitController };
let SeoTargetController = class SeoTargetController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    show(id) {
        return { id };
    }
};
__decorate([
    Get('/seo/posts/:id'),
    __param(0, Param('id'))
], SeoTargetController.prototype, "show", null);
SeoTargetController = __decorate([
    Controller()
], SeoTargetController);
export { SeoTargetController };
let InternalEmitController = class InternalEmitController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    secret() {
        return { secret: true };
    }
};
__decorate([
    Get('/_internal/seo-secret')
], InternalEmitController.prototype, "secret", null);
InternalEmitController = __decorate([
    Controller(),
    Internal
], InternalEmitController);
export { InternalEmitController };
let SeoToInternalController = class SeoToInternalController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    go() {
        return { method: 'GET', path: '/_internal/seo-secret' };
    }
};
__decorate([
    Get('/seo/pretty')
], SeoToInternalController.prototype, "go", null);
SeoToInternalController = __decorate([
    Controller(),
    Seo
], SeoToInternalController);
export { SeoToInternalController };
/**
 * Exercises AOT `from: 'string'` parsers for Param / Header / Cookie
 * (no parseQueryString) and typed urlencoded Body via `parserQuery`.
 */
let ScalarWireController = class ScalarWireController {
    static __injections__ = {
        constructorDeps: [],
        propertyDeps: {}
    };
    paramId(id) {
        return { id, type: typeof id };
    }
    paramNum(n) {
        return { n, type: typeof n };
    }
    headerToken(token) {
        return { token, type: typeof token };
    }
    cookieSession(session) {
        return { session, type: typeof session };
    }
    combo(attachmentId, token, flag) {
        return { attachmentId, token, flag };
    }
    form(data) {
        return { success: true, data, ageType: typeof data.age };
    }
};
__decorate([
    Get('/param/:id'),
    __param(0, Param('id'))
], ScalarWireController.prototype, "paramId", null);
__decorate([
    Get('/param-num/:n'),
    __param(0, Param('n'))
], ScalarWireController.prototype, "paramNum", null);
__decorate([
    Get('/header'),
    __param(0, Header('x-token'))
], ScalarWireController.prototype, "headerToken", null);
__decorate([
    Get('/cookie'),
    __param(0, Cookie('session'))
], ScalarWireController.prototype, "cookieSession", null);
__decorate([
    Get('/combo/:attachmentId'),
    __param(0, Param('attachmentId')),
    __param(1, Header('x-token')),
    __param(2, Cookie('flag'))
], ScalarWireController.prototype, "combo", null);
__decorate([
    Post('/form'),
    __param(0, Body())
], ScalarWireController.prototype, "form", null);
ScalarWireController = __decorate([
    Controller('/scalar-wire')
], ScalarWireController);
export { ScalarWireController };
DiGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "DiGuard"
};
DiGuard[Symbol.for("webergency.server.guard")] = {
    params: [{
            source: "Inject",
            name: "DatabaseService",
            validator: "",
            mode: undefined
        }],
    isAsync: false
};
SimpleGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "SimpleGuard"
};
SimpleGuard[Symbol.for("webergency.server.guard")] = {
    params: [],
    isAsync: false
};
AnotherGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "AnotherGuard"
};
AnotherGuard[Symbol.for("webergency.server.guard")] = {
    params: [],
    isAsync: false
};
SimpleTestMiddleware[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "SimpleTestMiddleware"
};
SimpleTestMiddleware[Symbol.for("webergency.server.guard")] = {
    params: [{
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }, {
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }],
    isAsync: false
};
MiddlewareCheckingGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "MiddlewareCheckingGuard"
};
MiddlewareCheckingGuard[Symbol.for("webergency.server.guard")] = {
    params: [{
            source: "Request",
            name: "",
            validator: "",
            mode: undefined
        }],
    isAsync: false
};
FailingGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "FailingGuard"
};
FailingGuard[Symbol.for("webergency.server.guard")] = {
    params: [],
    isAsync: false
};
PublicDenyGuard[Symbol.for("webergency.server.injectable")] = {
    kind: "guard",
    token: "PublicDenyGuard"
};
PublicDenyGuard[Symbol.for("webergency.server.guard")] = {
    params: [],
    isAsync: false
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
                    parser: __parse_04c78f82f98a8cf4_strict_json,
                    parserQuery: __parse_04c78f82f98a8cf4_strict_query,
                    validator: __val_04c78f82f98a8cf4,
                    mode: "strict"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_c67915707769fcf5,
            returnTypeSerializer: __ser_c67915707769fcf5_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "strictIntercepted",
            httpMethod: "POST",
            path: "/type-safety/strict-intercepted",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_04c78f82f98a8cf4_strict_json,
                    parserQuery: __parse_04c78f82f98a8cf4_strict_query,
                    validator: __val_04c78f82f98a8cf4,
                    mode: "strict"
                }],
            guards: [],
            interceptors: ["GlobalErrorSanitizer"],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_c67915707769fcf5,
            returnTypeSerializer: __ser_c67915707769fcf5_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "strip",
            httpMethod: "POST",
            path: "/type-safety/strip",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_04c78f82f98a8cf4_strip_json,
                    parserQuery: __parse_04c78f82f98a8cf4_strip_query,
                    validator: __val_04c78f82f98a8cf4,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_c67915707769fcf5,
            returnTypeSerializer: __ser_c67915707769fcf5_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "relaxed",
            httpMethod: "POST",
            path: "/type-safety/relaxed",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_04c78f82f98a8cf4_relaxed_json,
                    parserQuery: __parse_04c78f82f98a8cf4_relaxed_query,
                    validator: __val_04c78f82f98a8cf4,
                    mode: "relaxed"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_c67915707769fcf5,
            returnTypeSerializer: __ser_c67915707769fcf5_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "union",
            httpMethod: "POST",
            path: "/type-safety/union",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_0b60aa399d818c05_strip_json,
                    parserQuery: __parse_0b60aa399d818c05_strip_query,
                    validator: __val_0b60aa399d818c05,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_a068761681a0a813,
            returnTypeSerializer: __ser_a068761681a0a813_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "status",
            httpMethod: "GET",
            path: "/type-safety/status",
            params: [{
                    source: "Query",
                    name: "s",
                    parser: __parse_857204a536cb022c_strip_query,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_2d6ea820a293bacf,
            returnTypeSerializer: __ser_2d6ea820a293bacf_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "mixedArray",
            httpMethod: "POST",
            path: "/type-safety/mixed-array",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_8c1c1b2d325f9de6_strip_json,
                    parserQuery: __parse_8c1c1b2d325f9de6_strip_query,
                    validator: __val_8c1c1b2d325f9de6,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_a042f9877fc2376a,
            returnTypeSerializer: __ser_a042f9877fc2376a_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "nested",
            httpMethod: "POST",
            path: "/type-safety/nested",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_fdba127064c2547c_strip_json,
                    parserQuery: __parse_fdba127064c2547c_strip_query,
                    validator: __val_fdba127064c2547c,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_d0b53ff733685c2c,
            returnTypeSerializer: __ser_d0b53ff733685c2c_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "intersection",
            httpMethod: "POST",
            path: "/type-safety/intersection",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_f28f8acf7e68cbfd_strip_json,
                    parserQuery: __parse_f28f8acf7e68cbfd_strip_query,
                    validator: __val_f28f8acf7e68cbfd,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_0d157d33684c0018,
            returnTypeSerializer: __ser_0d157d33684c0018_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "queryUnion",
            httpMethod: "GET",
            path: "/type-safety/query-union",
            params: [{
                    source: "Query",
                    name: "status",
                    parser: __parse_85a41b63d9a32b8b_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_0084393b0d7248e4,
            returnTypeSerializer: __ser_0084393b0d7248e4_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "arrayQuery",
            httpMethod: "GET",
            path: "/type-safety/array-query",
            params: [{
                    source: "Query",
                    name: "tags",
                    parser: __parse_e5da2f9fabafe20e_strip_query,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_d9bb28ea073c815e,
            returnTypeSerializer: __ser_d9bb28ea073c815e_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "coerce",
            httpMethod: "GET",
            path: "/type-safety/coerce",
            params: [{
                    source: "Query",
                    name: "age",
                    parser: __parse_12886f9d00055adf_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "active",
                    parser: __parse_ced862ef1505bc73_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "date",
                    parser: __parse_99c40ab405926cb5_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "pattern",
                    parser: __parse_eefd1c8d7e793bf3_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "big",
                    parser: __parse_75d012fe28656e0a_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_0dcd607745c5cb3e,
            returnTypeSerializer: __ser_0dcd607745c5cb3e_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "deepBoolean",
            httpMethod: "GET",
            path: "/type-safety/deep-boolean",
            params: [{
                    source: "Query",
                    name: "user",
                    parser: __parse_91d782a2d0de1354_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_4ac5d9e4f4205e53,
            returnTypeSerializer: __ser_4ac5d9e4f4205e53_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "coerceUnion",
            httpMethod: "GET",
            path: "/type-safety/coerce-union",
            params: [{
                    source: "Query",
                    name: "val",
                    parser: __parse_affb28566d707e35_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_87e266a791052d41,
            returnTypeSerializer: __ser_87e266a791052d41_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "templateLiteral",
            httpMethod: "GET",
            path: "/type-safety/template-literal",
            params: [{
                    source: "Query",
                    name: "id",
                    parser: __parse_9a141e74a6c02429_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_6b50e5736cb6bb55,
            returnTypeSerializer: __ser_6b50e5736cb6bb55_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "tags",
            httpMethod: "GET",
            path: "/type-safety/tags",
            params: [{
                    source: "Query",
                    name: "pass",
                    parser: __parse_e5fc42b4aba2c6d1_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "age",
                    parser: __parse_a1975336d1e3a054_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_68075fba117f092a,
            returnTypeSerializer: __ser_68075fba117f092a_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "customValidator",
            httpMethod: "POST",
            path: "/type-safety/custom-validator",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_796c4eac83a7a861_strip_json,
                    parserQuery: __parse_796c4eac83a7a861_strip_query,
                    validator: __val_796c4eac83a7a861,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_4a8765d306ac1e9b,
            returnTypeSerializer: __ser_4a8765d306ac1e9b_strip_json
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
            returnTypeValidator: __val_b237870e8da1ad64,
            returnTypeSerializer: __ser_b237870e8da1ad64_strip_json
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
            returnTypeValidator: __val_b237870e8da1ad64,
            returnTypeSerializer: __ser_b237870e8da1ad64_strip_json
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
            returnTypeValidator: __val_b237870e8da1ad64,
            returnTypeSerializer: __ser_b237870e8da1ad64_strip_json
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
                    parser: __parse_36b3db4fc7b251a9_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "max",
                    parser: __parse_397edf756fbe38e0_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "mult",
                    parser: __parse_a564a7ce790d29ed_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_fb804057ab9cb051,
            returnTypeSerializer: __ser_fb804057ab9cb051_strip_json
        },
        {
            controller: "TagParityController",
            methodName: "getString",
            httpMethod: "GET",
            path: "/tag-parity/string",
            params: [{
                    source: "Query",
                    name: "email",
                    parser: __parse_871344223c5ce37c_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "uuid",
                    parser: __parse_a9030587ebb4386c_strip_query,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "date",
                    parser: __parse_a3b8237cd422e3c4_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_a744c47def1902a9,
            returnTypeSerializer: __ser_a744c47def1902a9_strip_json
        },
        {
            controller: "TagParityController",
            methodName: "postArray",
            httpMethod: "POST",
            path: "/tag-parity/array",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_78d9364193f14947_strip_json,
                    parserQuery: __parse_78d9364193f14947_strip_query,
                    validator: __val_78d9364193f14947,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_78d9364193f14947,
            returnTypeSerializer: __ser_78d9364193f14947_strip_json
        },
        {
            controller: "TagParityController",
            methodName: "postUniqueArray",
            httpMethod: "POST",
            path: "/tag-parity/unique-array",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_e932e0ca2e5a5a04_strip_json,
                    parserQuery: __parse_e932e0ca2e5a5a04_strip_query,
                    validator: __val_e932e0ca2e5a5a04,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_e932e0ca2e5a5a04,
            returnTypeSerializer: __ser_e932e0ca2e5a5a04_strip_json
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
            returnTypeSerializer: __ser_473287f8298dba71_strip_json,
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
            returnTypeSerializer: __ser_473287f8298dba71_strip_json,
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
            returnTypeSerializer: __ser_473287f8298dba71_strip_json,
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
            returnTypeSerializer: __ser_473287f8298dba71_strip_json,
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
            returnTypeValidator: __val_263dff44d887120e,
            returnTypeSerializer: __ser_263dff44d887120e_strip_json
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
            returnTypeValidator: __val_ab68d46bd18d4a0a,
            returnTypeSerializer: __ser_ab68d46bd18d4a0a_strip_json
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
            returnTypeValidator: __val_e955dd67e417e2f5,
            returnTypeSerializer: __ser_e955dd67e417e2f5_strip_json
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
            returnTypeValidator: __val_e955dd67e417e2f5,
            returnTypeSerializer: __ser_e955dd67e417e2f5_strip_json
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
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "token",
                    parser: __parse_473287f8298dba71_strip_query,
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
            returnTypeValidator: __val_07a8cc3cc8aea7a1,
            returnTypeSerializer: __ser_07a8cc3cc8aea7a1_strip_json
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
            returnTypeValidator: __val_07a8cc3cc8aea7a1,
            returnTypeSerializer: __ser_07a8cc3cc8aea7a1_strip_json
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
            returnTypeValidator: __val_07a8cc3cc8aea7a1,
            returnTypeSerializer: __ser_07a8cc3cc8aea7a1_strict_json
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
                    parser: __parse_0b6ca95199f89861_strip_json,
                    parserQuery: __parse_0b6ca95199f89861_strip_query,
                    validator: __val_0b6ca95199f89861,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {
                rpc: true
            },
            returnTypeValidator: __val_12886f9d00055adf,
            returnTypeSerializer: __ser_12886f9d00055adf_strip_json
        },
        {
            controller: "MathMicroserviceController",
            methodName: "greet",
            httpMethod: "RPC",
            path: "math.greet",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_473287f8298dba71_strip_json,
                    parserQuery: __parse_473287f8298dba71_strip_query,
                    validator: __val_473287f8298dba71,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {
                rpc: true
            },
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
        },
        {
            controller: "MathMicroserviceController",
            methodName: "notify",
            httpMethod: "RPC",
            path: "logs.notify",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_473287f8298dba71_strip_json,
                    parserQuery: __parse_473287f8298dba71_strip_query,
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
        },
        {
            controller: "ReturnTypeController",
            methodName: "getInferredBranch",
            httpMethod: "GET",
            path: "/return-type/inferred-branch",
            params: [{
                    source: "Query",
                    name: "branch",
                    parser: __parse_473287f8298dba71_strip_query,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strip_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strict_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_relaxed_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_relaxed_json
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
            returnTypeValidator: __val_04c78f82f98a8cf4,
            returnTypeSerializer: __ser_04c78f82f98a8cf4_strict_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_d78a5e9e3b797aa6,
            returnTypeSerializer: __ser_d78a5e9e3b797aa6_strip_json
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
            returnTypeValidator: __val_d78a5e9e3b797aa6,
            returnTypeSerializer: __ser_d78a5e9e3b797aa6_strip_json
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
            returnTypeValidator: __val_d78a5e9e3b797aa6,
            returnTypeSerializer: __ser_d78a5e9e3b797aa6_strip_json
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
            returnTypeValidator: __val_d78a5e9e3b797aa6,
            returnTypeSerializer: __ser_d78a5e9e3b797aa6_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
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
            returnTypeValidator: __val_473287f8298dba71,
            returnTypeSerializer: __ser_473287f8298dba71_strip_json
        }
    ]
};
MethodPublicController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "MethodPublicController"
};
SeoEmitController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
            controller: "SeoEmitController",
            methodName: "blog",
            httpMethod: "GET",
            path: "/seo/blog/:slug",
            params: [{
                    source: "Param",
                    name: "slug",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            seo: true
        }
    ]
};
SeoEmitController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "SeoEmitController"
};
SeoTargetController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
            controller: "SeoTargetController",
            methodName: "show",
            httpMethod: "GET",
            path: "/seo/posts/:id",
            params: [{
                    source: "Param",
                    name: "id",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_3854fe5bb34caec3,
            returnTypeSerializer: __ser_3854fe5bb34caec3_strip_json
        }
    ]
};
SeoTargetController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "SeoTargetController"
};
InternalEmitController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
            controller: "InternalEmitController",
            methodName: "secret",
            httpMethod: "GET",
            path: "/_internal/seo-secret",
            params: [],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_10fc726648976d5a,
            returnTypeSerializer: __ser_10fc726648976d5a_strip_json,
            internal: true
        }
    ]
};
InternalEmitController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "InternalEmitController"
};
SeoToInternalController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
            controller: "SeoToInternalController",
            methodName: "go",
            httpMethod: "GET",
            path: "/seo/pretty",
            params: [],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            seo: true
        }
    ]
};
SeoToInternalController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "SeoToInternalController"
};
ScalarWireController[Symbol.for("webergency.server.controller")] = {
    endpoints: [
        {
            controller: "ScalarWireController",
            methodName: "paramId",
            httpMethod: "GET",
            path: "/scalar-wire/param/:id",
            params: [{
                    source: "Param",
                    name: "id",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_1cf64ebdd7fe6766,
            returnTypeSerializer: __ser_1cf64ebdd7fe6766_strip_json
        },
        {
            controller: "ScalarWireController",
            methodName: "paramNum",
            httpMethod: "GET",
            path: "/scalar-wire/param-num/:n",
            params: [{
                    source: "Param",
                    name: "n",
                    parser: __parse_12886f9d00055adf_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_ad7cc50180a59d88,
            returnTypeSerializer: __ser_ad7cc50180a59d88_strip_json
        },
        {
            controller: "ScalarWireController",
            methodName: "headerToken",
            httpMethod: "GET",
            path: "/scalar-wire/header",
            params: [{
                    source: "Header",
                    name: "x-token",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_592aa28226ef808b,
            returnTypeSerializer: __ser_592aa28226ef808b_strip_json
        },
        {
            controller: "ScalarWireController",
            methodName: "cookieSession",
            httpMethod: "GET",
            path: "/scalar-wire/cookie",
            params: [{
                    source: "Cookie",
                    name: "session",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_c73a5cfb4b62c0e6,
            returnTypeSerializer: __ser_c73a5cfb4b62c0e6_strip_json
        },
        {
            controller: "ScalarWireController",
            methodName: "combo",
            httpMethod: "GET",
            path: "/scalar-wire/combo/:attachmentId",
            params: [{
                    source: "Param",
                    name: "attachmentId",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }, {
                    source: "Header",
                    name: "x-token",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }, {
                    source: "Cookie",
                    name: "flag",
                    parser: __parse_473287f8298dba71_strip_string,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_f0f7a2626b66a4d9,
            returnTypeSerializer: __ser_f0f7a2626b66a4d9_strip_json
        },
        {
            controller: "ScalarWireController",
            methodName: "form",
            httpMethod: "POST",
            path: "/scalar-wire/form",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_04c78f82f98a8cf4_strip_json,
                    parserQuery: __parse_04c78f82f98a8cf4_strip_query,
                    validator: __val_04c78f82f98a8cf4,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_4b3ffd86cc4f9e24,
            returnTypeSerializer: __ser_4b3ffd86cc4f9e24_strip_json
        }
    ]
};
ScalarWireController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "ScalarWireController"
};
