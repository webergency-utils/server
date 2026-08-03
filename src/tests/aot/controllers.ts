import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Guard, Ws, Sse, ServerWebSocket, Param, Header, Cookie, MessagePattern, EventPattern, Payload, Head, Options, All, ResponseMode, Unprotect, Unintercept, Use, OverrideUse, Unuse, EndpointRequest, EndpointResponse, Public, Middleware, Seo, Internal, SeoForward } from '../../index.js';

import { constraint, format, tag } from '@webergency-utils/typechecker';

export const isEvenNumber = ( val: number ) => val % 2 === 0;

export interface CustomUser {
    val : number & constraint.Custom<typeof isEvenNumber>
}

export interface User {
    name : string
    age  : number
}

export type Status = 'active' | 'inactive' | { reason : string };

export type MixedArray = ( string | number )[];

export interface Nested {
    id    : number
    user? : User
    tags  : string[]
}

export type Intersection = { a : string } & { b : number };

export type MyUnion = 
    | { type : 'simple', val : string }
    | { type : 'complex', data : { id : number, tags : string[] } };

export class GlobalErrorSanitizer {
    async intercept(req: any, next: any) {
        const response = await next();
        if( response.status === 400 ) 
        {
            const clone = response.clone();
            try 
            {
                const data = await clone.json();
                if( data.success === false && data.errors ) 
                {
                    return new Response( JSON.stringify({ 
                        success : false, 
                        message : 'Internal Server Error' 
                    }), { 
                        status  : 500,
                        headers : { 'Content-Type' : 'application/json' }
                    });
                }
            }
            catch ( e ) {}
        }
        return response;
    }
}

@Controller( '/type-safety' )
export class TypeSafetyController 
{
    
    @Post( '/strict' )
    strict( @Body( 'strict' ) data: User ) 
    {
        return { success : true, data };
    }

    @Post( '/strict-intercepted' )
    @Intercept( GlobalErrorSanitizer )
    strictIntercepted( @Body( 'strict' ) data: User ) 
    {
        return { success : true, data };
    }

    @Post( '/strip' )
    strip( @Body( 'strip' ) data: User ) 
    {
        return { success : true, data };
    }

    @Post( '/relaxed' )
    relaxed( @Body( 'relaxed' ) data: User ) 
    {
        return { success : true, data };
    }

    @Post( '/union' )
    union( @Body( 'strip' ) data: MyUnion ) 
    {
        return { success : true, data };
    }

    @Get( '/status' )
    status( @Query( 's', 'strip' ) s: Status ) 
    {
        return { success : true, s };
    }

    @Post( '/mixed-array' )
    mixedArray( @Body( 'strip' ) data: MixedArray ) 
    {
        return { success : true, data };
    }

    @Post( '/nested' )
    nested( @Body( 'strip' ) data: Nested ) 
    {
        return { success : true, data };
    }

    @Post( '/intersection' )
    intersection( @Body( 'strip' ) data: Intersection ) 
    {
        return { success : true, data };
    }

    @Get( '/query-union' )
    queryUnion( @Query( 'status' ) status: 'active' | 'inactive' ) 
    {
        return { success : true, status };
    }

    @Get( '/array-query' )
    arrayQuery( @Query( 'tags', 'strip' ) tags: string[]) 
    {
        return { success : true, tags };
    }

    @Get( '/coerce' )
    coerce(
        @Query( 'age' ) age: number,
        @Query( 'active' ) active: boolean,
        @Query( 'date' ) date: Date,
        @Query( 'pattern' ) pattern: RegExp,
        @Query( 'big' ) big: bigint
    ) 
    {
        return { success : true, age, active, date : date.toISOString(), pattern : pattern.toString(), big : big.toString() };
    }

    @Get( '/deep-boolean' )
    deepBoolean( @Query( 'user' ) user: { name : string, active : boolean }) 
    {
        return { success : true, user };
    }

    @Get( '/coerce-union' )
    coerceUnion( @Query( 'val' ) val: string | number ) 
    {
        return { success : true, val, type : typeof val };
    }

    @Get( '/template-literal' )
    templateLiteral( @Query( 'id' ) id: `id-${number}` ) 
    {
        return { success : true, id };
    }

    @Get( '/tags' )
    tags( @Query( 'pass' ) pass: string & constraint.MinLength<8>, @Query( 'age' ) age: number & constraint.Minimum<18> ) 
    {
        return { success : true, pass, age };
    }

    @Post( '/custom-validator' )
    customValidator( @Body( 'strip' ) data: CustomUser ) 
    {
        return { success : true, data };
    }

    @Head( '/head-explicit' )
    headExplicit(): void 
    {
        // void return
    }

    @Options( '/options-explicit' )
    optionsExplicit() 
    {
        return { message : 'hello from options' };
    }

    @Get( '/get-fallback' )
    getFallback() 
    {
        return { message : 'hello from get fallback' };
    }

    @All( '/all-verbs' )
    allVerbs() 
    {
        return { message : 'hello from all verbs' };
    }
}

@Controller( '/tag-parity' )
export class TagParityController 
{
    @Get( '/number' )
    getNumber(
        @Query( 'min' ) min: number & constraint.ExclusiveMinimum<10>,
        @Query( 'max' ) max: number & constraint.ExclusiveMaximum<20>,
        @Query( 'mult' ) mult: number & constraint.MultipleOf<5>
    ) 
    {
        return { min, max, mult };
    }

    @Get( '/string' )
    getString(
        @Query( 'email' ) email: string & constraint.Format<'email'>,
        @Query( 'uuid' ) uuid: string & constraint.Format<'uuid'>,
        @Query( 'date' ) date: string & constraint.Format<'date'>
    ) 
    {
        // from:query revives format.Date to a Date; serialize back for the string return shape
        const dateStr = date instanceof Date ? date.toISOString().slice( 0, 10 ) : date;

        return { email, uuid, date : dateStr };
    }

    @Post( '/array' )
    postArray(
        @Body() items: string[] & constraint.MinItems<2> & constraint.MaxItems<3>
    ) 
    {
        return items;
    }

    @Post( '/unique-array' )
    postUniqueArray(
        @Body() items: number[] & constraint.UniqueItems
    ) 
    {
        return items;
    }
}

@Controller( '/secure-controller' )
@Security({ frameguard : 'deny' })
export class SecureController 
{
    @Get( '/default' )
    getDefault() 
    {
        return 'ok';
    }

    @Get( '/override' )
    @Security({ frameguard : false })
    getOverride() 
    {
        return 'ok';
    }
}

@Controller()
@Security({ frameguard : 'deny', timeout : 500 })
export class BaseController {}

@Controller( '/inherited' )
export class InheritedController extends BaseController 
{
    @Get( '/test' )
    getTest() 
    {
        return 'ok';
    }

    @Get( '/override' )
    @Security({ frameguard : false })
    getOverride() 
    {
        return 'ok';
    }
}

// --- Dependency Injection (DI) Tests ---

@Injectable()
export class ConfigService 
{
    get( key: string ): string 
    {
        if( key === 'db.url' ) { return 'mongodb://localhost:27017' }

        if( key === 'api.secret' ) { return 'super-secret-key' }

        return '';
    }
}

@Injectable()
export class DatabaseService 
{
    constructor( public configService: ConfigService ) {}
    
    getUrl() 
    {
        return this.configService.get( 'db.url' );
    }
}

@Injectable()
export class LoggerService 
{
    log( msg: string ) 
    {
        return `[LOG] ${msg}`;
    }
}

@Injectable()
export class BaseService 
{
    @Inject( LoggerService )
    public logger! : LoggerService;
}

@Injectable()
export class ChildService extends BaseService 
{
    constructor( public dbService: DatabaseService ) 
    {
        super();
    }

    getMessage() 
    {
        return this.logger.log( `DB URL is ${this.dbService.getUrl()}` );
    }
}

@Injectable()
export class DiGuard implements Guard 
{
    @Inject( LoggerService )
    public logger! : LoggerService;

    constructor( public configService: ConfigService ) {}

    use( @Inject( DatabaseService ) db: DatabaseService ) 
    {
        const url = db.getUrl();

        if( url !== 'mongodb://localhost:27017' ) 
        {
            throw { code : 403, message : 'Forbidden by Guard' };
        }
        this.logger.log( `Guard checked URL: ${url}` );
    }
}

@Controller( '/di' )
export class DiTestController 
{
    @Inject( LoggerService )
    public logger! : LoggerService;

    constructor(
        public childService: ChildService,
        public configService: ConfigService
    ) {}

    @Get( '/test' )
    test() 
    {
        return {
            msg    : this.childService.getMessage(),
            dbUrl  : this.configService.get( 'db.url' ),
            logged : this.logger.log( 'hello' )
        };
    }

    @Get( '/param-inject' )
    paramInject( @Inject( DatabaseService ) db: DatabaseService ) 
    {
        return { dbUrl : db.getUrl() };
    }

    @Get( '/guarded' )
    @Protect( DiGuard )
    guarded() 
    {
        return { success : true };
    }

    @Get( '/guarded-with-params' )
    @Protect( DiGuard, 'admin', 123 )
    guardedWithParams() 
    {
        return { success : true };
    }
}

@Controller( '/realtime' )
export class RealtimeController 
{
    @Ws( '/ws' )
    handleWs( ws: ServerWebSocket ) 
    {
        ws.on( 'message', ( msg: any ) => 
        {
            ws.send( `Echo: ${msg}` );
        });
    }

    @Ws( '/ws-params/:room' )
    handleWsParams(
        ws: ServerWebSocket,
        @Param( 'room' ) room: string,
        @Query( 'token' ) token: string
    ) 
    {
        ws.send( `Room: ${room}, Token: ${token}` );
        ws.on( 'message', ( msg: any ) => 
        {
            ws.send( msg );
        });
    }

    @Ws( '/ws-limited', { maxPayload : 10 })
    handleWsLimited( ws: ServerWebSocket ) 
    {
        ws.on( 'message', ( msg: any ) => 
        {
            ws.send( msg );
        });
    }

    @Ws( '/ws-heartbeat', { pingInterval : 100, pingTimeout : 50 })
    handleWsHeartbeat( ws: ServerWebSocket ) 
    {
        // Heartbeat verification endpoint
    }

    @Sse( '/sse' )
    async *handleSse(): AsyncGenerator<{ event : string; data : { val : number } }> 
    {
        yield { event : 'update', data : { val : 1 } };
        yield { event : 'update', data : { val : 2 } };
    }

    @Sse( '/sse-strip' )
    @ResponseMode( 'strip' )
    async *handleSseStrip(): AsyncGenerator<{ event : string; data : { val : number } }> 
    {
        yield { event : 'update', data : { val : 1, extra : 'gone' } as any };
    }

    @Sse( '/sse-invalid' )
    @ResponseMode( 'strict' )
    async *handleSseInvalid(): AsyncGenerator<{ event : string; data : { val : number } }> 
    {
        yield { event : 'update', data : { val : 'nope' } as any };
    }
}

export interface SumPayload {
    a : number
    b : number
}

@Controller()
export class MathMicroserviceController 
{
    lastNotify: string | undefined;

    @MessagePattern( 'math.sum' )
    sum( @Payload() data: SumPayload ) 
    {
        return data.a + data.b;
    }

    @MessagePattern( 'math.greet' )
    greet( @Payload() name: string ) 
    {
        return `Hello, ${name}!`;
    }

    @EventPattern( 'logs.notify' )
    notify( @Payload() msg: string ) 
    {
        this.lastNotify = msg;
    }
}

export interface TestReturnUser {
    name : string
    age  : number
}

@Controller( '/return-type' )
export class ReturnTypeController 
{
    @Get( '/exact' )
    getExact(): TestReturnUser 
    {
        return { name : 'Alice', age : 25 };
    }

    @Get( '/strip' )
    getStrip(): TestReturnUser 
    {
        return { name : 'Bob', age : 30, extraField : 'should-be-stripped' } as any;
    }

    @Get( '/invalid' )
    getInvalid(): TestReturnUser 
    {
        return { name : 'Charlie', age : 'thirty' } as any;
    }

    @Get( '/inferred-branch' )
    getInferredBranch(
        @Query( 'branch' ) branch: string
    ) 
    {
        if( branch === 'a' ) 
        {
            return { name : 'Jack', age : 50 };
        }
        else 
        {
            return { name : 'Jill', age : 60 };
        }
    }

    @MessagePattern( 'rpc.exact' )
    rpcExact(): TestReturnUser 
    {
        return { name : 'Dave', age : 40 };
    }

    @MessagePattern( 'rpc.strip' )
    rpcStrip(): TestReturnUser 
    {
        return { name : 'Eve', age : 45, secret : 'ignore-me' } as any;
    }

    @MessagePattern( 'rpc.invalid' )
    rpcInvalid(): TestReturnUser 
    {
        return { name : 'Frank' } as any;
    }
}

@Controller( '/response-mode-strict' )
@ResponseMode( 'strict' )
export class StrictResponseController 
{
    @Get( '/fail' )
    fail(): TestReturnUser 
    {
        return { name : 'Strict', age : 10, extra : 'not-allowed' } as any;
    }

    @Get( '/override-relaxed' )
    @ResponseMode( 'relaxed' )
    overrideRelaxed(): TestReturnUser 
    {
        return { name : 'RelaxedOverride', age : 20, extra : 'kept' } as any;
    }
}

@Controller()
@ResponseMode( 'relaxed' )
export class BaseRelaxedController {}

@Controller( '/response-mode-inherited' )
export class InheritedResponseController extends BaseRelaxedController 
{
    @Get( '/inherited-relaxed' )
    inheritedRelaxed(): TestReturnUser 
    {
        return { name : 'InheritedRelaxed', age : 30, extra : 'inherited-kept' } as any;
    }

    @Get( '/override-strict' )
    @ResponseMode( 'strict' )
    overrideStrict(): TestReturnUser 
    {
        return { name : 'StrictOverride', age : 40, extra : 'fail' } as any;
    }
}

@Injectable()
export class SimpleGuard implements Guard 
{
    use() 
    {
        return true;
    }
}

@Injectable()
export class AnotherGuard implements Guard 
{
    use() 
    {
        return true;
    }
}

@Controller( '/unprotected-class-base' )
@Protect( SimpleGuard )
@Protect( AnotherGuard )
export class UnprotectedBaseController {}

@Controller( '/unprotected-class' )
@Unprotect( SimpleGuard )
export class UnprotectedClassController extends UnprotectedBaseController 
{
    @Get( '/test' )
    test() 
    {
        return 'ok';
    }
}

@Controller( '/unprotected-class-all' )
@Unprotect
export class UnprotectedClassAllController extends UnprotectedBaseController 
{
    @Get( '/test' )
    test() 
    {
        return 'ok';
    }
}

@Controller( '/unprotected-method' )
@Protect( SimpleGuard )
@Protect( AnotherGuard )
export class UnprotectedMethodController 
{
    @Get( '/one' )
    @Unprotect( SimpleGuard )
    getOne() 
    {
        return 'ok';
    }

    @Get( '/all' )
    @Unprotect
    getAll() 
    {
        return 'ok';
    }
}

export class SimpleInterceptor {
    intercept(req: any, next: any) { return next(); }
}

export class AnotherInterceptor {
    intercept(req: any, next: any) { return next(); }
}

@Controller( '/unintercepted-class-base' )
@Intercept( SimpleInterceptor )
@Intercept( AnotherInterceptor )
export class UninterceptedBaseController {}

@Controller( '/unintercepted-class' )
@Unintercept( SimpleInterceptor )
export class UninterceptedClassController extends UninterceptedBaseController 
{
    @Get( '/test' )
    test() 
    {
        return 'ok';
    }
}

@Controller( '/unintercepted-class-all' )
@Unintercept
export class UninterceptedClassAllController extends UninterceptedBaseController 
{
    @Get( '/test' )
    test() 
    {
        return 'ok';
    }
}

@Controller( '/unintercepted-method' )
@Intercept( SimpleInterceptor )
@Intercept( AnotherInterceptor )
export class UninterceptedMethodController 
{
    @Get( '/one' )
    @Unintercept( SimpleInterceptor )
    getOne() 
    {
        return 'ok';
    }

    @Get( '/all' )
    @Unintercept
    getAll() 
    {
        return 'ok';
    }
}

// --- Middleware Integration Tests ---

@Injectable()
export class SimpleTestMiddleware implements Middleware 
{
    use( req: EndpointRequest, res: EndpointResponse ) 
    {
        req.headers['x-middleware-one'] = 'active';
        res.header( 'x-middleware-res-one', 'response-active' );
    }
}

@Injectable()
export class CallbackTestMiddleware implements Middleware 
{
    async useCallback( req: EndpointRequest, res: EndpointResponse, next: (error?: any) => Promise<void> | void ) 
    {
        req.headers['x-middleware-two'] = 'callback-active';
        res.header( 'x-middleware-res-two', 'response-callback-active' );
        await next();
    }
}

@Injectable()
export class MiddlewareCheckingGuard implements Guard 
{
    use( req: EndpointRequest ) 
    {
        const one = req.headers['x-middleware-one'];
        if( !one ) 
        {
            throw { status : 403, message : 'Middleware did not run before Guard' };
        }
    }
}

@Controller( '/middleware-test' )
@Use( SimpleTestMiddleware, CallbackTestMiddleware )
export class MiddlewareTestController 
{
    @Get( '/both' )
    @Protect( MiddlewareCheckingGuard )
    both( req: EndpointRequest ): { one: string | null, two: string | null }
    {
        return {
            one : req.headers['x-middleware-one'] ?? null,
            two : req.headers['x-middleware-two'] ?? null
        };
    }

    @Get( '/override' )
    @OverrideUse( SimpleTestMiddleware )
    override( req: EndpointRequest ): { one: string | null, two: string | null }
    {
        return {
            one : req.headers['x-middleware-one'] ?? null,
            two : req.headers['x-middleware-two'] ?? null
        };
    }
}

@Controller( '/middleware-unmiddleware' )
@Use( SimpleTestMiddleware, CallbackTestMiddleware )
export class MiddlewareUnmiddlewareController 
{
    @Get( '/remove-one' )
    @Unuse( SimpleTestMiddleware )
    removeOne( req: EndpointRequest ): { one: string | null, two: string | null }
    {
        return {
            one : req.headers['x-middleware-one'] ?? null,
            two : req.headers['x-middleware-two'] ?? null
        };
    }

    @Get( '/remove-all' )
    @Unuse
    removeAll( req: EndpointRequest ): { one: string | null, two: string | null }
    {
        return {
            one : req.headers['x-middleware-one'] ?? null,
            two : req.headers['x-middleware-two'] ?? null
        };
    }
}

@Injectable()
export class FailingGuard implements Guard 
{
    use() 
    {
        throw { status : 403, message : 'Guard Failed' };
    }
}

export class CountingInterceptor 
{
    static callCount = 0;
    async intercept( req: any, next: any ) 
    {
        CountingInterceptor.callCount++;
        return next();
    }
}

@Controller( '/guard-interceptor-order' )
export class GuardInterceptorOrderController 
{
    @Get( '/test' )
    @Protect( FailingGuard )
    @Intercept( CountingInterceptor )
    test() 
    {
        return 'ok';
    }
}

@Injectable()
export class PublicDenyGuard implements Guard 
{
    use() 
    {
        throw { status : 403, message : 'Denied by PublicDenyGuard' };
    }
}

@Controller( '/class-public' )
@Public
@Protect( PublicDenyGuard )
export class ClassPublicController 
{
    @Get( '/test' )
    @Protect( PublicDenyGuard )
    test() 
    {
        return 'ok';
    }
}

@Controller( '/method-public' )
@Protect( PublicDenyGuard )
export class MethodPublicController 
{
    @Get( '/test' )
    @Public
    test() 
    {
        return 'ok';
    }
}

@Controller()
@Seo
export class SeoEmitController 
{
    @Get( '/seo/blog/:slug' )
    blog( @Param( 'slug' ) slug: string ): SeoForward | void
    {
        if( slug === 'miss' ){ return }

        return { method : 'GET', path : `/seo/posts/${slug}` };
    }
}

@Controller()
export class SeoTargetController 
{
    @Get( '/seo/posts/:id' )
    show( @Param( 'id' ) id: string )
    {
        return { id };
    }
}

@Controller()
@Internal
export class InternalEmitController 
{
    @Get( '/_internal/seo-secret' )
    secret()
    {
        return { secret : true };
    }
}

@Controller()
@Seo
export class SeoToInternalController 
{
    @Get( '/seo/pretty' )
    go(): SeoForward
    {
        return { method : 'GET', path : '/_internal/seo-secret' };
    }
}

/**
 * Exercises AOT `from: 'string'` parsers for Param / Header / Cookie
 * (no parseQueryString) and typed urlencoded Body via `parserQuery`.
 */
@Controller( '/scalar-wire' )
export class ScalarWireController
{
    @Get( '/param/:id' )
    paramId( @Param( 'id' ) id: string )
    {
        return { id, type : typeof id };
    }

    @Get( '/param-num/:n' )
    paramNum( @Param( 'n' ) n: number )
    {
        return { n, type : typeof n };
    }

    @Get( '/header' )
    headerToken( @Header( 'x-token' ) token: string )
    {
        return { token, type : typeof token };
    }

    @Get( '/cookie' )
    cookieSession( @Cookie( 'session' ) session: string )
    {
        return { session, type : typeof session };
    }

    @Get( '/combo/:attachmentId' )
    combo(
        @Param( 'attachmentId' ) attachmentId: string,
        @Header( 'x-token' ) token: string,
        @Cookie( 'flag' ) flag: string
    )
    {
        return { attachmentId, token, flag };
    }

    @Post( '/form' )
    form( @Body() data: User )
    {
        return { success : true, data, ageType : typeof data.age };
    }
}