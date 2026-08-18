import { describe, it, expect } from 'vitest';
import { 
    Request, 
    Context, 
    Response, 
    Headers, 
    Ip,
    Url,
    Hostname,
    Path,
    RawBody,
    Body, 
    Query, 
    Param, 
    Header, 
    Public, 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Patch, 
    Meta, 
    Protect, 
    Intercept, 
    Cors,
    Reviver,
    Peer,
    Cookies,
    Cookie,
    File,
    Files,
    Inject,
    Injectable,
    Module,
    Global,
    Scope,
    OverrideProtect,
    OverrideIntercept,
    ConnectedSocket,
    Unuse
} from '../src/decorators.js';


describe( 'Decorators', () => 
{
    it( 'should call parameter decorators (no-ops at runtime)', () => 
    {
        // These are mostly for AOT but we call them for coverage
        Request({}, 'test', 0 );
        Context({}, 'test', 0 );
        Response({}, 'test', 0 );
        Headers({}, 'test', 0 );
        Ip({}, 'test', 0 );
        Url({}, 'test', 0 );
        Hostname({}, 'test', 0 );
        Path({}, 'test', 0 );
        RawBody({}, 'test', 0 );
        
        Body({}, 'test', 0 );
        Body( 'strict' )({}, 'test', 0 );
        
        Query({}, 'test', 0 );
        Query( 'q' )({}, 'test', 0 );
        
        Param( 'id' )({}, 'test', 0 );
        Header( 'h' )({}, 'test', 0 );
        
        Peer({}, 'test', 0 );
        Cookies({}, 'test', 0 );
        Cookie( 'c' )({}, 'test', 0 );
        Files()({}, 'test', 0 );
        File( 'avatar' )({}, 'test', 0 );
        File({ dest : '/tmp' })({}, 'test', {});
        File();

        // Direct decorator usage (paren-free)
        Inject({}, 'test', 0 );
        Inject({}, 'test' );

        // Factory decorator usage
        Inject( 'token' )({}, 'test', 0 );
    });

    it( 'should call method and class decorators (no-ops at runtime)', () => 
    {
        Public({});
        Public({}, 'test', {});
        
        Get( '/' )({}, 'test', {});
        Post( '/' )({}, 'test', {});
        Put( '/' )({}, 'test', {});
        Delete( '/' )({}, 'test', {});
        Patch( '/' )({}, 'test', {});
        
        Meta({ a : 1 })({}, 'test', {});
        Protect( 'G' )({}, 'test', {});
        Intercept( 'I' )({}, 'test', {});
        Cors( '*' )({}, 'test', {});
        Reviver( null )({}, 'test', {});
        Reviver(( _key: string, value: any ) => value )({}, 'test', {});
    });

    it( 'should execute Controller decorator logic', () => 
    {
        const target = class Test {};
        Controller( '/api' )( target );
        expect(( target.prototype as any ).prefix ).toBe( '/api' );
    });

    it( 'should set Controller/Injectable/Module/Global metadata', () =>
    {
        // Arrange
        class Ctrl {}
        class Svc {}
        class Mod {}
        class GlobalMod {}

        // Act
        Controller({ path : '/v1', scope : Scope.REQUEST })( Ctrl );
        Injectable({ scope : Scope.TRANSIENT })( Svc );
        Module({
            imports     : [],
            controllers : [ Ctrl ],
            providers   : [ Svc ],
            exports     : [ Svc ]
        })( Mod );
        Global()( GlobalMod );
        Module({ providers : [] })( GlobalMod );
        Global()( GlobalMod );
        OverrideProtect( class G {} );
        OverrideIntercept( class I {} );
        ConnectedSocket()({}, 'sock', 0 );

        // Assert
        expect(( Ctrl.prototype as any ).prefix ).toBe( '/v1' );
        expect(( Ctrl as any ).__scope__ ).toBe( Scope.REQUEST );
        expect(( Svc as any ).__scope__ ).toBe( Scope.TRANSIENT );
        expect(( Mod as any ).__moduleMetadata__.controllers ).toEqual([ Ctrl ]);
        expect(( Mod as any )[Symbol.for( 'webergency.server.module' )].global ).toBe( false );
        expect(( GlobalMod as any ).__isGlobal__ ).toBe( true );
        expect(( GlobalMod as any )[Symbol.for( 'webergency.server.module' )].global ).toBe( true );
    });

    it( 'should handle Unuse identity and class-decorator forms', () =>
    {
        // Arrange
        class NotMiddleware {}
        class RealMw { use(){} }
        const desc = { value : () => {} };
        const Target = class T {};

        // Act / Assert
        expect( Unuse( NotMiddleware )).toBe( NotMiddleware );
        expect( Unuse( {}, 'm', desc )).toBe( desc );
        expect( typeof Unuse( RealMw )).toBe( 'function' );
        expect( Unuse()( Target )).toBe( Target );
    });
});
