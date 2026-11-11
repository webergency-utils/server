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
const __val_473287f8298dba71 = (v, path, ctx) => { v = validators.string(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "string"); return v; };
const __val_12886f9d00055adf = (v, path, ctx) => { v = validators.number(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "number"); return v; };
const __val_dabac2963e974f00 = ((keys, props) => (v, path, ctx) => {
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
const __val_ced862ef1505bc73 = (v, path, ctx) => { v = validators.boolean(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "boolean"); return v; };
const __val_27c76be1e0e096f7 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: User; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_dabac2963e974f00]
]);
const __val_dbfa74f859de2e1c = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "simple"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_87e21e8a57abcea1 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ type: \"simple\"; val: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["type", "val"]), [
    ["type", false, __val_dbfa74f859de2e1c],
    ["val", false, __val_473287f8298dba71]
]);
const __val_55478cf778fc73ee = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "complex"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_e5da2f9fabafe20e = (v, path, ctx) => validators.array(v, path, ctx, __val_473287f8298dba71);
const __val_7f3661a4a0ca561d = ((keys, props) => (v, path, ctx) => {
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
const __val_0b7614ea6f9c5afb = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ type: \"complex\"; data: { id: number; tags: string[]; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["type", "data"]), [
    ["type", false, __val_55478cf778fc73ee],
    ["data", false, __val_7f3661a4a0ca561d]
]);
const __val_00dfa6d2fd9beb5b = (byTag => (v, path, ctx) => validators.taggedUnion(v, path, ctx, "type", byTag, "Type<MyUnion>"))(new Map([
    ["simple", __val_87e21e8a57abcea1],
    ["complex", __val_0b7614ea6f9c5afb]
]));
const __val_82a24480723392cb = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: MyUnion; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_00dfa6d2fd9beb5b]
]);
const __val_efae10e7246fd0c1 = ((keys, props) => (v, path, ctx) => {
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
const __val_ea6ff166f61d40f9 = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "active"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_3b0c16083099d1a2 = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "inactive"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_67e1eeb32ffa1ff1 = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<Status>"))([__val_efae10e7246fd0c1, __val_ea6ff166f61d40f9, __val_3b0c16083099d1a2]);
const __val_2a16b9d77104981c = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; s: Status; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "s"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["s", false, __val_67e1eeb32ffa1ff1]
]);
const __val_e04b035e41fab592 = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<string|number>"))([__val_473287f8298dba71, __val_12886f9d00055adf]);
const __val_72f8a817bfe48bb8 = (v, path, ctx) => validators.array(v, path, ctx, __val_e04b035e41fab592);
const __val_3b5c67d364a7ddf5 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: MixedArray; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_72f8a817bfe48bb8]
]);
const __val_04a7fc293d31231a = (v, path, ctx) => validators.optional(v, path, ctx, __val_dabac2963e974f00);
const __val_336e7f6c7f720f4c = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "Nested");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["id", "user", "tags"]), [
    ["id", false, __val_12886f9d00055adf],
    ["user", true, __val_04a7fc293d31231a],
    ["tags", false, __val_e5da2f9fabafe20e]
]);
const __val_f8b011b9cbfe79d7 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: Nested; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_336e7f6c7f720f4c]
]);
const __val_8f46c2e01aa2c30b = ((keys, props) => (v, path, ctx) => {
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
const __val_52e30cb26470a5c7 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: Intersection; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_8f46c2e01aa2c30b]
]);
const __val_8882ed9662ad1d00 = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<\"active\"|\"inactive\">"))([__val_ea6ff166f61d40f9, __val_3b0c16083099d1a2]);
const __val_285cbe16a0c2d69a = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; status: \"active\" | \"inactive\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "status"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["status", false, __val_8882ed9662ad1d00]
]);
const __val_81fa51ce4326115f = ((keys, props) => (v, path, ctx) => {
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
const __val_99c40ab405926cb5 = (v, path, ctx) => { v = validators.date(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "Date"); return v; };
const __val_eefd1c8d7e793bf3 = (v, path, ctx) => { v = validators.regexp(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "RegExp"); return v; };
const __val_75d012fe28656e0a = (v, path, ctx) => { v = validators.bigint(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "bigint"); return v; };
const __val_0cbfa3d6e2dd2d42 = ((keys, props) => (v, path, ctx) => {
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
const __val_e11b660b02600b6b = ((keys, props) => (v, path, ctx) => {
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
const __val_58a03416b2cb087e = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; user: { name: string; active: boolean; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "user"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["user", false, __val_e11b660b02600b6b]
]);
const __val_aed9bfd6463aaf99 = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "string"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_a9897a9366167612 = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "number"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_a1cd64d5101fe89d = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "bigint"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_4d3ca51ff2a8c3f7 = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "boolean"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_2774b7a7127e2e45 = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "symbol"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_1a9a9216eda6278f = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "undefined"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_23cd3d6f8af25a7e = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "object"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_7ca3452ad9d6337d = (v, path, ctx) => { v = ((v, path, ctx) => validators.literal(v, path, ctx, "function"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "literal"); return v; };
const __val_61179e49b9ba9304 = (checks => (v, path, ctx) => validators.union(v, path, ctx, checks, "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">"))([__val_aed9bfd6463aaf99, __val_a9897a9366167612, __val_a1cd64d5101fe89d, __val_4d3ca51ff2a8c3f7, __val_2774b7a7127e2e45, __val_1a9a9216eda6278f, __val_23cd3d6f8af25a7e, __val_7ca3452ad9d6337d]);
const __val_79b8af864f851e6c = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; val: string | number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "val", "type"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["val", false, __val_e04b035e41fab592],
    ["type", false, __val_61179e49b9ba9304]
]);
const __val_0af93ee5ec83e683 = (v, path, ctx) => { v = ((v, path, ctx) => validators.templateLiteral(v, path, ctx, validators.safeRegExp("^id-[+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$"), "`id-${number}`"))(v, path, ctx); if (ctx.transform && ctx.success)
    v = validators.applyOptionTransform(v, path, ctx, [], "string"); return v; };
const __val_156832559818cccc = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; id: `id-${number}`; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "id"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["id", false, __val_0af93ee5ec83e683]
]);
const __val_f3e2de7e156a96e1 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "string");
    if (ctx.success && v !== undefined && v !== null) {
        validators.minLength(v, path, ctx, 8);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_17a5c4c8a16af9e2 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "number");
    if (ctx.success && v !== undefined && v !== null) {
        validators.minimum(v, path, ctx, 18);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_90890888e6bfda64 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; pass: string & constraint_MinLength<8>; age: number & constraint_Minimum<18>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "pass", "age"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["pass", false, __val_f3e2de7e156a96e1],
    ["age", false, __val_17a5c4c8a16af9e2]
]);
const __val_b94cea534dad9b57 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "number");
    if (ctx.success && v !== undefined && v !== null) {
        validators.custom(v, path, ctx, isEvenNumber);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_657399ef9b46c45e = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "CustomUser");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["val"]), [
    ["val", false, __val_b94cea534dad9b57]
]);
const __val_7aaa0990d03e8530 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: CustomUser; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_657399ef9b46c45e]
]);
const __val_35692917c6575b84 = ((keys, props) => (v, path, ctx) => {
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
const __val_7110bcffccf1a982 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "number");
    if (ctx.success && v !== undefined && v !== null) {
        validators.exclusiveMinimum(v, path, ctx, 10);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_001bb22de7112159 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "number");
    if (ctx.success && v !== undefined && v !== null) {
        validators.exclusiveMaximum(v, path, ctx, 20);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_d7391d4212453dff = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.number(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "number");
    if (ctx.success && v !== undefined && v !== null) {
        validators.multipleOf(v, path, ctx, 5);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_9bfeaff764b4b6c4 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ min: number & constraint_ExclusiveMinimum<10>; max: number & constraint_ExclusiveMaximum<20>; mult: number & constraint_MultipleOf<...>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["min", "max", "mult"]), [
    ["min", false, __val_7110bcffccf1a982],
    ["max", false, __val_001bb22de7112159],
    ["mult", false, __val_d7391d4212453dff]
]);
const __val_71fdbfb1ead50462 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "string");
    if (ctx.success && v !== undefined && v !== null) {
        v = validators.format(v, path, ctx, "email");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_60d13ef6853426ab = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "string");
    if (ctx.success && v !== undefined && v !== null) {
        v = validators.format(v, path, ctx, "uuid");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_eb0d2d092a42bef1 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = validators.string(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "string");
    if (ctx.success && v !== undefined && v !== null) {
        v = validators.format(v, path, ctx, "date");
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_e9ed6914d1b28558 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ email: string & constraint_Format<\"email\">; uuid: string & constraint_Format<\"uuid\">; date: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["email", "uuid", "date"]), [
    ["email", false, __val_71fdbfb1ead50462],
    ["uuid", false, __val_60d13ef6853426ab],
    ["date", false, __val_473287f8298dba71]
]);
const __val_72f6b659d3bb7b99 = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = __val_e5da2f9fabafe20e(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "Array");
    if (ctx.success && v !== undefined && v !== null) {
        validators.minItems(v, path, ctx, 2);
        validators.maxItems(v, path, ctx, 3);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_3bf071592f56335a = (v, path, ctx) => validators.array(v, path, ctx, __val_12886f9d00055adf);
const __val_dc0e08a79102d48b = (v, path, ctx) => {
    const _s = ctx.success;
    ctx.success = true;
    v = __val_3bf071592f56335a(v, path, ctx);
    if (ctx.transform && ctx.success)
        v = validators.applyOptionTransform(v, path, ctx, [], "Array");
    if (ctx.success && v !== undefined && v !== null) {
        validators.uniqueItems(v, path, ctx);
    }
    if (_s === false)
        ctx.success = false;
    return v;
};
const __val_0de485cce2193ad7 = ((keys, props) => (v, path, ctx) => {
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
const __val_9008265e4dfb2d87 = ((keys, props) => (v, path, ctx) => {
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
const __val_3f164a2cf2db55aa = ((keys, props) => (v, path, ctx) => {
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
const __val_981b10abd7350437 = ((keys, props) => (v, path, ctx) => {
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
const __val_db15871609124f5c = ((keys, props) => (v, path, ctx) => {
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
const __val_772390084079541d = ((keys, props) => (v, path, ctx) => {
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
const __val_74aa72868067a1c7 = ((keys, props) => (v, path, ctx) => {
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
const __val_8795753195068751 = ((keys, props) => (v, path, ctx) => {
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
const __val_6170e5a05185bb3b = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ id: string; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["id", "type"]), [
    ["id", false, __val_473287f8298dba71],
    ["type", false, __val_61179e49b9ba9304]
]);
const __val_f8cd9d3d3894152a = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ n: number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["n", "type"]), [
    ["n", false, __val_12886f9d00055adf],
    ["type", false, __val_61179e49b9ba9304]
]);
const __val_e295b81a9513a931 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ token: string; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["token", "type"]), [
    ["token", false, __val_473287f8298dba71],
    ["type", false, __val_61179e49b9ba9304]
]);
const __val_f1237b69b70d34ba = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ session: string; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["session", "type"]), [
    ["session", false, __val_473287f8298dba71],
    ["type", false, __val_61179e49b9ba9304]
]);
const __val_6431bbf146d1fea8 = ((keys, props) => (v, path, ctx) => {
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
const __val_d3d47fa7b799a985 = ((keys, props) => (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, keys, "{ success: boolean; data: User; ageType: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx, true);
    validators.props(obj, data, path, ctx, props);
    validators.stripExtras(data, ctx, keys);
    return data;
})(new Set(["success", "data", "ageType"]), [
    ["success", false, __val_ced862ef1505bc73],
    ["data", false, __val_dabac2963e974f00],
    ["ageType", false, __val_61179e49b9ba9304]
]);
const __parse_dabac2963e974f00_strict_json = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), (path) ? (path) + "." + "name" : "name"), (path) ? (path) + "." + "name" : "name", transform, "string", [], obj), "age": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "age") ? o.age : undefined), (path) ? (path) + "." + "age" : "age"), (path) ? (path) + "." + "age" : "age", transform, "number", [], obj) }; for (const k of Object.keys(o)) {
    if (!__keys.has(k)) {
        throw new __tcRuntime.ParseError(p, "PropertyNotAllowed<" + k + ">");
    }
} return res; })(obj, path); }); })();
const __parse_dabac2963e974f00_strict_query = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), (path) ? (path) + "." + "name" : "name"), (path) ? (path) + "." + "name" : "name", transform, "string", [], rawQuery), "age": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "age") ? o.age : undefined), (path) ? (path) + "." + "age" : "age"), (path) ? (path) + "." + "age" : "age", transform, "number", [], rawQuery) }; for (const k of Object.keys(o)) {
    if (!__keys.has(k)) {
        throw new __tcRuntime.ParseError(p, "PropertyNotAllowed<" + k + ">");
    }
} return res; })(rawQuery, path); }); })();
const __parse_dabac2963e974f00_strip_json = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), (path) ? (path) + "." + "name" : "name"), (path) ? (path) + "." + "name" : "name", transform, "string", [], obj), "age": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "age") ? o.age : undefined), (path) ? (path) + "." + "age" : "age"), (path) ? (path) + "." + "age" : "age", transform, "number", [], obj) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(obj, path); }); })();
const __parse_dabac2963e974f00_strip_query = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), (path) ? (path) + "." + "name" : "name"), (path) ? (path) + "." + "name" : "name", transform, "string", [], rawQuery), "age": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "age") ? o.age : undefined), (path) ? (path) + "." + "age" : "age"), (path) ? (path) + "." + "age" : "age", transform, "number", [], rawQuery) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(rawQuery, path); }); })();
const __parse_dabac2963e974f00_relaxed_json = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), (path) ? (path) + "." + "name" : "name"), (path) ? (path) + "." + "name" : "name", transform, "string", [], obj), "age": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "age") ? o.age : undefined), (path) ? (path) + "." + "age" : "age"), (path) ? (path) + "." + "age" : "age", transform, "number", [], obj) }; for (const k of Object.keys(o)) {
    if (!__keys.has(k)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
            Object.defineProperty(res, k, { value: o[k], enumerable: true, configurable: true, writable: true });
        }
        else {
            res[k] = o[k];
        }
    }
} return res; })(obj, path); }); })();
const __parse_dabac2963e974f00_relaxed_query = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), (path) ? (path) + "." + "name" : "name"), (path) ? (path) + "." + "name" : "name", transform, "string", [], rawQuery), "age": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "age") ? o.age : undefined), (path) ? (path) + "." + "age" : "age"), (path) ? (path) + "." + "age" : "age", transform, "number", [], rawQuery) }; for (const k of Object.keys(o)) {
    if (!__keys.has(k)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
            Object.defineProperty(res, k, { value: o[k], enumerable: true, configurable: true, writable: true });
        }
        else {
            res[k] = o[k];
        }
    }
} return res; })(rawQuery, path); }); })();
const __parse_00dfa6d2fd9beb5b_strip_json = (function () { const __keys = new Set(["type", "val"]); const __keys_1 = new Set(["id", "tags"]); const __keys_2 = new Set(["type", "data"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (v, p) { switch ((v && typeof v === "object" && Object.hasOwn(v, "type") ? v["type"] : undefined)) {
    case "simple": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": __tcRuntime.applyParseTransform((function (v, path) { if (v !== "simple") {
            throw new __tcRuntime.ParseError(path, "Literal<'simple'>");
        } return v; })((Object.hasOwn(o, "type") ? o.type : undefined), (p) ? (p) + "." + "type" : "type"), (p) ? (p) + "." + "type" : "type", transform, "literal", [], obj), "val": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "val") ? o.val : undefined), (p) ? (p) + "." + "val" : "val"), (p) ? (p) + "." + "val" : "val", transform, "string", [], obj) }; if (__tcRuntime.hasParseUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k of Object.keys(o)) {
            if (o[k] !== undefined) {
                if (__keys.has(k)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordParseObjectStats(__st, __mt);
    } return res; })(v, p);
    case "complex": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": __tcRuntime.applyParseTransform((function (v, path) { if (v !== "complex") {
            throw new __tcRuntime.ParseError(path, "Literal<'complex'>");
        } return v; })((Object.hasOwn(o, "type") ? o.type : undefined), (p) ? (p) + "." + "type" : "type"), (p) ? (p) + "." + "type" : "type", transform, "literal", [], obj), "data": (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "id") ? o.id : undefined), ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "id" : "id"), ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "id" : "id", transform, "number", [], obj), "tags": (function (arr, p) { __tcRuntime.expectArray(arr, p); const out = new Array(arr.length); for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                const itemP = (p ? p + "[" + i + "]" : "[" + i + "]");
                out[i] = __tcRuntime.applyParseTransform(__tcRuntime.expectString(item, itemP), itemP, transform, "string", [], obj);
            } return out; })((Object.hasOwn(o, "tags") ? o.tags : undefined), ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "tags" : "tags") }; if (__tcRuntime.hasParseUnionProbe()) {
            let __st = 0;
            let __mt = 0;
            for (const k of Object.keys(o)) {
                if (o[k] !== undefined) {
                    if (__keys_1.has(k)) {
                        __mt++;
                    }
                    else {
                        __st++;
                    }
                }
            }
            __tcRuntime.recordParseObjectStats(__st, __mt);
        } return res; })((Object.hasOwn(o, "data") ? o.data : undefined), (p) ? (p) + "." + "data" : "data") }; if (__tcRuntime.hasParseUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k of Object.keys(o)) {
            if (o[k] !== undefined) {
                if (__keys_2.has(k)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordParseObjectStats(__st, __mt);
    } return res; })(v, p);
    default: throw new __tcRuntime.ParseError(p, "Type<MyUnion>");
} })(obj, path); }); })();
const __parse_00dfa6d2fd9beb5b_strip_query = (function () { const __keys = new Set(["type", "val"]); const __keys_1 = new Set(["id", "tags"]); const __keys_2 = new Set(["type", "data"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (v, p) { switch ((v && typeof v === "object" && Object.hasOwn(v, "type") ? v["type"] : undefined)) {
    case "simple": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": __tcRuntime.applyParseTransform((function (v, path) { if (typeof v !== "string") {
            throw new __tcRuntime.ParseError(path, "Literal<'simple'>");
        } if (v !== "simple") {
            throw new __tcRuntime.ParseError(path, "Literal<'simple'>");
        } return v; })((Object.hasOwn(o, "type") ? o.type : undefined), (p) ? (p) + "." + "type" : "type"), (p) ? (p) + "." + "type" : "type", transform, "literal", [], rawQuery), "val": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "val") ? o.val : undefined), (p) ? (p) + "." + "val" : "val"), (p) ? (p) + "." + "val" : "val", transform, "string", [], rawQuery) }; if (__tcRuntime.hasParseUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k of Object.keys(o)) {
            if (o[k] !== undefined) {
                if (__keys.has(k)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordParseObjectStats(__st, __mt);
    } return res; })(v, p);
    case "complex": return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "type": __tcRuntime.applyParseTransform((function (v, path) { if (typeof v !== "string") {
            throw new __tcRuntime.ParseError(path, "Literal<'complex'>");
        } if (v !== "complex") {
            throw new __tcRuntime.ParseError(path, "Literal<'complex'>");
        } return v; })((Object.hasOwn(o, "type") ? o.type : undefined), (p) ? (p) + "." + "type" : "type"), (p) ? (p) + "." + "type" : "type", transform, "literal", [], rawQuery), "data": (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "id") ? o.id : undefined), ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "id" : "id"), ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "id" : "id", transform, "number", [], rawQuery), "tags": __tcRuntime.coerceArray((Object.hasOwn(o, "tags") ? o.tags : undefined), ((p) ? (p) + "." + "data" : "data") ? ((p) ? (p) + "." + "data" : "data") + "." + "tags" : "tags", (item, itemP) => __tcRuntime.applyParseTransform(__tcRuntime.expectString(item, itemP), itemP, transform, "string", [], rawQuery)) }; if (__tcRuntime.hasParseUnionProbe()) {
            let __st = 0;
            let __mt = 0;
            for (const k of Object.keys(o)) {
                if (o[k] !== undefined) {
                    if (__keys_1.has(k)) {
                        __mt++;
                    }
                    else {
                        __st++;
                    }
                }
            }
            __tcRuntime.recordParseObjectStats(__st, __mt);
        } return res; })((Object.hasOwn(o, "data") ? o.data : undefined), (p) ? (p) + "." + "data" : "data") }; if (__tcRuntime.hasParseUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k of Object.keys(o)) {
            if (o[k] !== undefined) {
                if (__keys_2.has(k)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordParseObjectStats(__st, __mt);
    } return res; })(v, p);
    default: throw new __tcRuntime.ParseError(p, "Type<MyUnion>");
} })(rawQuery, path); }); })();
const __parse_72f8a817bfe48bb8_strip_json = (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (arr, p) { __tcRuntime.expectArray(arr, p); const out = new Array(arr.length); for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemP = (p ? p + "[" + i + "]" : "[" + i + "]");
    out[i] = __tcRuntime.parseUnion(item, itemP, "Type<string|number>", [(v, p) => __tcRuntime.applyParseTransform(__tcRuntime.expectString(v, p), p, transform, "string", [], obj), (v, p) => __tcRuntime.applyParseTransform(__tcRuntime.expectNumber(v, p), p, transform, "number", [], obj)]);
} return out; })(obj, path); });
const __parse_72f8a817bfe48bb8_strip_query = (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return __tcRuntime.coerceArray(rawQuery, path, (item, itemP) => __tcRuntime.parseUnion(item, itemP, "Type<string|number>", [(v, p) => __tcRuntime.applyParseTransform(__tcRuntime.expectString(v, p), p, transform, "string", [], rawQuery), (v, p) => __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber(v, p), p, transform, "number", [], rawQuery)])); });
const __parse_336e7f6c7f720f4c_strip_json = (function () { const __keys = new Set(["name", "age"]); const __keys_1 = new Set(["id", "user", "tags"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "id") ? o.id : undefined), (path) ? (path) + "." + "id" : "id"), (path) ? (path) + "." + "id" : "id", transform, "number", [], obj), "tags": (function (arr, p) { __tcRuntime.expectArray(arr, p); const out = new Array(arr.length); for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const itemP = (p ? p + "[" + i + "]" : "[" + i + "]");
        out[i] = __tcRuntime.applyParseTransform(__tcRuntime.expectString(item, itemP), itemP, transform, "string", [], obj);
    } return out; })((Object.hasOwn(o, "tags") ? o.tags : undefined), (path) ? (path) + "." + "tags" : "tags") }; if ((Object.hasOwn(o, "user") ? o.user : undefined) !== undefined) {
    res["user"] = (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "name" : "name"), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "name" : "name", transform, "string", [], obj), "age": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "age") ? o.age : undefined), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "age" : "age"), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "age" : "age", transform, "number", [], obj) }; if (__tcRuntime.hasParseUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k of Object.keys(o)) {
            if (o[k] !== undefined) {
                if (__keys.has(k)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordParseObjectStats(__st, __mt);
    } return res; })((Object.hasOwn(o, "user") ? o.user : undefined), (path) ? (path) + "." + "user" : "user");
} if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys_1.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(obj, path); }); })();
const __parse_336e7f6c7f720f4c_strip_query = (function () { const __keys = new Set(["name", "age"]); const __keys_1 = new Set(["id", "user", "tags"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "id": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "id") ? o.id : undefined), (path) ? (path) + "." + "id" : "id"), (path) ? (path) + "." + "id" : "id", transform, "number", [], rawQuery), "tags": __tcRuntime.coerceArray((Object.hasOwn(o, "tags") ? o.tags : undefined), (path) ? (path) + "." + "tags" : "tags", (item, itemP) => __tcRuntime.applyParseTransform(__tcRuntime.expectString(item, itemP), itemP, transform, "string", [], rawQuery)) }; if ((Object.hasOwn(o, "user") ? o.user : undefined) !== undefined) {
    res["user"] = (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "name": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "name") ? o.name : undefined), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "name" : "name"), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "name" : "name", transform, "string", [], rawQuery), "age": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "age") ? o.age : undefined), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "age" : "age"), ((path) ? (path) + "." + "user" : "user") ? ((path) ? (path) + "." + "user" : "user") + "." + "age" : "age", transform, "number", [], rawQuery) }; if (__tcRuntime.hasParseUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k of Object.keys(o)) {
            if (o[k] !== undefined) {
                if (__keys.has(k)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordParseObjectStats(__st, __mt);
    } return res; })((Object.hasOwn(o, "user") ? o.user : undefined), (path) ? (path) + "." + "user" : "user");
} if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys_1.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(rawQuery, path); }); })();
const __parse_8f46c2e01aa2c30b_strip_json = (function () { const __keys = new Set(["a", "b"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "a") ? o.a : undefined), (path) ? (path) + "." + "a" : "a"), (path) ? (path) + "." + "a" : "a", transform, "string", [], obj), "b": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "b") ? o.b : undefined), (path) ? (path) + "." + "b" : "b"), (path) ? (path) + "." + "b" : "b", transform, "number", [], obj) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(obj, path); }); })();
const __parse_8f46c2e01aa2c30b_strip_query = (function () { const __keys = new Set(["a", "b"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.applyParseTransform(__tcRuntime.expectString((Object.hasOwn(o, "a") ? o.a : undefined), (path) ? (path) + "." + "a" : "a"), (path) ? (path) + "." + "a" : "a", transform, "string", [], rawQuery), "b": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "b") ? o.b : undefined), (path) ? (path) + "." + "b" : "b"), (path) ? (path) + "." + "b" : "b", transform, "number", [], rawQuery) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(rawQuery, path); }); })();
const __parse_8882ed9662ad1d00_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.parseUnion(input, path, "Type<\"active\"|\"inactive\">", [(v, p) => __tcRuntime.applyParseTransform((function (v, path) { if (typeof v !== "string") {
        throw new __tcRuntime.ParseError(path, "Literal<'active'>");
    } if (v !== "active") {
        throw new __tcRuntime.ParseError(path, "Literal<'active'>");
    } return v; })(v, p), p, transform, "literal", [], input), (v, p) => __tcRuntime.applyParseTransform((function (v, path) { if (typeof v !== "string") {
        throw new __tcRuntime.ParseError(path, "Literal<'inactive'>");
    } if (v !== "inactive") {
        throw new __tcRuntime.ParseError(path, "Literal<'inactive'>");
    } return v; })(v, p), p, transform, "literal", [], input)]); });
const __parse_12886f9d00055adf_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber(input, path), path, transform, "number", [], input); });
const __parse_ced862ef1505bc73_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.coerceBoolean(input, path); });
const __parse_99c40ab405926cb5_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.applyParseTransform(__tcRuntime.coerceDate(input, path), path, transform, "Date", [], input); });
const __parse_eefd1c8d7e793bf3_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.applyParseTransform((function (v, path) { if (v instanceof RegExp) {
    return v;
} if (typeof v === "string") {
    const match = v.match(/^\/(.*)\/([dgimsuvy]*)$/);
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
} throw new __tcRuntime.ParseError(path, "Type<RegExp>"); })(input, path), path, transform, "RegExp", [], input); });
const __parse_75d012fe28656e0a_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.applyParseTransform(__tcRuntime.coerceBigInt(input, path), path, transform, "bigint", [], input); });
const __parse_e04b035e41fab592_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.parseUnion(input, path, "Type<string|number>", [(v, p) => __tcRuntime.applyParseTransform(__tcRuntime.expectString(v, p), p, transform, "string", [], input), (v, p) => __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber(v, p), p, transform, "number", [], input)]); });
const __parse_0af93ee5ec83e683_strip_string = (function () { const __re_0 = __tcRuntime.getCachedPattern("^id-[+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$"); return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.applyParseTransform((function (v, path) { if (!__re_0) {
    throw new __tcRuntime.ParseError(path, "UnsafePattern");
} if (typeof v !== "string" || !__tcRuntime.testRegex(__re_0, v)) {
    throw new __tcRuntime.ParseError(path, "`id-${number}`");
} return v; })(input, path), path, transform, "string", [], input); }); })();
const __parse_f3e2de7e156a96e1_strip_string = (function () { const __c_0 = [{ type: "minLength", value: 8 }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.expectString(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "string", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_17a5c4c8a16af9e2_strip_string = (function () { const __c_0 = [{ type: "minimum", value: 18 }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceNumber(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "number", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_657399ef9b46c45e_strip_json = (function () { const __keys = new Set(["val"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "val": (function (raw, p, root) { let __v = raw; __v = __tcRuntime.expectNumber(__v, p); if (transform) {
        __v = __tcRuntime.applyParseTransform(__v, p, transform, "number", [], root);
    } if (__v !== undefined && __v !== null) {
        {
            const _ctx = { success: true, errors: [], mode: "strict", from: "json", root: root };
            __tcRuntime.validators.custom(__v, p, _ctx, isEvenNumber);
            if (!_ctx.success) {
                throw new __tcRuntime.ParseError(p, (_ctx.errors[0] && _ctx.errors[0].error) || "Custom");
            }
        }
    } return __v; })((Object.hasOwn(o, "val") ? o.val : undefined), (path) ? (path) + "." + "val" : "val", obj) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(obj, path); }); })();
const __parse_657399ef9b46c45e_strip_query = (function () { const __keys = new Set(["val"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "val": (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceNumber(__v, p); if (transform) {
        __v = __tcRuntime.applyParseTransform(__v, p, transform, "number", [], root);
    } if (__v !== undefined && __v !== null) {
        {
            const _ctx = { success: true, errors: [], mode: "strict", from: "query", root: root };
            __tcRuntime.validators.custom(__v, p, _ctx, isEvenNumber);
            if (!_ctx.success) {
                throw new __tcRuntime.ParseError(p, (_ctx.errors[0] && _ctx.errors[0].error) || "Custom");
            }
        }
    } return __v; })((Object.hasOwn(o, "val") ? o.val : undefined), (path) ? (path) + "." + "val" : "val", rawQuery) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(rawQuery, path); }); })();
const __parse_7110bcffccf1a982_strip_string = (function () { const __c_0 = [{ type: "exclusiveMinimum", value: 10 }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceNumber(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "number", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_001bb22de7112159_strip_string = (function () { const __c_0 = [{ type: "exclusiveMaximum", value: 20 }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceNumber(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "number", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_d7391d4212453dff_strip_string = (function () { const __c_0 = [{ type: "multipleOf", value: 5 }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceNumber(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "number", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_71fdbfb1ead50462_strip_string = (function () { const __c_0 = [{ type: "format", value: "email" }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.expectString(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "string", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_60d13ef6853426ab_strip_string = (function () { const __c_0 = [{ type: "format", value: "uuid" }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.expectString(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "string", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_eb0d2d092a42bef1_strip_string = (function () { const __c_0 = [{ type: "format", value: "date" }]; return (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.expectString(__v, p); if (transform) {
    __v = __tcRuntime.applyParseTransform(__v, p, transform, "string", [], root);
} __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "string", root); return __v; })(input, path, input); }); })();
const __parse_72f6b659d3bb7b99_strip_json = (function () { const __c_0 = [{ type: "minItems", value: 2 }, { type: "maxItems", value: 3 }]; return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (raw, p, root) { let __v = raw; __v = (function (arr, p) { __tcRuntime.expectArray(arr, p); const out = new Array(arr.length); for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemP = (p ? p + "[" + i + "]" : "[" + i + "]");
    out[i] = __tcRuntime.applyParseTransform(__tcRuntime.expectString(item, itemP), itemP, transform, "string", [], obj);
} return out; })(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "json", root); return __v; })(obj, path, obj); }); })();
const __parse_72f6b659d3bb7b99_strip_query = (function () { const __c_0 = [{ type: "minItems", value: 2 }, { type: "maxItems", value: 3 }]; return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceArray(__v, p, (item, itemP) => __tcRuntime.applyParseTransform(__tcRuntime.expectString(item, itemP), itemP, transform, "string", [], rawQuery)); __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "query", root); return __v; })(rawQuery, path, rawQuery); }); })();
const __parse_dc0e08a79102d48b_strip_json = (function () { const __c_0 = [{ type: "uniqueItems", value: true }]; return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (raw, p, root) { let __v = raw; __v = (function (arr, p) { __tcRuntime.expectArray(arr, p); const out = new Array(arr.length); for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemP = (p ? p + "[" + i + "]" : "[" + i + "]");
    out[i] = __tcRuntime.applyParseTransform(__tcRuntime.expectNumber(item, itemP), itemP, transform, "number", [], obj);
} return out; })(__v, p); __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "json", root); return __v; })(obj, path, obj); }); })();
const __parse_dc0e08a79102d48b_strip_query = (function () { const __c_0 = [{ type: "uniqueItems", value: true }]; return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (raw, p, root) { let __v = raw; __v = __tcRuntime.coerceArray(__v, p, (item, itemP) => __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber(item, itemP), itemP, transform, "number", [], rawQuery)); __v = __tcRuntime.applyParseConstraints(__v, p, __c_0, "query", root); return __v; })(rawQuery, path, rawQuery); }); })();
const __parse_473287f8298dba71_strip_string = (function (raw, options) { const path = ""; const transform = options && options.transform; const input = __tcRuntime.expectString(raw, path); return __tcRuntime.applyParseTransform(__tcRuntime.expectString(input, path), path, transform, "string", [], input); });
const __parse_db15871609124f5c_strip_json = (function () { const __keys = new Set(["a", "b"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "a") ? o.a : undefined), (path) ? (path) + "." + "a" : "a"), (path) ? (path) + "." + "a" : "a", transform, "number", [], obj), "b": __tcRuntime.applyParseTransform(__tcRuntime.expectNumber((Object.hasOwn(o, "b") ? o.b : undefined), (path) ? (path) + "." + "b" : "b"), (path) ? (path) + "." + "b" : "b", transform, "number", [], obj) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(obj, path); }); })();
const __parse_db15871609124f5c_strip_query = (function () { const __keys = new Set(["a", "b"]); return (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return (function (o, p) { o = __tcRuntime.expectObject(o, p); const res = { "a": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "a") ? o.a : undefined), (path) ? (path) + "." + "a" : "a"), (path) ? (path) + "." + "a" : "a", transform, "number", [], rawQuery), "b": __tcRuntime.applyParseTransform(__tcRuntime.coerceNumber((Object.hasOwn(o, "b") ? o.b : undefined), (path) ? (path) + "." + "b" : "b"), (path) ? (path) + "." + "b" : "b", transform, "number", [], rawQuery) }; if (__tcRuntime.hasParseUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(o)) {
        if (o[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordParseObjectStats(__st, __mt);
} return res; })(rawQuery, path); }); })();
const __parse_473287f8298dba71_strip_json = (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let obj; try {
    obj = JSON.parse(text);
}
catch (e) {
    throw new __tcRuntime.ParseError(path, "Invalid JSON: " + e.message);
} if (reviver) {
    obj = __tcRuntime.reviveTree(obj, reviver);
} return __tcRuntime.applyParseTransform(__tcRuntime.expectString(obj, path), path, transform, "string", [], obj); });
const __parse_473287f8298dba71_strip_query = (function (input, options) { const path = ""; const reviver = options && options.reviver; const transform = options && options.transform; const text = __tcRuntime.expectString(input, path); let rawQuery = __tcRuntime.parseQueryString(text); if (reviver) {
    rawQuery = __tcRuntime.reviveTree(rawQuery, reviver);
} return __tcRuntime.applyParseTransform(__tcRuntime.expectString(rawQuery, path), path, transform, "string", [], rawQuery); });
const __ser_27c76be1e0e096f7_strip_json = (function () { const __keys = new Set(["success", "data"]); const __keys_1 = new Set(["name", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), ("data") + "." + "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, ("data") + "." + "name"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), ("data") + "." + "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "age", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k_1 of Object.keys(obj)) {
        if (obj[k_1] !== undefined) {
            if (__keys_1.has(k_1)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_82a24480723392cb_strip_json = (function () { const __keys = new Set(["success", "data"]); const __keys_1 = new Set(["type", "val"]); const __keys_2 = new Set(["type", "data"]); const __keys_3 = new Set(["id", "tags"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + (function (val) { switch ((val && typeof val === "object" && Object.hasOwn(val, "type") ? val["type"] : undefined)) {
    case "simple": return (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
        throw new __tcRuntime.SerializationError("data", "Type<Object>");
    } let parts = []; parts.push("\"type\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "type") ? obj.type : undefined), ("data") + "." + "type", transform, "literal", [], input) : (Object.hasOwn(obj, "type") ? obj.type : undefined); return (__sv === "simple" ? "\"simple\"" : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "type", "Literal<'simple'>"); })()); })()); parts.push("\"val\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "val") ? obj.val : undefined), ("data") + "." + "val", transform, "string", [], input) : (Object.hasOwn(obj, "val") ? obj.val : undefined); return __tcRuntime.serializeString(__sv, ("data") + "." + "val"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k_2 of Object.keys(obj)) {
            if (obj[k_2] !== undefined) {
                if (__keys_1.has(k_2)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordSerializerObjectStats(__st, __mt);
    } return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined));
    case "complex": return (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
        throw new __tcRuntime.SerializationError("data", "Type<Object>");
    } let parts = []; parts.push("\"type\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "type") ? obj.type : undefined), ("data") + "." + "type", transform, "literal", [], input) : (Object.hasOwn(obj, "type") ? obj.type : undefined); return (__sv === "complex" ? "\"complex\"" : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "type", "Literal<'complex'>"); })()); })()); parts.push("\"data\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
        throw new __tcRuntime.SerializationError(("data") + "." + "data", "Type<Object>");
    } let parts = []; parts.push("\"id\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "id") ? obj.id : undefined), (("data") + "." + "data") + "." + "id", transform, "number", [], input) : (Object.hasOwn(obj, "id") ? obj.id : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError((("data") + "." + "data") + "." + "id", "Type<number>"); })()); })()); parts.push("\"tags\":" + __tcRuntime.serializeArray((Object.hasOwn(obj, "tags") ? obj.tags : undefined), (item_4, i_4) => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(item_4, ((("data") + "." + "data") + "." + "tags") + "[" + i_4 + "]", transform, "string", [], input) : item_4; return __tcRuntime.serializeString(__sv, ((("data") + "." + "data") + "." + "tags") + "[" + i_4 + "]"); })(), (("data") + "." + "data") + "." + "tags")); if (__tcRuntime.hasSerializerUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k_3 of Object.keys(obj)) {
            if (obj[k_3] !== undefined) {
                if (__keys_3.has(k_3)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordSerializerObjectStats(__st, __mt);
    } return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k_2 of Object.keys(obj)) {
            if (obj[k_2] !== undefined) {
                if (__keys_2.has(k_2)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordSerializerObjectStats(__st, __mt);
    } return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined));
    default: throw new __tcRuntime.SerializationError("data", "Type<MyUnion>");
} })((Object.hasOwn(obj, "data") ? obj.data : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_2a16b9d77104981c_strip_json = (function () { const __keys = new Set(["success", "s"]); const __keys_1 = new Set(["reason"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"s\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "s") ? obj.s : undefined), "s", "Type<Status>", [val_1 => (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
        throw new __tcRuntime.SerializationError("s", "Type<Object>");
    } let parts = []; parts.push("\"reason\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "reason") ? obj.reason : undefined), ("s") + "." + "reason", transform, "string", [], input) : (Object.hasOwn(obj, "reason") ? obj.reason : undefined); return __tcRuntime.serializeString(__sv, ("s") + "." + "reason"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k_2 of Object.keys(obj)) {
            if (obj[k_2] !== undefined) {
                if (__keys_1.has(k_2)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordSerializerObjectStats(__st, __mt);
    } return "{" + parts.join(",") + "}"; })(val_1), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "s", transform, "literal", [], input) : val_1; return (__sv === "active" ? "\"active\"" : (function () { throw new __tcRuntime.SerializationError("s", "Literal<'active'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "s", transform, "literal", [], input) : val_1; return (__sv === "inactive" ? "\"inactive\"" : (function () { throw new __tcRuntime.SerializationError("s", "Literal<'inactive'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_3b5c67d364a7ddf5_strip_json = (function () { const __keys = new Set(["success", "data"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + __tcRuntime.serializeArray((Object.hasOwn(obj, "data") ? obj.data : undefined), (item_1, i_1) => __tcRuntime.serializeUnion(item_1, ("data") + "[" + i_1 + "]", "Type<string|number>", [val_2 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_2, ("data") + "[" + i_1 + "]", transform, "string", [], input) : val_2; return __tcRuntime.serializeString(__sv, ("data") + "[" + i_1 + "]"); })(), val_2 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_2, ("data") + "[" + i_1 + "]", transform, "number", [], input) : val_2; return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError(("data") + "[" + i_1 + "]", "Type<number>"); })()); })()]), "data")); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_f8b011b9cbfe79d7_strip_json = (function () { const __keys = new Set(["success", "data"]); const __keys_1 = new Set(["id", "user", "tags"]); const __keys_2 = new Set(["name", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"id\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "id") ? obj.id : undefined), ("data") + "." + "id", transform, "number", [], input) : (Object.hasOwn(obj, "id") ? obj.id : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "id", "Type<number>"); })()); })()); if ((Object.hasOwn(obj, "user") ? obj.user : undefined) !== undefined) {
    parts.push("\"user\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
        throw new __tcRuntime.SerializationError(("data") + "." + "user", "Type<Object>");
    } let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), (("data") + "." + "user") + "." + "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, (("data") + "." + "user") + "." + "name"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), (("data") + "." + "user") + "." + "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError((("data") + "." + "user") + "." + "age", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
        let __st = 0;
        let __mt = 0;
        for (const k_2 of Object.keys(obj)) {
            if (obj[k_2] !== undefined) {
                if (__keys_2.has(k_2)) {
                    __mt++;
                }
                else {
                    __st++;
                }
            }
        }
        __tcRuntime.recordSerializerObjectStats(__st, __mt);
    } return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "user") ? obj.user : undefined)));
} parts.push("\"tags\":" + __tcRuntime.serializeArray((Object.hasOwn(obj, "tags") ? obj.tags : undefined), (item_2, i_2) => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(item_2, (("data") + "." + "tags") + "[" + i_2 + "]", transform, "string", [], input) : item_2; return __tcRuntime.serializeString(__sv, (("data") + "." + "tags") + "[" + i_2 + "]"); })(), ("data") + "." + "tags")); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k_1 of Object.keys(obj)) {
        if (obj[k_1] !== undefined) {
            if (__keys_1.has(k_1)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_52e30cb26470a5c7_strip_json = (function () { const __keys = new Set(["success", "data"]); const __keys_1 = new Set(["a", "b"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"a\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "a") ? obj.a : undefined), ("data") + "." + "a", transform, "string", [], input) : (Object.hasOwn(obj, "a") ? obj.a : undefined); return __tcRuntime.serializeString(__sv, ("data") + "." + "a"); })()); parts.push("\"b\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "b") ? obj.b : undefined), ("data") + "." + "b", transform, "number", [], input) : (Object.hasOwn(obj, "b") ? obj.b : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "b", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k_1 of Object.keys(obj)) {
        if (obj[k_1] !== undefined) {
            if (__keys_1.has(k_1)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_285cbe16a0c2d69a_strip_json = (function () { const __keys = new Set(["success", "status"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"status\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "status") ? obj.status : undefined), "status", "Type<\"active\"|\"inactive\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "status", transform, "literal", [], input) : val_1; return (__sv === "active" ? "\"active\"" : (function () { throw new __tcRuntime.SerializationError("status", "Literal<'active'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "status", transform, "literal", [], input) : val_1; return (__sv === "inactive" ? "\"inactive\"" : (function () { throw new __tcRuntime.SerializationError("status", "Literal<'inactive'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_81fa51ce4326115f_strip_json = (function () { const __keys = new Set(["success", "tags"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"tags\":" + __tcRuntime.serializeArray((Object.hasOwn(obj, "tags") ? obj.tags : undefined), (item_1, i_1) => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(item_1, ("tags") + "[" + i_1 + "]", transform, "string", [], input) : item_1; return __tcRuntime.serializeString(__sv, ("tags") + "[" + i_1 + "]"); })(), "tags")); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_0cbfa3d6e2dd2d42_strip_json = (function () { const __keys = new Set(["success", "age", "active", "date", "pattern", "big"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })()); })()); parts.push("\"active\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "active") ? obj.active : undefined), "active", transform, "boolean", [], input) : (Object.hasOwn(obj, "active") ? obj.active : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("active", "Type<boolean>"); })()); })()); parts.push("\"date\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "date") ? obj.date : undefined), "date", transform, "string", [], input) : (Object.hasOwn(obj, "date") ? obj.date : undefined); return __tcRuntime.serializeString(__sv, "date"); })()); parts.push("\"pattern\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "pattern") ? obj.pattern : undefined), "pattern", transform, "string", [], input) : (Object.hasOwn(obj, "pattern") ? obj.pattern : undefined); return __tcRuntime.serializeString(__sv, "pattern"); })()); parts.push("\"big\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "big") ? obj.big : undefined), "big", transform, "string", [], input) : (Object.hasOwn(obj, "big") ? obj.big : undefined); return __tcRuntime.serializeString(__sv, "big"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_58a03416b2cb087e_strip_json = (function () { const __keys = new Set(["success", "user"]); const __keys_1 = new Set(["name", "active"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"user\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("user", "Type<Object>");
} let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), ("user") + "." + "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, ("user") + "." + "name"); })()); parts.push("\"active\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "active") ? obj.active : undefined), ("user") + "." + "active", transform, "boolean", [], input) : (Object.hasOwn(obj, "active") ? obj.active : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError(("user") + "." + "active", "Type<boolean>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k_1 of Object.keys(obj)) {
        if (obj[k_1] !== undefined) {
            if (__keys_1.has(k_1)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "user") ? obj.user : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_79b8af864f851e6c_strip_json = (function () { const __keys = new Set(["success", "val", "type"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"val\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "val") ? obj.val : undefined), "val", "Type<string|number>", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "val", transform, "string", [], input) : val_1; return __tcRuntime.serializeString(__sv, "val"); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "val", transform, "number", [], input) : val_1; return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("val", "Type<number>"); })()); })()])); parts.push("\"type\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "type") ? obj.type : undefined), "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_156832559818cccc_strip_json = (function () { const __keys = new Set(["success", "id"]); const __re_1 = __tcRuntime.getCachedPattern("^id-[+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$"); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"id\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "id") ? obj.id : undefined), "id", transform, "string", [], input) : (Object.hasOwn(obj, "id") ? obj.id : undefined); return (typeof __sv === "string" && __re_1 && __tcRuntime.testRegex(__re_1, __sv) ? __tcRuntime.serializeString(__sv, "id") : (function () { throw new __tcRuntime.SerializationError("id", "Type<`id-${number}`>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_90890888e6bfda64_strip_json = (function () { const __keys = new Set(["success", "pass", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"pass\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "pass") ? obj.pass : undefined), "pass", transform, "string", [], input) : (Object.hasOwn(obj, "pass") ? obj.pass : undefined); return __tcRuntime.serializeString(__sv, "pass"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_7aaa0990d03e8530_strip_json = (function () { const __keys = new Set(["success", "data"]); const __keys_1 = new Set(["val"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"val\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "val") ? obj.val : undefined), ("data") + "." + "val", transform, "number", [], input) : (Object.hasOwn(obj, "val") ? obj.val : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "val", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k_1 of Object.keys(obj)) {
        if (obj[k_1] !== undefined) {
            if (__keys_1.has(k_1)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_35692917c6575b84_strip_json = (function () { const __keys = new Set(["message"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"message\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "message") ? obj.message : undefined), "message", transform, "string", [], input) : (Object.hasOwn(obj, "message") ? obj.message : undefined); return __tcRuntime.serializeString(__sv, "message"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_9bfeaff764b4b6c4_strip_json = (function () { const __keys = new Set(["min", "max", "mult"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"min\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "min") ? obj.min : undefined), "min", transform, "number", [], input) : (Object.hasOwn(obj, "min") ? obj.min : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("min", "Type<number>"); })()); })()); parts.push("\"max\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "max") ? obj.max : undefined), "max", transform, "number", [], input) : (Object.hasOwn(obj, "max") ? obj.max : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("max", "Type<number>"); })()); })()); parts.push("\"mult\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "mult") ? obj.mult : undefined), "mult", transform, "number", [], input) : (Object.hasOwn(obj, "mult") ? obj.mult : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("mult", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_e9ed6914d1b28558_strip_json = (function () { const __keys = new Set(["email", "uuid", "date"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"email\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "email") ? obj.email : undefined), "email", transform, "string", [], input) : (Object.hasOwn(obj, "email") ? obj.email : undefined); return __tcRuntime.serializeString(__sv, "email"); })()); parts.push("\"uuid\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "uuid") ? obj.uuid : undefined), "uuid", transform, "string", [], input) : (Object.hasOwn(obj, "uuid") ? obj.uuid : undefined); return __tcRuntime.serializeString(__sv, "uuid"); })()); parts.push("\"date\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "date") ? obj.date : undefined), "date", transform, "string", [], input) : (Object.hasOwn(obj, "date") ? obj.date : undefined); return __tcRuntime.serializeString(__sv, "date"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_72f6b659d3bb7b99_strip_json = (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = __tcRuntime.serializeArray(input, (item, i) => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(item, "[" + i + "]", transform, "string", [], input) : item; return __tcRuntime.serializeString(__sv, "[" + i + "]"); })(), ""); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; });
const __ser_dc0e08a79102d48b_strip_json = (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = __tcRuntime.serializeArray(input, (item, i) => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(item, "[" + i + "]", transform, "number", [], input) : item; return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("[" + i + "]", "Type<number>"); })()); })(), ""); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; });
const __ser_473287f8298dba71_strip_json = (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(input, "", transform, "string", [], input) : input; return __tcRuntime.serializeString(__sv, ""); })(); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; });
const __ser_0de485cce2193ad7_strip_json = (function () { const __keys = new Set(["msg", "dbUrl", "logged"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"msg\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "msg") ? obj.msg : undefined), "msg", transform, "string", [], input) : (Object.hasOwn(obj, "msg") ? obj.msg : undefined); return __tcRuntime.serializeString(__sv, "msg"); })()); parts.push("\"dbUrl\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "dbUrl") ? obj.dbUrl : undefined), "dbUrl", transform, "string", [], input) : (Object.hasOwn(obj, "dbUrl") ? obj.dbUrl : undefined); return __tcRuntime.serializeString(__sv, "dbUrl"); })()); parts.push("\"logged\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "logged") ? obj.logged : undefined), "logged", transform, "string", [], input) : (Object.hasOwn(obj, "logged") ? obj.logged : undefined); return __tcRuntime.serializeString(__sv, "logged"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_9008265e4dfb2d87_strip_json = (function () { const __keys = new Set(["dbUrl"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"dbUrl\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "dbUrl") ? obj.dbUrl : undefined), "dbUrl", transform, "string", [], input) : (Object.hasOwn(obj, "dbUrl") ? obj.dbUrl : undefined); return __tcRuntime.serializeString(__sv, "dbUrl"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_3f164a2cf2db55aa_strip_json = (function () { const __keys = new Set(["success"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_981b10abd7350437_strip_json = (function () { const __keys = new Set(["val"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"val\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "val") ? obj.val : undefined), "val", transform, "number", [], input) : (Object.hasOwn(obj, "val") ? obj.val : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("val", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_981b10abd7350437_strict_json = (function () { const __keys = new Set(["val"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"val\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "val") ? obj.val : undefined), "val", transform, "number", [], input) : (Object.hasOwn(obj, "val") ? obj.val : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("val", "Type<number>"); })()); })()); for (const k of Object.keys(obj)) {
    if (!__keys.has(k) && obj[k] !== undefined) {
        throw new __tcRuntime.SerializationError("", "PropertyNotAllowed<" + k + ">");
    }
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_12886f9d00055adf_strip_json = (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(input, "", transform, "number", [], input) : input; return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("", "Type<number>"); })()); })(); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; });
const __ser_dabac2963e974f00_strip_json = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, "name"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_dabac2963e974f00_strict_json = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, "name"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })()); })()); for (const k of Object.keys(obj)) {
    if (!__keys.has(k) && obj[k] !== undefined) {
        throw new __tcRuntime.SerializationError("", "PropertyNotAllowed<" + k + ">");
    }
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_dabac2963e974f00_relaxed_json = (function () { const __keys = new Set(["name", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, "name"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("age", "Type<number>"); })()); })()); for (const k of Object.keys(obj)) {
    if (!__keys.has(k) && obj[k] !== undefined) {
        parts.push(JSON.stringify(k) + ":" + JSON.stringify(obj[k]));
    }
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_772390084079541d_strip_json = (function () { const __keys = new Set(["one", "two"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"one\":" + (function (__nu_1) { if (__nu_1 === null) {
    return "null";
} return (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(__nu_1, "one", transform, "string", [], input) : __nu_1; return __tcRuntime.serializeString(__sv, "one"); })(); })((Object.hasOwn(obj, "one") ? obj.one : undefined))); parts.push("\"two\":" + (function (__nu_1) { if (__nu_1 === null) {
    return "null";
} return (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(__nu_1, "two", transform, "string", [], input) : __nu_1; return __tcRuntime.serializeString(__sv, "two"); })(); })((Object.hasOwn(obj, "two") ? obj.two : undefined))); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_74aa72868067a1c7_strip_json = (function () { const __keys = new Set(["id"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"id\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "id") ? obj.id : undefined), "id", transform, "string", [], input) : (Object.hasOwn(obj, "id") ? obj.id : undefined); return __tcRuntime.serializeString(__sv, "id"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_8795753195068751_strip_json = (function () { const __keys = new Set(["secret"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"secret\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "secret") ? obj.secret : undefined), "secret", transform, "boolean", [], input) : (Object.hasOwn(obj, "secret") ? obj.secret : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("secret", "Type<boolean>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_6170e5a05185bb3b_strip_json = (function () { const __keys = new Set(["id", "type"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"id\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "id") ? obj.id : undefined), "id", transform, "string", [], input) : (Object.hasOwn(obj, "id") ? obj.id : undefined); return __tcRuntime.serializeString(__sv, "id"); })()); parts.push("\"type\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "type") ? obj.type : undefined), "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_f8cd9d3d3894152a_strip_json = (function () { const __keys = new Set(["n", "type"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"n\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "n") ? obj.n : undefined), "n", transform, "number", [], input) : (Object.hasOwn(obj, "n") ? obj.n : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError("n", "Type<number>"); })()); })()); parts.push("\"type\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "type") ? obj.type : undefined), "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_e295b81a9513a931_strip_json = (function () { const __keys = new Set(["token", "type"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"token\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "token") ? obj.token : undefined), "token", transform, "string", [], input) : (Object.hasOwn(obj, "token") ? obj.token : undefined); return __tcRuntime.serializeString(__sv, "token"); })()); parts.push("\"type\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "type") ? obj.type : undefined), "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_f1237b69b70d34ba_strip_json = (function () { const __keys = new Set(["session", "type"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"session\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "session") ? obj.session : undefined), "session", transform, "string", [], input) : (Object.hasOwn(obj, "session") ? obj.session : undefined); return __tcRuntime.serializeString(__sv, "session"); })()); parts.push("\"type\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "type") ? obj.type : undefined), "type", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'string'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'number'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'bigint'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'boolean'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'symbol'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'undefined'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'object'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "type", transform, "literal", [], input) : val_1; return (__sv === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("type", "Literal<'function'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_6431bbf146d1fea8_strip_json = (function () { const __keys = new Set(["attachmentId", "token", "flag"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"attachmentId\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "attachmentId") ? obj.attachmentId : undefined), "attachmentId", transform, "string", [], input) : (Object.hasOwn(obj, "attachmentId") ? obj.attachmentId : undefined); return __tcRuntime.serializeString(__sv, "attachmentId"); })()); parts.push("\"token\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "token") ? obj.token : undefined), "token", transform, "string", [], input) : (Object.hasOwn(obj, "token") ? obj.token : undefined); return __tcRuntime.serializeString(__sv, "token"); })()); parts.push("\"flag\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "flag") ? obj.flag : undefined), "flag", transform, "string", [], input) : (Object.hasOwn(obj, "flag") ? obj.flag : undefined); return __tcRuntime.serializeString(__sv, "flag"); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
const __ser_d3d47fa7b799a985_strip_json = (function () { const __keys = new Set(["success", "data", "ageType"]); const __keys_1 = new Set(["name", "age"]); return (function (input, options) { const transform = options && options.transform; const replacer = options && options.replacer; const out = (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("", "Type<Object>");
} let parts = []; parts.push("\"success\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "success") ? obj.success : undefined), "success", transform, "boolean", [], input) : (Object.hasOwn(obj, "success") ? obj.success : undefined); return (typeof __sv === "boolean" ? (__sv ? "true" : "false") : (function () { throw new __tcRuntime.SerializationError("success", "Type<boolean>"); })()); })()); parts.push("\"data\":" + (function (obj) { if (!__tcRuntime.isPlainObject(obj)) {
    throw new __tcRuntime.SerializationError("data", "Type<Object>");
} let parts = []; parts.push("\"name\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "name") ? obj.name : undefined), ("data") + "." + "name", transform, "string", [], input) : (Object.hasOwn(obj, "name") ? obj.name : undefined); return __tcRuntime.serializeString(__sv, ("data") + "." + "name"); })()); parts.push("\"age\":" + (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform((Object.hasOwn(obj, "age") ? obj.age : undefined), ("data") + "." + "age", transform, "number", [], input) : (Object.hasOwn(obj, "age") ? obj.age : undefined); return (typeof __sv === "number" && Number.isFinite(__sv) ? String(__sv) : (function () { throw new __tcRuntime.SerializationError(("data") + "." + "age", "Type<number>"); })()); })()); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k_1 of Object.keys(obj)) {
        if (obj[k_1] !== undefined) {
            if (__keys_1.has(k_1)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })((Object.hasOwn(obj, "data") ? obj.data : undefined))); parts.push("\"ageType\":" + __tcRuntime.serializeUnion((Object.hasOwn(obj, "ageType") ? obj.ageType : undefined), "ageType", "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">", [val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "string" ? "\"string\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'string'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "number" ? "\"number\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'number'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "bigint" ? "\"bigint\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'bigint'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "boolean" ? "\"boolean\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'boolean'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "symbol" ? "\"symbol\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'symbol'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "undefined" ? "\"undefined\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'undefined'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "object" ? "\"object\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'object'>"); })()); })(), val_1 => (function () { const __sv = typeof transform !== "undefined" && transform ? __tcRuntime.applySerializeTransform(val_1, "ageType", transform, "literal", [], input) : val_1; return (__sv === "function" ? "\"function\"" : (function () { throw new __tcRuntime.SerializationError("ageType", "Literal<'function'>"); })()); })()])); if (__tcRuntime.hasSerializerUnionProbe()) {
    let __st = 0;
    let __mt = 0;
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) {
            if (__keys.has(k)) {
                __mt++;
            }
            else {
                __st++;
            }
        }
    }
    __tcRuntime.recordSerializerObjectStats(__st, __mt);
} return "{" + parts.join(",") + "}"; })(input); if (replacer) {
    return __tcRuntime.applyJsonReplacer(out, replacer);
} return out; }); })();
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
                    parser: __parse_dabac2963e974f00_strict_json,
                    parserQuery: __parse_dabac2963e974f00_strict_query,
                    validator: __val_dabac2963e974f00,
                    mode: "strict"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_27c76be1e0e096f7,
            returnTypeSerializer: __ser_27c76be1e0e096f7_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "strictIntercepted",
            httpMethod: "POST",
            path: "/type-safety/strict-intercepted",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_dabac2963e974f00_strict_json,
                    parserQuery: __parse_dabac2963e974f00_strict_query,
                    validator: __val_dabac2963e974f00,
                    mode: "strict"
                }],
            guards: [],
            interceptors: ["GlobalErrorSanitizer"],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_27c76be1e0e096f7,
            returnTypeSerializer: __ser_27c76be1e0e096f7_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "strip",
            httpMethod: "POST",
            path: "/type-safety/strip",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_dabac2963e974f00_strip_json,
                    parserQuery: __parse_dabac2963e974f00_strip_query,
                    validator: __val_dabac2963e974f00,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_27c76be1e0e096f7,
            returnTypeSerializer: __ser_27c76be1e0e096f7_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "relaxed",
            httpMethod: "POST",
            path: "/type-safety/relaxed",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_dabac2963e974f00_relaxed_json,
                    parserQuery: __parse_dabac2963e974f00_relaxed_query,
                    validator: __val_dabac2963e974f00,
                    mode: "relaxed"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_27c76be1e0e096f7,
            returnTypeSerializer: __ser_27c76be1e0e096f7_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "union",
            httpMethod: "POST",
            path: "/type-safety/union",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_00dfa6d2fd9beb5b_strip_json,
                    parserQuery: __parse_00dfa6d2fd9beb5b_strip_query,
                    validator: __val_00dfa6d2fd9beb5b,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_82a24480723392cb,
            returnTypeSerializer: __ser_82a24480723392cb_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "status",
            httpMethod: "GET",
            path: "/type-safety/status",
            params: [{
                    source: "Query",
                    name: "s",
                    validator: __val_67e1eeb32ffa1ff1,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_2a16b9d77104981c,
            returnTypeSerializer: __ser_2a16b9d77104981c_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "mixedArray",
            httpMethod: "POST",
            path: "/type-safety/mixed-array",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_72f8a817bfe48bb8_strip_json,
                    parserQuery: __parse_72f8a817bfe48bb8_strip_query,
                    validator: __val_72f8a817bfe48bb8,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_3b5c67d364a7ddf5,
            returnTypeSerializer: __ser_3b5c67d364a7ddf5_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "nested",
            httpMethod: "POST",
            path: "/type-safety/nested",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_336e7f6c7f720f4c_strip_json,
                    parserQuery: __parse_336e7f6c7f720f4c_strip_query,
                    validator: __val_336e7f6c7f720f4c,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_f8b011b9cbfe79d7,
            returnTypeSerializer: __ser_f8b011b9cbfe79d7_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "intersection",
            httpMethod: "POST",
            path: "/type-safety/intersection",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_8f46c2e01aa2c30b_strip_json,
                    parserQuery: __parse_8f46c2e01aa2c30b_strip_query,
                    validator: __val_8f46c2e01aa2c30b,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_52e30cb26470a5c7,
            returnTypeSerializer: __ser_52e30cb26470a5c7_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "queryUnion",
            httpMethod: "GET",
            path: "/type-safety/query-union",
            params: [{
                    source: "Query",
                    name: "status",
                    parser: __parse_8882ed9662ad1d00_strip_string,
                    validator: __val_8882ed9662ad1d00,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_285cbe16a0c2d69a,
            returnTypeSerializer: __ser_285cbe16a0c2d69a_strip_json
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
            returnTypeValidator: __val_81fa51ce4326115f,
            returnTypeSerializer: __ser_81fa51ce4326115f_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "coerce",
            httpMethod: "GET",
            path: "/type-safety/coerce",
            params: [{
                    source: "Query",
                    name: "age",
                    parser: __parse_12886f9d00055adf_strip_string,
                    validator: __val_12886f9d00055adf,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "active",
                    parser: __parse_ced862ef1505bc73_strip_string,
                    validator: __val_ced862ef1505bc73,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "date",
                    parser: __parse_99c40ab405926cb5_strip_string,
                    validator: __val_99c40ab405926cb5,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "pattern",
                    parser: __parse_eefd1c8d7e793bf3_strip_string,
                    validator: __val_eefd1c8d7e793bf3,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "big",
                    parser: __parse_75d012fe28656e0a_strip_string,
                    validator: __val_75d012fe28656e0a,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_0cbfa3d6e2dd2d42,
            returnTypeSerializer: __ser_0cbfa3d6e2dd2d42_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "deepBoolean",
            httpMethod: "GET",
            path: "/type-safety/deep-boolean",
            params: [{
                    source: "Query",
                    name: "user",
                    validator: __val_e11b660b02600b6b,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_58a03416b2cb087e,
            returnTypeSerializer: __ser_58a03416b2cb087e_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "coerceUnion",
            httpMethod: "GET",
            path: "/type-safety/coerce-union",
            params: [{
                    source: "Query",
                    name: "val",
                    parser: __parse_e04b035e41fab592_strip_string,
                    validator: __val_e04b035e41fab592,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_79b8af864f851e6c,
            returnTypeSerializer: __ser_79b8af864f851e6c_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "templateLiteral",
            httpMethod: "GET",
            path: "/type-safety/template-literal",
            params: [{
                    source: "Query",
                    name: "id",
                    parser: __parse_0af93ee5ec83e683_strip_string,
                    validator: __val_0af93ee5ec83e683,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_156832559818cccc,
            returnTypeSerializer: __ser_156832559818cccc_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "tags",
            httpMethod: "GET",
            path: "/type-safety/tags",
            params: [{
                    source: "Query",
                    name: "pass",
                    parser: __parse_f3e2de7e156a96e1_strip_string,
                    validator: __val_f3e2de7e156a96e1,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "age",
                    parser: __parse_17a5c4c8a16af9e2_strip_string,
                    validator: __val_17a5c4c8a16af9e2,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_90890888e6bfda64,
            returnTypeSerializer: __ser_90890888e6bfda64_strip_json
        },
        {
            controller: "TypeSafetyController",
            methodName: "customValidator",
            httpMethod: "POST",
            path: "/type-safety/custom-validator",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_657399ef9b46c45e_strip_json,
                    parserQuery: __parse_657399ef9b46c45e_strip_query,
                    validator: __val_657399ef9b46c45e,
                    mode: "strip"
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_7aaa0990d03e8530,
            returnTypeSerializer: __ser_7aaa0990d03e8530_strip_json
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
            returnTypeValidator: __val_35692917c6575b84,
            returnTypeSerializer: __ser_35692917c6575b84_strip_json
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
            returnTypeValidator: __val_35692917c6575b84,
            returnTypeSerializer: __ser_35692917c6575b84_strip_json
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
            returnTypeValidator: __val_35692917c6575b84,
            returnTypeSerializer: __ser_35692917c6575b84_strip_json
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
                    parser: __parse_7110bcffccf1a982_strip_string,
                    validator: __val_7110bcffccf1a982,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "max",
                    parser: __parse_001bb22de7112159_strip_string,
                    validator: __val_001bb22de7112159,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "mult",
                    parser: __parse_d7391d4212453dff_strip_string,
                    validator: __val_d7391d4212453dff,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_9bfeaff764b4b6c4,
            returnTypeSerializer: __ser_9bfeaff764b4b6c4_strip_json
        },
        {
            controller: "TagParityController",
            methodName: "getString",
            httpMethod: "GET",
            path: "/tag-parity/string",
            params: [{
                    source: "Query",
                    name: "email",
                    parser: __parse_71fdbfb1ead50462_strip_string,
                    validator: __val_71fdbfb1ead50462,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "uuid",
                    parser: __parse_60d13ef6853426ab_strip_string,
                    validator: __val_60d13ef6853426ab,
                    mode: undefined
                }, {
                    source: "Query",
                    name: "date",
                    parser: __parse_eb0d2d092a42bef1_strip_string,
                    validator: __val_eb0d2d092a42bef1,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_e9ed6914d1b28558,
            returnTypeSerializer: __ser_e9ed6914d1b28558_strip_json
        },
        {
            controller: "TagParityController",
            methodName: "postArray",
            httpMethod: "POST",
            path: "/tag-parity/array",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_72f6b659d3bb7b99_strip_json,
                    parserQuery: __parse_72f6b659d3bb7b99_strip_query,
                    validator: __val_72f6b659d3bb7b99,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_72f6b659d3bb7b99,
            returnTypeSerializer: __ser_72f6b659d3bb7b99_strip_json
        },
        {
            controller: "TagParityController",
            methodName: "postUniqueArray",
            httpMethod: "POST",
            path: "/tag-parity/unique-array",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_dc0e08a79102d48b_strip_json,
                    parserQuery: __parse_dc0e08a79102d48b_strip_query,
                    validator: __val_dc0e08a79102d48b,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_dc0e08a79102d48b,
            returnTypeSerializer: __ser_dc0e08a79102d48b_strip_json
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
                frameguard: false,
                timeout: 500
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
            returnTypeValidator: __val_0de485cce2193ad7,
            returnTypeSerializer: __ser_0de485cce2193ad7_strip_json
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
            returnTypeValidator: __val_9008265e4dfb2d87,
            returnTypeSerializer: __ser_9008265e4dfb2d87_strip_json
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
            returnTypeValidator: __val_3f164a2cf2db55aa,
            returnTypeSerializer: __ser_3f164a2cf2db55aa_strip_json
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
            returnTypeValidator: __val_3f164a2cf2db55aa,
            returnTypeSerializer: __ser_3f164a2cf2db55aa_strip_json
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
                    parser: __parse_473287f8298dba71_strip_string,
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
            returnTypeValidator: __val_981b10abd7350437,
            returnTypeSerializer: __ser_981b10abd7350437_strip_json
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
            returnTypeValidator: __val_981b10abd7350437,
            returnTypeSerializer: __ser_981b10abd7350437_strip_json
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
            returnTypeValidator: __val_981b10abd7350437,
            returnTypeSerializer: __ser_981b10abd7350437_strict_json
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
                    parser: __parse_db15871609124f5c_strip_json,
                    parserQuery: __parse_db15871609124f5c_strip_query,
                    validator: __val_db15871609124f5c,
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
        },
        {
            controller: "ReturnTypeController",
            methodName: "getInferredBranch",
            httpMethod: "GET",
            path: "/return-type/inferred-branch",
            params: [{
                    source: "Query",
                    name: "branch",
                    parser: __parse_473287f8298dba71_strip_string,
                    validator: __val_473287f8298dba71,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strip_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strict_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_relaxed_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_relaxed_json
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
            returnTypeValidator: __val_dabac2963e974f00,
            returnTypeSerializer: __ser_dabac2963e974f00_strict_json
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
            returnTypeValidator: __val_772390084079541d,
            returnTypeSerializer: __ser_772390084079541d_strip_json
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
            returnTypeValidator: __val_772390084079541d,
            returnTypeSerializer: __ser_772390084079541d_strip_json
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
            returnTypeValidator: __val_772390084079541d,
            returnTypeSerializer: __ser_772390084079541d_strip_json
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
            returnTypeValidator: __val_772390084079541d,
            returnTypeSerializer: __ser_772390084079541d_strip_json
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
            returnTypeValidator: __val_74aa72868067a1c7,
            returnTypeSerializer: __ser_74aa72868067a1c7_strip_json
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
            returnTypeValidator: __val_8795753195068751,
            returnTypeSerializer: __ser_8795753195068751_strip_json,
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
            returnTypeValidator: __val_6170e5a05185bb3b,
            returnTypeSerializer: __ser_6170e5a05185bb3b_strip_json
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
            returnTypeValidator: __val_f8cd9d3d3894152a,
            returnTypeSerializer: __ser_f8cd9d3d3894152a_strip_json
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
            returnTypeValidator: __val_e295b81a9513a931,
            returnTypeSerializer: __ser_e295b81a9513a931_strip_json
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
            returnTypeValidator: __val_f1237b69b70d34ba,
            returnTypeSerializer: __ser_f1237b69b70d34ba_strip_json
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
            returnTypeValidator: __val_6431bbf146d1fea8,
            returnTypeSerializer: __ser_6431bbf146d1fea8_strip_json
        },
        {
            controller: "ScalarWireController",
            methodName: "form",
            httpMethod: "POST",
            path: "/scalar-wire/form",
            params: [{
                    source: "Body",
                    name: "",
                    parser: __parse_dabac2963e974f00_strip_json,
                    parserQuery: __parse_dabac2963e974f00_strip_query,
                    validator: __val_dabac2963e974f00,
                    mode: undefined
                }],
            guards: [],
            interceptors: [],
            middlewares: [],
            meta: {},
            returnTypeValidator: __val_d3d47fa7b799a985,
            returnTypeSerializer: __ser_d3d47fa7b799a985_strip_json
        }
    ]
};
ScalarWireController[Symbol.for("webergency.server.injectable")] = {
    kind: "controller",
    token: "ScalarWireController"
};
