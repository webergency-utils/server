import { Controller, Post, Body, Get, Query, Intercept, Security, Inject, Injectable, Protect, Guard } from '../../index.js';

import { MinLength, MaxLength, Minimum, Maximum, Pattern, ExclusiveMinimum, ExclusiveMaximum, MultipleOf, Format, MinItems, MaxItems, UniqueItems, constraint } from '@webergency-utils/typechecker';

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
    tags(@Query('pass') pass: string & MinLength<8>, @Query('age') age: number & Minimum<18>) {
        return { success: true, pass, age };
    }

    @Post('/custom-validator')
    customValidator(@Body('strip') data: CustomUser) {
        return { success: true, data };
    }
}

@Controller('/tag-parity')
export class TagParityController {
    @Get('/number')
    getNumber(
        @Query('min') min: number & ExclusiveMinimum<10>,
        @Query('max') max: number & ExclusiveMaximum<20>,
        @Query('mult') mult: number & MultipleOf<5>
    ) {
        return { min, max, mult };
    }

    @Get('/string')
    getString(
        @Query('email') email: string & Format<'email'>,
        @Query('uuid') uuid: string & Format<'uuid'>,
        @Query('date') date: string & Format<'date'>
    ) {
        return { email, uuid, date };
    }

    @Post('/array')
    postArray(
        @Body() items: string[] & MinItems<2> & MaxItems<3>
    ) {
        return items;
    }

    @Post('/unique-array')
    postUniqueArray(
        @Body() items: number[] & UniqueItems
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
