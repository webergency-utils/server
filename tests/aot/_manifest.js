import { MetadataStore } from '@webergency-utils/server';
import { validators } from '@webergency-utils/typechecker';
import { isEvenNumber } from './controllers.js';
import { DiGuard } from './controllers.compiled.js';
import { SimpleGuard } from './controllers.compiled.js';
import { AnotherGuard } from './controllers.compiled.js';
import { MiddlewareCheckingGuard } from './controllers.compiled.js';
import { FailingGuard } from './controllers.compiled.js';
import { PublicDenyGuard } from './controllers.compiled.js';
import { GlobalErrorSanitizer } from './controllers.compiled.js';
import { SimpleInterceptor } from './controllers.compiled.js';
import { AnotherInterceptor } from './controllers.compiled.js';
import { CountingInterceptor } from './controllers.compiled.js';
import { TypeSafetyController } from './controllers.compiled.js';
import { TagParityController } from './controllers.compiled.js';
import { SecureController } from './controllers.compiled.js';
import { BaseController } from './controllers.compiled.js';
import { InheritedController } from './controllers.compiled.js';
import { DiTestController } from './controllers.compiled.js';
import { RealtimeController } from './controllers.compiled.js';
import { MathMicroserviceController } from './controllers.compiled.js';
import { ReturnTypeController } from './controllers.compiled.js';
import { StrictResponseController } from './controllers.compiled.js';
import { BaseRelaxedController } from './controllers.compiled.js';
import { InheritedResponseController } from './controllers.compiled.js';
import { UnprotectedBaseController } from './controllers.compiled.js';
import { UnprotectedClassController } from './controllers.compiled.js';
import { UnprotectedClassAllController } from './controllers.compiled.js';
import { UnprotectedMethodController } from './controllers.compiled.js';
import { UninterceptedBaseController } from './controllers.compiled.js';
import { UninterceptedClassController } from './controllers.compiled.js';
import { UninterceptedClassAllController } from './controllers.compiled.js';
import { UninterceptedMethodController } from './controllers.compiled.js';
import { MiddlewareTestController } from './controllers.compiled.js';
import { MiddlewareUnmiddlewareController } from './controllers.compiled.js';
import { GuardInterceptorOrderController } from './controllers.compiled.js';
import { ClassPublicController } from './controllers.compiled.js';
import { MethodPublicController } from './controllers.compiled.js';
import { ConfigService } from './controllers.compiled.js';
import { DatabaseService } from './controllers.compiled.js';
import { LoggerService } from './controllers.compiled.js';
import { BaseService } from './controllers.compiled.js';
import { ChildService } from './controllers.compiled.js';
import { SimpleTestMiddleware } from './controllers.compiled.js';
import { CallbackTestMiddleware } from './controllers.compiled.js';

// --- EXTERNAL MANIFESTS ---

// --- SINGLETONS ---
MetadataStore.registerGuard('DiGuard', DiGuard);
MetadataStore.registerGuard('SimpleGuard', SimpleGuard);
MetadataStore.registerGuard('AnotherGuard', AnotherGuard);
MetadataStore.registerGuard('MiddlewareCheckingGuard', MiddlewareCheckingGuard);
MetadataStore.registerGuard('FailingGuard', FailingGuard);
MetadataStore.registerGuard('PublicDenyGuard', PublicDenyGuard);
MetadataStore.registerInterceptor('GlobalErrorSanitizer', GlobalErrorSanitizer);
MetadataStore.registerInterceptor('SimpleInterceptor', SimpleInterceptor);
MetadataStore.registerInterceptor('AnotherInterceptor', AnotherInterceptor);
MetadataStore.registerInterceptor('CountingInterceptor', CountingInterceptor);
MetadataStore.registerController('TypeSafetyController', TypeSafetyController);
MetadataStore.registerController('TagParityController', TagParityController);
MetadataStore.registerController('SecureController', SecureController);
MetadataStore.registerController('BaseController', BaseController);
MetadataStore.registerController('InheritedController', InheritedController);
MetadataStore.registerController('DiTestController', DiTestController);
MetadataStore.registerController('RealtimeController', RealtimeController);
MetadataStore.registerController('MathMicroserviceController', MathMicroserviceController);
MetadataStore.registerController('ReturnTypeController', ReturnTypeController);
MetadataStore.registerController('StrictResponseController', StrictResponseController);
MetadataStore.registerController('BaseRelaxedController', BaseRelaxedController);
MetadataStore.registerController('InheritedResponseController', InheritedResponseController);
MetadataStore.registerController('UnprotectedBaseController', UnprotectedBaseController);
MetadataStore.registerController('UnprotectedClassController', UnprotectedClassController);
MetadataStore.registerController('UnprotectedClassAllController', UnprotectedClassAllController);
MetadataStore.registerController('UnprotectedMethodController', UnprotectedMethodController);
MetadataStore.registerController('UninterceptedBaseController', UninterceptedBaseController);
MetadataStore.registerController('UninterceptedClassController', UninterceptedClassController);
MetadataStore.registerController('UninterceptedClassAllController', UninterceptedClassAllController);
MetadataStore.registerController('UninterceptedMethodController', UninterceptedMethodController);
MetadataStore.registerController('MiddlewareTestController', MiddlewareTestController);
MetadataStore.registerController('MiddlewareUnmiddlewareController', MiddlewareUnmiddlewareController);
MetadataStore.registerController('GuardInterceptorOrderController', GuardInterceptorOrderController);
MetadataStore.registerController('ClassPublicController', ClassPublicController);
MetadataStore.registerController('MethodPublicController', MethodPublicController);
MetadataStore.registerProvider('ConfigService', ConfigService);
MetadataStore.registerProvider('DatabaseService', DatabaseService);
MetadataStore.registerProvider('LoggerService', LoggerService);
MetadataStore.registerProvider('BaseService', BaseService);
MetadataStore.registerProvider('ChildService', ChildService);
MetadataStore.registerProvider('SimpleTestMiddleware', SimpleTestMiddleware);
MetadataStore.registerProvider('CallbackTestMiddleware', CallbackTestMiddleware);

// --- VALIDATORS ---
var __val_473287f8298dba71 = validators.string;

var __val_12886f9d00055adf = validators.number;

var __val_04c78f82f98a8cf4 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["name", "age"], "User");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["age", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, ["name", "age"]);
    return data;
};

var __val_d31fde334b3f24e2 = (v, path, ctx) => validators.literal(v, path, ctx, false);

var __val_561da1284502fef1 = (v, path, ctx) => validators.literal(v, path, ctx, true);

var __val_ced862ef1505bc73 = (v, path, ctx) => validators.union(v, path, ctx, [__val_d31fde334b3f24e2, __val_561da1284502fef1], "Type<boolean>");

var __val_c67915707769fcf5 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: User; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_04c78f82f98a8cf4]
    ]);
    validators.stripExtras(data, ctx, ["success", "data"]);
    return data;
};

var __val_6d1570e5b8d6d45a = (v, path, ctx) => validators.literal(v, path, ctx, "simple");

var __val_2258654cc0f69d37 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["type", "val"], "{ type: \"simple\"; val: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["type", false, __val_6d1570e5b8d6d45a],
        ["val", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, ["type", "val"]);
    return data;
};

var __val_68056e96638382b6 = (v, path, ctx) => validators.literal(v, path, ctx, "complex");

var __val_e5da2f9fabafe20e = (v, path, ctx) => validators.array(v, path, ctx, __val_473287f8298dba71);

var __val_b421a9236dfde58e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["id", "tags"], "{ id: number; tags: string[]; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    validators.stripExtras(data, ctx, ["id", "tags"]);
    return data;
};

var __val_5c5ed695091ba342 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["type", "data"], "{ type: \"complex\"; data: { id: number; tags: string[]; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["type", false, __val_68056e96638382b6],
        ["data", false, __val_b421a9236dfde58e]
    ]);
    validators.stripExtras(data, ctx, ["type", "data"]);
    return data;
};

var __val_a41824426b6b1ede = (v, path, ctx) => validators.union(v, path, ctx, [__val_2258654cc0f69d37, __val_5c5ed695091ba342], "Type<MyUnion>");

var __val_d74cefa44e345d17 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: MyUnion; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_a41824426b6b1ede]
    ]);
    validators.stripExtras(data, ctx, ["success", "data"]);
    return data;
};

var __val_55e3fcb8d722f805 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["reason"], "{ reason: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["reason", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, ["reason"]);
    return data;
};

var __val_2d1db52869bf4329 = (v, path, ctx) => validators.literal(v, path, ctx, "active");

var __val_88e643147651d549 = (v, path, ctx) => validators.literal(v, path, ctx, "inactive");

var __val_857204a536cb022c = (v, path, ctx) => validators.union(v, path, ctx, [__val_55e3fcb8d722f805, __val_2d1db52869bf4329, __val_88e643147651d549], "Type<Status>");

var __val_2d6ea820a293bacf = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "s"], "{ success: boolean; s: Status; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["s", false, __val_857204a536cb022c]
    ]);
    validators.stripExtras(data, ctx, ["success", "s"]);
    return data;
};

var __val_affb28566d707e35 = (v, path, ctx) => validators.union(v, path, ctx, [__val_473287f8298dba71, __val_12886f9d00055adf], "Type<string|number>");

var __val_8c1c1b2d325f9de6 = (v, path, ctx) => validators.array(v, path, ctx, __val_affb28566d707e35);

var __val_a042f9877fc2376a = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: MixedArray; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_8c1c1b2d325f9de6]
    ]);
    validators.stripExtras(data, ctx, ["success", "data"]);
    return data;
};

var __val_eb045d78d2731073 = validators.undefined;

var __val_ca383f8818520f0b = (v, path, ctx) => validators.union(v, path, ctx, [__val_eb045d78d2731073, __val_04c78f82f98a8cf4], "Type<User|undefined>");

var __val_68aecd6fa646cade = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["id", "user", "tags"], "Nested");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["user", true, __val_ca383f8818520f0b],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    validators.stripExtras(data, ctx, ["id", "user", "tags"]);
    return data;
};

var __val_f0ac6e3a29009cf1 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: Nested; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_68aecd6fa646cade]
    ]);
    validators.stripExtras(data, ctx, ["success", "data"]);
    return data;
};

var __val_f28f8acf7e68cbfd = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["a", "b"], "Intersection");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["a", false, __val_473287f8298dba71],
        ["b", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, ["a", "b"]);
    return data;
};

var __val_0d157d33684c0018 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: Intersection; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_f28f8acf7e68cbfd]
    ]);
    validators.stripExtras(data, ctx, ["success", "data"]);
    return data;
};

var __val_85a41b63d9a32b8b = (v, path, ctx) => validators.union(v, path, ctx, [__val_2d1db52869bf4329, __val_88e643147651d549], "Type<\"active\"|\"inactive\">");

var __val_0084393b0d7248e4 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "status"], "{ success: boolean; status: \"active\" | \"inactive\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["status", false, __val_85a41b63d9a32b8b]
    ]);
    validators.stripExtras(data, ctx, ["success", "status"]);
    return data;
};

var __val_d9bb28ea073c815e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "tags"], "{ success: boolean; tags: string[]; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    validators.stripExtras(data, ctx, ["success", "tags"]);
    return data;
};

var __val_99c40ab405926cb5 = validators.date;

var __val_eefd1c8d7e793bf3 = validators.regexp;

var __val_75d012fe28656e0a = validators.bigint;

var __val_dfd1002a464a1dbf = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "age", "active", "date", "pattern", "big"], "{ success: boolean; age: number; active: boolean; date: string; pattern: string; big: string; }");
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
    validators.stripExtras(data, ctx, ["success", "age", "active", "date", "pattern", "big"]);
    return data;
};

var __val_91d782a2d0de1354 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["name", "active"], "{ name: string; active: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["active", false, __val_ced862ef1505bc73]
    ]);
    validators.stripExtras(data, ctx, ["name", "active"]);
    return data;
};

var __val_d979aa00a685cb05 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "user"], "{ success: boolean; user: { name: string; active: boolean; }; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["user", false, __val_91d782a2d0de1354]
    ]);
    validators.stripExtras(data, ctx, ["success", "user"]);
    return data;
};

var __val_32873a7f224f38d8 = (v, path, ctx) => validators.literal(v, path, ctx, "string");

var __val_628f6ca4b78e6b50 = (v, path, ctx) => validators.literal(v, path, ctx, "number");

var __val_46a7c6afe9b432e6 = (v, path, ctx) => validators.literal(v, path, ctx, "bigint");

var __val_1207c37d006fe9f8 = (v, path, ctx) => validators.literal(v, path, ctx, "boolean");

var __val_046317c2cffaf10d = (v, path, ctx) => validators.literal(v, path, ctx, "symbol");

var __val_df6b16b0e625bf20 = (v, path, ctx) => validators.literal(v, path, ctx, "undefined");

var __val_e64d77191bc932bb = (v, path, ctx) => validators.literal(v, path, ctx, "object");

var __val_9120d5d091aa5bf3 = (v, path, ctx) => validators.literal(v, path, ctx, "function");

var __val_1e1a258db2184d0e = (v, path, ctx) => validators.union(v, path, ctx, [__val_32873a7f224f38d8, __val_628f6ca4b78e6b50, __val_46a7c6afe9b432e6, __val_1207c37d006fe9f8, __val_046317c2cffaf10d, __val_df6b16b0e625bf20, __val_e64d77191bc932bb, __val_9120d5d091aa5bf3], "Type<\"string\"|\"number\"|\"bigint\"|\"boolean\"|\"symbol\"|\"undefined\"|\"object\"|\"function\">");

var __val_87e266a791052d41 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "val", "type"], "{ success: boolean; val: string | number; type: \"string\" | \"number\" | \"bigint\" | \"boolean\" | \"symbol\" | \"undefined\" | \"object\" | \"function\"; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["val", false, __val_affb28566d707e35],
        ["type", false, __val_1e1a258db2184d0e]
    ]);
    validators.stripExtras(data, ctx, ["success", "val", "type"]);
    return data;
};

var __val_9a141e74a6c02429 = (v, path, ctx) => validators.templateLiteral(v, path, ctx, new RegExp("^id-[0-9]+(\\.[0-9]+)?$"), "`id-${number}`");

var __val_6b50e5736cb6bb55 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "id"], "{ success: boolean; id: `id-${number}`; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["id", false, __val_9a141e74a6c02429]
    ]);
    validators.stripExtras(data, ctx, ["success", "id"]);
    return data;
};

var __val_c615b105fba1f965 = (v, path, ctx) => {
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

var __val_ed601a97123e74a5 = (v, path, ctx) => {
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

var __val_80803d497f4cbcc3 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "pass", "age"], "{ success: boolean; pass: string & MinLength<8, string>; age: number & Minimum<18, string>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["pass", false, __val_c615b105fba1f965],
        ["age", false, __val_ed601a97123e74a5]
    ]);
    validators.stripExtras(data, ctx, ["success", "pass", "age"]);
    return data;
};

var __val_61eb849c9ae845b0 = (v, path, ctx) => {
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

var __val_bf0f00a269610757 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["val"], "CustomUser");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["val", false, __val_61eb849c9ae845b0]
    ]);
    validators.stripExtras(data, ctx, ["val"]);
    return data;
};

var __val_70c31e2e47f17c8e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success", "data"], "{ success: boolean; data: CustomUser; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73],
        ["data", false, __val_bf0f00a269610757]
    ]);
    validators.stripExtras(data, ctx, ["success", "data"]);
    return data;
};

var __val_b237870e8da1ad64 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["message"], "{ message: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["message", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, ["message"]);
    return data;
};

var __val_0cedac632a9d5281 = (v, path, ctx) => {
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

var __val_cfef021b8ec13350 = (v, path, ctx) => {
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

var __val_51b5abe7e1ba2c24 = (v, path, ctx) => {
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

var __val_a421e7e861811a22 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["min", "max", "mult"], "{ min: number & ExclusiveMinimum<10, string>; max: number & ExclusiveMaximum<20, string>; mult: number & MultipleOf<5, string>; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["min", false, __val_0cedac632a9d5281],
        ["max", false, __val_cfef021b8ec13350],
        ["mult", false, __val_51b5abe7e1ba2c24]
    ]);
    validators.stripExtras(data, ctx, ["min", "max", "mult"]);
    return data;
};

var __val_354ede58aec83f6c = (v, path, ctx) => {
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

var __val_646f574aa5d2b8f1 = (v, path, ctx) => {
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

var __val_4c9f67db765233c6 = (v, path, ctx) => {
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

var __val_3142ae88ce6e4c32 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["email", "uuid", "date"], "{ email: string & Format<\"email\", string>; uuid: string & Format<\"uuid\", string>; date: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["email", false, __val_354ede58aec83f6c],
        ["uuid", false, __val_646f574aa5d2b8f1],
        ["date", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, ["email", "uuid", "date"]);
    return data;
};

var __val_669d5b02a3e3ee23 = (v, path, ctx) => {
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

var __val_3bf071592f56335a = (v, path, ctx) => validators.array(v, path, ctx, __val_12886f9d00055adf);

var __val_68211ffefc1b2e01 = (v, path, ctx) => {
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

var __val_d6749fa8772de8dd = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["msg", "dbUrl", "logged"], "{ msg: string; dbUrl: string; logged: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["msg", false, __val_473287f8298dba71],
        ["dbUrl", false, __val_473287f8298dba71],
        ["logged", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, ["msg", "dbUrl", "logged"]);
    return data;
};

var __val_ab68d46bd18d4a0a = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["dbUrl"], "{ dbUrl: string; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["dbUrl", false, __val_473287f8298dba71]
    ]);
    validators.stripExtras(data, ctx, ["dbUrl"]);
    return data;
};

var __val_e955dd67e417e2f5 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["success"], "{ success: boolean; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["success", false, __val_ced862ef1505bc73]
    ]);
    validators.stripExtras(data, ctx, ["success"]);
    return data;
};

var __val_07a8cc3cc8aea7a1 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["val"], "{ val: number; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["val", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, ["val"]);
    return data;
};

var __val_ccb10958b6aa7739 = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["a", "b"], "SumPayload");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["a", false, __val_12886f9d00055adf],
        ["b", false, __val_12886f9d00055adf]
    ]);
    validators.stripExtras(data, ctx, ["a", "b"]);
    return data;
};

var __val_74234e98afe7498f = validators.null;

var __val_6bd4d7da4d0dd205 = (v, path, ctx) => validators.union(v, path, ctx, [__val_74234e98afe7498f, __val_473287f8298dba71], "Type<string|null>");

var __val_8dc0b81821ea670e = (v, path, ctx) => {
    const obj = validators.object(v, path, ctx, ["one", "two"], "{ one: string | null; two: string | null; }");
    if (obj === false)
        return v;
    const data = validators.objectShell(obj, ctx);
    validators.props(obj, data, path, ctx, [
        ["one", false, __val_6bd4d7da4d0dd205],
        ["two", false, __val_6bd4d7da4d0dd205]
    ]);
    validators.stripExtras(data, ctx, ["one", "two"]);
    return data;
};


// --- ENDPOINTS ---
MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'strict',
	httpMethod: 'POST',
	path: '/type-safety/strict',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_04c78f82f98a8cf4,
			mode: 'strict'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_c67915707769fcf5
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'strictIntercepted',
	httpMethod: 'POST',
	path: '/type-safety/strict-intercepted',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_04c78f82f98a8cf4,
			mode: 'strict'
		}
	],
	guards: [],
	interceptors: [
		'GlobalErrorSanitizer'
	],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_c67915707769fcf5
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'strip',
	httpMethod: 'POST',
	path: '/type-safety/strip',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_04c78f82f98a8cf4,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_c67915707769fcf5
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'relaxed',
	httpMethod: 'POST',
	path: '/type-safety/relaxed',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_04c78f82f98a8cf4,
			mode: 'relaxed'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_c67915707769fcf5
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'union',
	httpMethod: 'POST',
	path: '/type-safety/union',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_a41824426b6b1ede,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_d74cefa44e345d17
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'status',
	httpMethod: 'GET',
	path: '/type-safety/status',
	params: [
		{
			source: 'Query',
			name: 's',
			validator: __val_857204a536cb022c,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_2d6ea820a293bacf
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'mixedArray',
	httpMethod: 'POST',
	path: '/type-safety/mixed-array',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_8c1c1b2d325f9de6,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_a042f9877fc2376a
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'nested',
	httpMethod: 'POST',
	path: '/type-safety/nested',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_68aecd6fa646cade,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_f0ac6e3a29009cf1
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'intersection',
	httpMethod: 'POST',
	path: '/type-safety/intersection',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_f28f8acf7e68cbfd,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_0d157d33684c0018
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'queryUnion',
	httpMethod: 'GET',
	path: '/type-safety/query-union',
	params: [
		{
			source: 'Query',
			name: 'status',
			validator: __val_85a41b63d9a32b8b
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_0084393b0d7248e4
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'arrayQuery',
	httpMethod: 'GET',
	path: '/type-safety/array-query',
	params: [
		{
			source: 'Query',
			name: 'tags',
			validator: __val_e5da2f9fabafe20e,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_d9bb28ea073c815e
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'coerce',
	httpMethod: 'GET',
	path: '/type-safety/coerce',
	params: [
		{
			source: 'Query',
			name: 'age',
			validator: __val_12886f9d00055adf
		},
		{
			source: 'Query',
			name: 'active',
			validator: __val_ced862ef1505bc73
		},
		{
			source: 'Query',
			name: 'date',
			validator: __val_99c40ab405926cb5
		},
		{
			source: 'Query',
			name: 'pattern',
			validator: __val_eefd1c8d7e793bf3
		},
		{
			source: 'Query',
			name: 'big',
			validator: __val_75d012fe28656e0a
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_dfd1002a464a1dbf
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'deepBoolean',
	httpMethod: 'GET',
	path: '/type-safety/deep-boolean',
	params: [
		{
			source: 'Query',
			name: 'user',
			validator: __val_91d782a2d0de1354
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_d979aa00a685cb05
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'coerceUnion',
	httpMethod: 'GET',
	path: '/type-safety/coerce-union',
	params: [
		{
			source: 'Query',
			name: 'val',
			validator: __val_affb28566d707e35
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_87e266a791052d41
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'templateLiteral',
	httpMethod: 'GET',
	path: '/type-safety/template-literal',
	params: [
		{
			source: 'Query',
			name: 'id',
			validator: __val_9a141e74a6c02429
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_6b50e5736cb6bb55
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'tags',
	httpMethod: 'GET',
	path: '/type-safety/tags',
	params: [
		{
			source: 'Query',
			name: 'pass',
			validator: __val_c615b105fba1f965
		},
		{
			source: 'Query',
			name: 'age',
			validator: __val_ed601a97123e74a5
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_80803d497f4cbcc3
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'customValidator',
	httpMethod: 'POST',
	path: '/type-safety/custom-validator',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_bf0f00a269610757,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_70c31e2e47f17c8e
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'headExplicit',
	httpMethod: 'HEAD',
	path: '/type-safety/head-explicit',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {}
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'getFallback',
	httpMethod: 'GET',
	path: '/type-safety/get-fallback',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_b237870e8da1ad64
});

MetadataStore.registerEndpoint({
	controller: 'TypeSafetyController',
	methodName: 'allVerbs',
	httpMethod: 'ALL',
	path: '/type-safety/all-verbs',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_b237870e8da1ad64
});

MetadataStore.registerEndpoint({
	controller: 'TagParityController',
	methodName: 'getNumber',
	httpMethod: 'GET',
	path: '/tag-parity/number',
	params: [
		{
			source: 'Query',
			name: 'min',
			validator: __val_0cedac632a9d5281
		},
		{
			source: 'Query',
			name: 'max',
			validator: __val_cfef021b8ec13350
		},
		{
			source: 'Query',
			name: 'mult',
			validator: __val_51b5abe7e1ba2c24
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_a421e7e861811a22
});

MetadataStore.registerEndpoint({
	controller: 'TagParityController',
	methodName: 'getString',
	httpMethod: 'GET',
	path: '/tag-parity/string',
	params: [
		{
			source: 'Query',
			name: 'email',
			validator: __val_354ede58aec83f6c
		},
		{
			source: 'Query',
			name: 'uuid',
			validator: __val_646f574aa5d2b8f1
		},
		{
			source: 'Query',
			name: 'date',
			validator: __val_4c9f67db765233c6
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_3142ae88ce6e4c32
});

MetadataStore.registerEndpoint({
	controller: 'TagParityController',
	methodName: 'postArray',
	httpMethod: 'POST',
	path: '/tag-parity/array',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_669d5b02a3e3ee23
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_669d5b02a3e3ee23
});

MetadataStore.registerEndpoint({
	controller: 'TagParityController',
	methodName: 'postUniqueArray',
	httpMethod: 'POST',
	path: '/tag-parity/unique-array',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_68211ffefc1b2e01
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_68211ffefc1b2e01
});

MetadataStore.registerEndpoint({
	controller: 'SecureController',
	methodName: 'getDefault',
	httpMethod: 'GET',
	path: '/secure-controller/default',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71,
	security: {
		frameguard: 'deny'
	}
});

MetadataStore.registerEndpoint({
	controller: 'SecureController',
	methodName: 'getOverride',
	httpMethod: 'GET',
	path: '/secure-controller/override',
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

MetadataStore.registerEndpoint({
	controller: 'InheritedController',
	methodName: 'getTest',
	httpMethod: 'GET',
	path: '/inherited/test',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71,
	security: {
		frameguard: 'deny',
		timeout: 500
	}
});

MetadataStore.registerEndpoint({
	controller: 'InheritedController',
	methodName: 'getOverride',
	httpMethod: 'GET',
	path: '/inherited/override',
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

MetadataStore.registerEndpoint({
	controller: 'DiTestController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/di/test',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_d6749fa8772de8dd
});

MetadataStore.registerEndpoint({
	controller: 'DiTestController',
	methodName: 'paramInject',
	httpMethod: 'GET',
	path: '/di/param-inject',
	params: [
		{
			source: 'Inject',
			name: 'DatabaseService',
			validator: ''
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_ab68d46bd18d4a0a
});

MetadataStore.registerEndpoint({
	controller: 'DiTestController',
	methodName: 'guarded',
	httpMethod: 'GET',
	path: '/di/guarded',
	params: [],
	guards: [
		{
			type: 'class',
			name: 'DiGuard',
			resolvers: [],
			params: [
				{
					source: 'Inject',
					name: 'DatabaseService',
					validator: ''
				}
			],
			isAsync: false
		}
	],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_e955dd67e417e2f5
});

MetadataStore.registerEndpoint({
	controller: 'DiTestController',
	methodName: 'guardedWithParams',
	httpMethod: 'GET',
	path: '/di/guarded-with-params',
	params: [],
	guards: [
		{
			type: 'class',
			name: 'DiGuard',
			resolvers: [
				'admin',
				123
			],
			params: [
				{
					source: 'Inject',
					name: 'DatabaseService',
					validator: ''
				}
			],
			isAsync: false
		}
	],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_e955dd67e417e2f5
});

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleWs',
	httpMethod: 'WS',
	path: '/realtime/ws',
	params: [
		{
			source: 'WebSocket',
			name: '',
			validator: ''
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		ws: true
	}
});

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleWsParams',
	httpMethod: 'WS',
	path: '/realtime/ws-params/:room',
	params: [
		{
			source: 'WebSocket',
			name: '',
			validator: ''
		},
		{
			source: 'Param',
			name: 'room',
			validator: __val_473287f8298dba71
		},
		{
			source: 'Query',
			name: 'token',
			validator: __val_473287f8298dba71
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		ws: true
	}
});

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleWsLimited',
	httpMethod: 'WS',
	path: '/realtime/ws-limited',
	params: [
		{
			source: 'WebSocket',
			name: '',
			validator: ''
		}
	],
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

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleWsHeartbeat',
	httpMethod: 'WS',
	path: '/realtime/ws-heartbeat',
	params: [
		{
			source: 'WebSocket',
			name: '',
			validator: ''
		}
	],
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

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleSse',
	httpMethod: 'GET',
	path: '/realtime/sse',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		sse: true
	},
	returnTypeValidator: __val_07a8cc3cc8aea7a1
});

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleSseStrip',
	httpMethod: 'GET',
	path: '/realtime/sse-strip',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		sse: true
	},
	returnTypeMode: 'strip',
	returnTypeValidator: __val_07a8cc3cc8aea7a1
});

MetadataStore.registerEndpoint({
	controller: 'RealtimeController',
	methodName: 'handleSseInvalid',
	httpMethod: 'GET',
	path: '/realtime/sse-invalid',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		sse: true
	},
	returnTypeMode: 'strict',
	returnTypeValidator: __val_07a8cc3cc8aea7a1
});

MetadataStore.registerEndpoint({
	controller: 'MathMicroserviceController',
	methodName: 'sum',
	httpMethod: 'RPC',
	path: 'math.sum',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_ccb10958b6aa7739
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		rpc: true
	},
	returnTypeValidator: __val_12886f9d00055adf
});

MetadataStore.registerEndpoint({
	controller: 'MathMicroserviceController',
	methodName: 'greet',
	httpMethod: 'RPC',
	path: 'math.greet',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_473287f8298dba71
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		rpc: true
	},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'MathMicroserviceController',
	methodName: 'notify',
	httpMethod: 'RPC',
	path: 'logs.notify',
	params: [
		{
			source: 'Body',
			name: '',
			validator: __val_473287f8298dba71
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		rpc: true,
		event: true
	}
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'getExact',
	httpMethod: 'GET',
	path: '/return-type/exact',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'getStrip',
	httpMethod: 'GET',
	path: '/return-type/strip',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'getInvalid',
	httpMethod: 'GET',
	path: '/return-type/invalid',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'getInferredBranch',
	httpMethod: 'GET',
	path: '/return-type/inferred-branch',
	params: [
		{
			source: 'Query',
			name: 'branch',
			validator: __val_473287f8298dba71
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'rpcExact',
	httpMethod: 'RPC',
	path: '/return-typerpc.exact',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		rpc: true
	},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'rpcStrip',
	httpMethod: 'RPC',
	path: '/return-typerpc.strip',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		rpc: true
	},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'ReturnTypeController',
	methodName: 'rpcInvalid',
	httpMethod: 'RPC',
	path: '/return-typerpc.invalid',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {
		rpc: true
	},
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'StrictResponseController',
	methodName: 'fail',
	httpMethod: 'GET',
	path: '/response-mode-strict/fail',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeMode: 'strict',
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'StrictResponseController',
	methodName: 'overrideRelaxed',
	httpMethod: 'GET',
	path: '/response-mode-strict/override-relaxed',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeMode: 'relaxed',
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'InheritedResponseController',
	methodName: 'inheritedRelaxed',
	httpMethod: 'GET',
	path: '/response-mode-inherited/inherited-relaxed',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeMode: 'relaxed',
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'InheritedResponseController',
	methodName: 'overrideStrict',
	httpMethod: 'GET',
	path: '/response-mode-inherited/override-strict',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeMode: 'strict',
	returnTypeValidator: __val_04c78f82f98a8cf4
});

MetadataStore.registerEndpoint({
	controller: 'UnprotectedClassController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/unprotected-class/test',
	params: [],
	guards: [
		{
			type: 'class',
			name: 'AnotherGuard',
			resolvers: [],
			params: [],
			isAsync: false
		}
	],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UnprotectedClassAllController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/unprotected-class-all/test',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UnprotectedMethodController',
	methodName: 'getOne',
	httpMethod: 'GET',
	path: '/unprotected-method/one',
	params: [],
	guards: [
		{
			type: 'class',
			name: 'AnotherGuard',
			resolvers: [],
			params: [],
			isAsync: false
		}
	],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UnprotectedMethodController',
	methodName: 'getAll',
	httpMethod: 'GET',
	path: '/unprotected-method/all',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UninterceptedClassController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/unintercepted-class/test',
	params: [],
	guards: [],
	interceptors: [
		'AnotherInterceptor'
	],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UninterceptedClassAllController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/unintercepted-class-all/test',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UninterceptedMethodController',
	methodName: 'getOne',
	httpMethod: 'GET',
	path: '/unintercepted-method/one',
	params: [],
	guards: [],
	interceptors: [
		'AnotherInterceptor'
	],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'UninterceptedMethodController',
	methodName: 'getAll',
	httpMethod: 'GET',
	path: '/unintercepted-method/all',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'MiddlewareTestController',
	methodName: 'both',
	httpMethod: 'GET',
	path: '/middleware-test/both',
	params: [
		{
			source: 'Request',
			name: '',
			validator: ''
		}
	],
	guards: [
		{
			type: 'class',
			name: 'MiddlewareCheckingGuard',
			resolvers: [],
			params: [
				{
					source: 'Request',
					name: '',
					validator: ''
				}
			],
			isAsync: false
		}
	],
	interceptors: [],
	middlewares: [
		'SimpleTestMiddleware',
		'CallbackTestMiddleware'
	],
	meta: {},
	returnTypeValidator: __val_8dc0b81821ea670e
});

MetadataStore.registerEndpoint({
	controller: 'MiddlewareTestController',
	methodName: 'override',
	httpMethod: 'GET',
	path: '/middleware-test/override',
	params: [
		{
			source: 'Request',
			name: '',
			validator: ''
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [
		'SimpleTestMiddleware'
	],
	meta: {},
	returnTypeValidator: __val_8dc0b81821ea670e
});

MetadataStore.registerEndpoint({
	controller: 'MiddlewareUnmiddlewareController',
	methodName: 'removeOne',
	httpMethod: 'GET',
	path: '/middleware-unmiddleware/remove-one',
	params: [
		{
			source: 'Request',
			name: '',
			validator: ''
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [
		'CallbackTestMiddleware'
	],
	meta: {},
	returnTypeValidator: __val_8dc0b81821ea670e
});

MetadataStore.registerEndpoint({
	controller: 'MiddlewareUnmiddlewareController',
	methodName: 'removeAll',
	httpMethod: 'GET',
	path: '/middleware-unmiddleware/remove-all',
	params: [
		{
			source: 'Request',
			name: '',
			validator: ''
		}
	],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_8dc0b81821ea670e
});

MetadataStore.registerEndpoint({
	controller: 'GuardInterceptorOrderController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/guard-interceptor-order/test',
	params: [],
	guards: [
		{
			type: 'class',
			name: 'FailingGuard',
			resolvers: [],
			params: [],
			isAsync: false
		}
	],
	interceptors: [
		'CountingInterceptor'
	],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'ClassPublicController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/class-public/test',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

MetadataStore.registerEndpoint({
	controller: 'MethodPublicController',
	methodName: 'test',
	httpMethod: 'GET',
	path: '/method-public/test',
	params: [],
	guards: [],
	interceptors: [],
	middlewares: [],
	meta: {},
	returnTypeValidator: __val_473287f8298dba71
});

