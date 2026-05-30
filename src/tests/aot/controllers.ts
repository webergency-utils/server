import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Guard, Ws, Sse, ServerWebSocket, Param, MessagePattern, EventPattern, Payload, Head, All, ResponseMode } from '../../index.js';

import { constraint, format, tag } from '@webergency-utils/typechecker';

export const isEvenNumber = (val: number) => val % 2 === 0;

export interface CustomUser {
    val: number & constraint.Custom<typeof isEvenNumber>;
}

export interface User {
    name: string;
    age: number;
}

export type Status = 'active' | 'inactive' | { reason: string };

export type MixedArray = (string | number)[];

export interface Nested {
    id: number;
    user?: User;
    tags: string[];
}

export type Intersection = { a: string } & { b: number };

export type MyUnion = 
    | { type: 'simple', val: string }
    | { type: 'complex', data: { id: number, tags: string[] } };

@Controller('/type-safety')
export class TypeSafetyController {
    
    @Post('/strict')
    strict(@Body('strict') data: User) {
        return { success: true, data };
    }

    @Post('/strict-intercepted')
    @Intercept('GlobalErrorSanitizer')
    strictIntercepted(@Body('strict') data: User) {
        return { success: true, data };
    }

    @Post('/strip')
    strip(@Body('strip') data: User) {
        return { success: true, data };
    }

    @Post('/relaxed')
    relaxed(@Body('relaxed') data: User) {
        return { success: true, data };
    }

    @Post('/union')
    union(@Body('strip') data: MyUnion) {
        return { success: true, data };
    }

    @Get('/status')
    status(@Query('s', 'strip') s: Status) {
        return { success: true, s };
    }

    @Post('/mixed-array')
    mixedArray(@Body('strip') data: MixedArray) {
        return { success: true, data };
    }

    @Post('/nested')
    nested(@Body('strip') data: Nested) {
        return { success: true, data };
    }

    @Post('/intersection')
    intersection(@Body('strip') data: Intersection) {
        return { success: true, data };
    }

    @Get('/query-union')
    queryUnion(@Query('status') status: 'active' | 'inactive') {
        return { success: true, status };
    }

    @Get('/array-query')
    arrayQuery(@Query('tags', 'strip') tags: string[]) {
        return { success: true, tags };
    }

    @Get('/coerce')
    coerce(
        @Query('age') age: number,
        @Query('active') active: boolean,
        @Query('date') date: Date,
        @Query('pattern') pattern: RegExp,
        @Query('big') big: bigint
    ) {
        return { success: true, age, active, date: date.toISOString(), pattern: pattern.toString(), big: big.toString() };
    }

    @Get('/deep-boolean')
    deepBoolean(@Query('user') user: { name: string, active: boolean }) {
        return { success: true, user };
    }

    @Get('/coerce-union')
    coerceUnion(@Query('val') val: string | number) {
        return { success: true, val, type: typeof val };
    }

    @Get('/template-literal')
    templateLiteral(@Query('id') id: `id-${number}`) {
        return { success: true, id };
    }

    @Get('/tags')
    tags(@Query('pass') pass: string & constraint.MinLength<8>, @Query('age') age: number & constraint.Minimum<18>) {
        return { success: true, pass, age };
    }

    @Post('/custom-validator')
    customValidator(@Body('strip') data: CustomUser) {
        return { success: true, data };
    }

    @Head('/head-explicit')
    headExplicit(): void {
        // void return
    }

    @Get('/get-fallback')
    getFallback() {
        return { message: 'hello from get fallback' };
    }

    @All('/all-verbs')
    allVerbs() {
        return { message: 'hello from all verbs' };
    }
}

@Controller('/tag-parity')
export class TagParityController {
    @Get('/number')
    getNumber(
        @Query('min') min: number & constraint.ExclusiveMinimum<10>,
        @Query('max') max: number & constraint.ExclusiveMaximum<20>,
        @Query('mult') mult: number & constraint.MultipleOf<5>
    ) {
        return { min, max, mult };
    }

    @Get('/string')
    getString(
        @Query('email') email: string & constraint.Format<'email'>,
        @Query('uuid') uuid: string & constraint.Format<'uuid'>,
        @Query('date') date: string & constraint.Format<'date'>
    ) {
        return { email, uuid, date };
    }

    @Post('/array')
    postArray(
        @Body() items: string[] & constraint.MinItems<2> & constraint.MaxItems<3>
    ) {
        return items;
    }

    @Post('/unique-array')
    postUniqueArray(
        @Body() items: number[] & constraint.UniqueItems
    ) {
        return items;
    }
}

@Controller('/secure-controller')
@Security({ frameguard: 'deny' })
export class SecureController {
    @Get('/default')
    getDefault() {
        return 'ok';
    }

    @Get('/override')
    @Security({ frameguard: false })
    getOverride() {
        return 'ok';
    }
}

@Controller()
@Security({ frameguard: 'deny', timeout: 500 })
export class BaseController {}

@Controller('/inherited')
export class InheritedController extends BaseController {
    @Get('/test')
    getTest() {
        return 'ok';
    }

    @Get('/override')
    @Security({ frameguard: false })
    getOverride() {
        return 'ok';
    }
}

// --- Dependency Injection (DI) Tests ---

@Injectable()
export class ConfigService {
    get(key: string): string {
        if (key === 'db.url') return 'mongodb://localhost:27017';
        if (key === 'api.secret') return 'super-secret-key';
        return '';
    }
}

@Injectable()
export class DatabaseService {
    constructor(public configService: ConfigService) {}
    
    getUrl() {
        return this.configService.get('db.url');
    }
}

@Injectable()
export class LoggerService {
    log(msg: string) {
        return `[LOG] ${msg}`;
    }
}

@Injectable()
export class BaseService {
    @Inject(LoggerService)
    public logger!: LoggerService;
}

@Injectable()
export class ChildService extends BaseService {
    constructor(public dbService: DatabaseService) {
        super();
    }

    getMessage() {
        return this.logger.log(`DB URL is ${this.dbService.getUrl()}`);
    }
}

@Injectable()
export class DiGuard implements Guard {
    @Inject(LoggerService)
    public logger!: LoggerService;

    constructor(public configService: ConfigService) {}

    use(@Inject(DatabaseService) db: DatabaseService) {
        const url = db.getUrl();
        if (url !== 'mongodb://localhost:27017') {
            throw { code: 403, message: 'Forbidden by Guard' };
        }
        this.logger.log(`Guard checked URL: ${url}`);
    }
}

@Controller('/di')
export class DiTestController {
    @Inject(LoggerService)
    public logger!: LoggerService;

    constructor(
        public childService: ChildService,
        public configService: ConfigService
    ) {}

    @Get('/test')
    test() {
        return {
            msg: this.childService.getMessage(),
            dbUrl: this.configService.get('db.url'),
            logged: this.logger.log('hello')
        };
    }

    @Get('/param-inject')
    paramInject(@Inject(DatabaseService) db: DatabaseService) {
        return { dbUrl: db.getUrl() };
    }

    @Get('/guarded')
    @Protect(DiGuard)
    guarded() {
        return { success: true };
    }
}

@Controller('/realtime')
export class RealtimeController {
    @Ws('/ws')
    handleWs(ws: ServerWebSocket) {
        ws.on('message', (msg: any) => {
            ws.send(`Echo: ${msg}`);
        });
    }

    @Ws('/ws-params/:room')
    handleWsParams(
        ws: ServerWebSocket,
        @Param('room') room: string,
        @Query('token') token: string
    ) {
        ws.send(`Room: ${room}, Token: ${token}`);
        ws.on('message', (msg: any) => {
            ws.send(msg);
        });
    }

    @Ws('/ws-limited', { maxPayload: 10 })
    handleWsLimited(ws: ServerWebSocket) {
        ws.on('message', (msg: any) => {
            ws.send(msg);
        });
    }

    @Ws('/ws-heartbeat', { pingInterval: 100, pingTimeout: 50 })
    handleWsHeartbeat(ws: ServerWebSocket) {
        // Heartbeat verification endpoint
    }

    @Sse('/sse')
    async *handleSse() {
        yield { event: 'update', data: { val: 1 } };
        yield { event: 'update', data: { val: 2 } };
    }
}

export interface SumPayload {
    a: number;
    b: number;
}

@Controller()
export class MathMicroserviceController {
    @MessagePattern('math.sum')
    sum(@Payload() data: SumPayload) {
        return data.a + data.b;
    }

    @MessagePattern('math.greet')
    greet(@Payload() name: string) {
        return `Hello, ${name}!`;
    }

    @EventPattern('logs.notify')
    notify(@Payload() msg: string) {
        // Event listener
    }
}

export interface TestReturnUser {
    name: string;
    age: number;
}

@Controller('/return-type')
export class ReturnTypeController {
    @Get('/exact')
    getExact(): TestReturnUser {
        return { name: 'Alice', age: 25 };
    }

    @Get('/strip')
    getStrip(): TestReturnUser {
        return { name: 'Bob', age: 30, extraField: 'should-be-stripped' } as any;
    }

    @Get('/invalid')
    getInvalid(): TestReturnUser {
        return { name: 'Charlie', age: 'thirty' } as any;
    }

    @Get('/inferred-branch')
    getInferredBranch(
        @Query('branch') branch: string
    ) {
        if (branch === 'a') {
            return { name: 'Jack', age: 50 };
        } else {
            return { name: 'Jill', age: 60 };
        }
    }

    @MessagePattern('rpc.exact')
    rpcExact(): TestReturnUser {
        return { name: 'Dave', age: 40 };
    }

    @MessagePattern('rpc.strip')
    rpcStrip(): TestReturnUser {
        return { name: 'Eve', age: 45, secret: 'ignore-me' } as any;
    }

    @MessagePattern('rpc.invalid')
    rpcInvalid(): TestReturnUser {
        return { name: 'Frank' } as any;
    }
}

@Controller('/response-mode-strict')
@ResponseMode('strict')
export class StrictResponseController {
    @Get('/fail')
    fail(): TestReturnUser {
        return { name: 'Strict', age: 10, extra: 'not-allowed' } as any;
    }

    @Get('/override-relaxed')
    @ResponseMode('relaxed')
    overrideRelaxed(): TestReturnUser {
        return { name: 'RelaxedOverride', age: 20, extra: 'kept' } as any;
    }
}

@Controller()
@ResponseMode('relaxed')
export class BaseRelaxedController {}

@Controller('/response-mode-inherited')
export class InheritedResponseController extends BaseRelaxedController {
    @Get('/inherited-relaxed')
    inheritedRelaxed(): TestReturnUser {
        return { name: 'InheritedRelaxed', age: 30, extra: 'inherited-kept' } as any;
    }

    @Get('/override-strict')
    @ResponseMode('strict')
    overrideStrict(): TestReturnUser {
        return { name: 'StrictOverride', age: 40, extra: 'fail' } as any;
    }
}

