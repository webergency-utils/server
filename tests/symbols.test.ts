import { describe, it, expect } from 'vitest';
import {
    WEBERGENCY_CONTROLLER,
    WEBERGENCY_MODULE,
    WEBERGENCY_INJECTABLE,
    WEBERGENCY_METADATA,
    getControllerMeta,
    setControllerMeta,
    getModuleMeta,
    setModuleMeta,
    getInjectableMeta,
    setInjectableMeta,
    getCustomMetadataBag,
    ensureCustomMetadataBag
} from '../src/core/symbols.js';

describe( 'AOT Symbol metadata helpers', () =>
{
    it( 'should set and get controller meta', () =>
    {
        // Arrange
        class Ctrl {}

        // Act
        setControllerMeta( Ctrl, { endpoints : [] });

        // Assert
        expect( getControllerMeta( Ctrl )).toEqual({ endpoints : [] });
        expect( Ctrl[WEBERGENCY_CONTROLLER]).toEqual({ endpoints : [] });
    });

    it( 'should prefer Symbol module meta and fall back to __moduleMetadata__', () =>
    {
        // Arrange
        class ModA {}
        class ModB {}
        setModuleMeta( ModA, { controllers : [], global : true });
        ( ModB as any ).__moduleMetadata__ = { providers : [] };
        ( ModB as any ).__isGlobal__ = true;

        // Act / Assert
        expect( getModuleMeta( ModA )).toEqual({ controllers : [], global : true });
        expect( getModuleMeta( ModB )).toEqual({ providers : [], global : true });
        expect( ModA[WEBERGENCY_MODULE]).toBeDefined();
    });

    it( 'should set and get injectable meta', () =>
    {
        // Arrange
        class Svc {}

        // Act
        setInjectableMeta( Svc, { kind : 'provider', token : 'Svc' });

        // Assert
        expect( getInjectableMeta( Svc )).toEqual({ kind : 'provider', token : 'Svc' });
        expect( Svc[WEBERGENCY_INJECTABLE].token ).toBe( 'Svc' );
    });

    it( 'should ensure a shared custom metadata bag mirrored on __metadata__', () =>
    {
        // Arrange
        class Host {}
        ( Host as any ).__metadata__ = { legacy : 1 };

        // Act
        const bag = ensureCustomMetadataBag( Host );
        bag.extra = true;

        // Assert
        expect( getCustomMetadataBag( Host )).toBe( bag );
        expect( Host[WEBERGENCY_METADATA]).toBe( bag );
        expect(( Host as any ).__metadata__).toBe( bag );
        expect( bag.legacy ).toBe( 1 );
        expect( bag.extra ).toBe( true );
    });

    it( 'should return undefined meta readers for empty targets', () =>
    {
        // Arrange / Act / Assert
        expect( getControllerMeta( undefined )).toBeUndefined();
        expect( getModuleMeta({})).toBeUndefined();
        expect( getInjectableMeta({})).toBeUndefined();
        expect( getCustomMetadataBag({})).toBeUndefined();
    });
});
