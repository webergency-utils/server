import { describe, it, expect } from 'vitest';
import * as index from '../src/index.js';

describe( 'Exports & Config', () =>
{
    it( 'should export ApplicationRegistry and registry helpers', () =>
    {
        expect( index.ApplicationRegistry ).toBeDefined();
        expect( index.runWithRegistry ).toBeDefined();
        expect( index.getRegistry ).toBeDefined();
    });

    it( 'should export Symbol AOT metadata helpers', () =>
    {
        expect( index.getControllerMeta ).toBeDefined();
        expect( index.getInjectableMeta ).toBeDefined();
        expect( index.getModuleMeta ).toBeDefined();
        expect( index.getGuardMeta ).toBeDefined();
        expect( index.WEBERGENCY_GUARD ).toBeDefined();
    });

    it( 'should export the Reviver decorator', () =>
    {
        expect( index.Reviver ).toBeDefined();
        expect(( index as Record<string, unknown> ).resolveReviver ).toBeUndefined();
        expect(( index as Record<string, unknown> ).reviveTree ).toBeUndefined();
    });

    it( 'should export all main components', () =>
    {
        expect( index.Server ).toBeDefined();
        expect( index.Context ).toBeDefined();
        expect( ( index as any ).MetadataStore ).toBeUndefined();
    });
});
