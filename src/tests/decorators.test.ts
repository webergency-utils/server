import { describe, it, expect } from 'vitest';
import { 
    Request, 
    Context, 
    Response, 
    Headers, 
    Ip, 
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
    Peer
} from '../decorators.js';

describe('Decorators', () => {
    it('should call parameter decorators (no-ops at runtime)', () => {
        // These are mostly for AOT but we call them for coverage
        Request({}, 'test', 0);
        Context({}, 'test', 0);
        Response({}, 'test', 0);
        Headers({}, 'test', 0);
        Ip({}, 'test', 0);
        
        Body({}, 'test', 0);
        Body('strict')({}, 'test', 0);
        
        Query({}, 'test', 0);
        Query('q')({}, 'test', 0);
        
        Param('id')({}, 'test', 0);
        Header('h')({}, 'test', 0);
        
        Peer({}, 'test', 0);
    });

    it('should call method and class decorators (no-ops at runtime)', () => {
        Public({});
        Public({}, 'test', {});
        
        Get('/')({}, 'test', {});
        Post('/')({}, 'test', {});
        Put('/')({}, 'test', {});
        Delete('/')({}, 'test', {});
        Patch('/')({}, 'test', {});
        
        Meta({ a: 1 })({}, 'test', {});
        Protect('G')({}, 'test', {});
        Intercept('I')({}, 'test', {});
        Cors('*')({}, 'test', {});
    });

    it('should execute Controller decorator logic', () => {
        const target = class Test {};
        Controller('/api')(target);
        expect((target.prototype as any).prefix).toBe('/api');
    });
});
