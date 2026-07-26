import { describe, it, expect } from 'vitest';
import * as index from '../index.js';

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
    });

    it( 'should export all main components', () =>
    {
        expect( index.Server ).toBeDefined();
        expect( index.Context ).toBeDefined();
        expect( ( index as any ).MetadataStore ).toBeUndefined();
    });
});
