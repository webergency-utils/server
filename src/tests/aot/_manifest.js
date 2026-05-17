import { MetadataStore } from '@webergency-utils/server';
import { validators } from '@webergency-utils/typechecker';
import { TypeSafetyController } from './controllers.js';
import { TagParityController } from './controllers.js';

// --- EXTERNAL MANIFESTS ---

// --- SINGLETONS ---
const _instance_TypeSafetyController = new TypeSafetyController();
MetadataStore.registerController('TypeSafetyController', _instance_TypeSafetyController);
const _instance_TagParityController = new TagParityController();
MetadataStore.registerController('TagParityController', _instance_TagParityController);

// --- VALIDATORS ---
var __val_473287f8298dba71 = validators.string;

var __val_12886f9d00055adf = validators.number;

var __val_04c78f82f98a8cf4 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["name", "age"], "User"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["age", false, __val_12886f9d00055adf]
    ]);
    return data;
};

var __val_6d1570e5b8d6d45a = (v, path, ctx) => validators.literal(v, path, ctx, "simple");

var __val_2258654cc0f69d37 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["type", "val"], "{ type: \"simple\"; val: string; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["type", false, __val_6d1570e5b8d6d45a],
        ["val", false, __val_473287f8298dba71]
    ]);
    return data;
};

var __val_68056e96638382b6 = (v, path, ctx) => validators.literal(v, path, ctx, "complex");

var __val_e5da2f9fabafe20e = (v, path, ctx) => validators.array(v, path, ctx, __val_473287f8298dba71);

var __val_b421a9236dfde58e = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["id", "tags"], "{ id: number; tags: string[]; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};

var __val_5c5ed695091ba342 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["type", "data"], "{ type: \"complex\"; data: { id: number; tags: string[]; }; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["type", false, __val_68056e96638382b6],
        ["data", false, __val_b421a9236dfde58e]
    ]);
    return data;
};

var __val_3822c46f03d891bb = (v, path, ctx) => validators.union(v, path, ctx, [__val_2258654cc0f69d37, __val_5c5ed695091ba342]);

var __val_2d1db52869bf4329 = (v, path, ctx) => validators.literal(v, path, ctx, "active");

var __val_88e643147651d549 = (v, path, ctx) => validators.literal(v, path, ctx, "inactive");

var __val_55e3fcb8d722f805 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["reason"], "{ reason: string; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["reason", false, __val_473287f8298dba71]
    ]);
    return data;
};

var __val_857204a536cb022c = (v, path, ctx) => validators.union(v, path, ctx, [__val_2d1db52869bf4329, __val_88e643147651d549, __val_55e3fcb8d722f805]);

var __val_affb28566d707e35 = (v, path, ctx) => validators.union(v, path, ctx, [__val_473287f8298dba71, __val_12886f9d00055adf]);

var __val_8c1c1b2d325f9de6 = (v, path, ctx) => validators.array(v, path, ctx, __val_affb28566d707e35);

var __val_ee0036d6218e9d04 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["id", "user", "tags"], "Nested"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["id", false, __val_12886f9d00055adf],
        ["user", true, __val_04c78f82f98a8cf4],
        ["tags", false, __val_e5da2f9fabafe20e]
    ]);
    return data;
};

var __val_1ecb4c157494e4eb = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["a"], "{ a: string; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["a", false, __val_473287f8298dba71]
    ]);
    return data;
};

var __val_5a59b4127f6bdb93 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["b"], "{ b: number; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["b", false, __val_12886f9d00055adf]
    ]);
    return data;
};

var __val_f28f8acf7e68cbfd = (v, path, ctx) => {
    const checks = [__val_1ecb4c157494e4eb, __val_5a59b4127f6bdb93];
    let data = ctx.mode === "strip" ? (typeof v === "object" && v !== null && !Array.isArray(v) ? {} : v) : v;
    for (let i = 0; i < checks.length; i++) {
        const val = checks[i](v, path, ctx);
        if (ctx.mode === "strip" && typeof val === "object" && val !== null)
            Object.assign(data, val);
    }
    return data;
};

var __val_85a41b63d9a32b8b = (v, path, ctx) => validators.union(v, path, ctx, [__val_2d1db52869bf4329, __val_88e643147651d549]);

var __val_d31fde334b3f24e2 = (v, path, ctx) => validators.literal(v, path, ctx, false);

var __val_561da1284502fef1 = (v, path, ctx) => validators.literal(v, path, ctx, true);

var __val_ced862ef1505bc73 = (v, path, ctx) => validators.union(v, path, ctx, [__val_d31fde334b3f24e2, __val_561da1284502fef1]);

var __val_aff9105ecab8ebe6 = validators.date;

var __val_0c5e9ccfab9b6861 = validators.regexp;

var __val_75d012fe28656e0a = validators.bigint;

var __val_91d782a2d0de1354 = (v, path, ctx) => {
    if (!validators.object(v, path, ctx, ["name", "active"], "{ name: string; active: boolean; }"))
        return v;
    let data = ctx.mode === "strip" ? {} : v;
    validators.props(v, data, path, ctx, [
        ["name", false, __val_473287f8298dba71],
        ["active", false, __val_ced862ef1505bc73]
    ]);
    return data;
};

var __val_9a141e74a6c02429 = (v, path, ctx) => validators.templateLiteral(v, path, ctx, new RegExp("^id-[0-9]+(\\.[0-9]+)?$"), "`id-${number}`");

var __val_1ec226ab681d53d9 = (v, path, ctx) => {
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

var __val_37c14191d7986595 = (v, path, ctx) => {
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

var __val_6e9d6dc4e79aca25 = (v, path, ctx) => {
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

var __val_3f5a160666ebabc6 = (v, path, ctx) => {
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

var __val_ef10024629c72e9e = (v, path, ctx) => {
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

var __val_56d21ddd31fd7b13 = (v, path, ctx) => {
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

var __val_f1148b0341282e7b = (v, path, ctx) => {
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

var __val_dbeae6ee7b504b21 = (v, path, ctx) => {
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

var __val_6140e60a8304d25a = (v, path, ctx) => {
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

var __val_8eb9a2d0e4390fe9 = (v, path, ctx) => {
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
	meta: {}
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
	meta: {}
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
	meta: {}
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
	meta: {}
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
			validator: __val_3822c46f03d891bb,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
	meta: {}
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
	meta: {}
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
			validator: __val_ee0036d6218e9d04,
			mode: 'strip'
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
	meta: {}
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
	meta: {}
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
	meta: {}
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
			validator: __val_aff9105ecab8ebe6
		},
		{
			source: 'Query',
			name: 'pattern',
			validator: __val_0c5e9ccfab9b6861
		},
		{
			source: 'Query',
			name: 'big',
			validator: __val_75d012fe28656e0a
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
	meta: {}
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
	meta: {}
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
	meta: {}
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
			validator: __val_1ec226ab681d53d9
		},
		{
			source: 'Query',
			name: 'age',
			validator: __val_37c14191d7986595
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
			validator: __val_6e9d6dc4e79aca25
		},
		{
			source: 'Query',
			name: 'max',
			validator: __val_3f5a160666ebabc6
		},
		{
			source: 'Query',
			name: 'mult',
			validator: __val_ef10024629c72e9e
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
			validator: __val_56d21ddd31fd7b13
		},
		{
			source: 'Query',
			name: 'uuid',
			validator: __val_f1148b0341282e7b
		},
		{
			source: 'Query',
			name: 'date',
			validator: __val_dbeae6ee7b504b21
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
			validator: __val_6140e60a8304d25a
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
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
			validator: __val_8eb9a2d0e4390fe9
		}
	],
	guards: [],
	interceptors: [],
	meta: {}
});

