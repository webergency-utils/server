import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import path from 'node:path';
import { createRegistry, generateManifestCode } from '../compiler/transformer.js';

describe( 'generateManifestCode', () =>
{
    it( 'should emit imports, registrations, validators, and endpoints', () =>
    {
        // Arrange
        const registry = createRegistry();
        const root = path.resolve( '/proj/src' );
        registry.controllers.set( 'AppController', {
            path       : path.join( root, 'app.controller.ts' ),
            injections : new Map()
        });
        registry.guards.set( 'AuthGuard', { path : path.join( root, 'auth.guard.ts' ), params : [] });
        registry.interceptors.set( 'LogInterceptor', { path : path.join( root, 'log.interceptor.ts' ) });
        registry.providers.set( 'AppService', { path : path.join( root, 'app.service.ts' ) });
        registry.modules.set( 'AppModule', { path : path.join( root, 'app.module.ts' ) });
        registry.externalManifests.add( path.join( root, 'vendor/_metadata.manifest.js' ));
        registry.validators.set( 'abc123', ts.factory.createIdentifier( 'validators.string' ));
        registry.endpoints.push({
            httpMethod   : 'GET',
            path         : '/hi',
            controller   : 'AppController',
            methodName   : 'hi',
            guards       : [{ type : 'class', name : 'AuthGuard' }],
            interceptors : [],
            params       : [],
            validator    : 'abc123',
            meta         : { custom : { __raw_code__ : 'Date.now()' } }
        });

        // Act
        const code = generateManifestCode( registry, new Map(), path.join( root, '_metadata.manifest.js' ));

        // Assert
        expect( code ).toContain( "registerGuard('AuthGuard'" );
        expect( code ).toContain( "registerInterceptor('LogInterceptor'" );
        expect( code ).toContain( "registerController('AppController'" );
        expect( code ).toContain( "registerProvider('AppService'" );
        expect( code ).toContain( "registerModule('AppModule'" );
        expect( code ).toContain( "import * as __tcRuntime from '@webergency-utils/typechecker/runtime'" );
        expect( code ).toContain( 'const validators = __tcRuntime.validators' );
        expect( code ).toContain( 'EXTERNAL MANIFESTS' );
        expect( code ).toContain( 'var __val_abc123' );
        expect( code ).toContain( 'registerEndpoint' );
    });
});
