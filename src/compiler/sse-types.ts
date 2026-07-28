import ts from 'typescript';

const STREAM_TYPE_NAMES = new Set([
    'AsyncGenerator',
    'AsyncIterable',
    'AsyncIterableIterator',
    'Generator',
    'Iterable',
    'IterableIterator'
]);

/**
 * For @Sse handlers: unwrap AsyncGenerator/Iterable yield type, then prefer the `data`
 * property type when the yield looks like an SSE envelope.
 */
export function unwrapSsePayloadType( returnType: ts.Type, checker: ts.TypeChecker ): ts.Type | undefined
{
    let type = returnType;
    const symbolName = type.aliasSymbol?.getName() || type.symbol?.getName();

    if( symbolName && STREAM_TYPE_NAMES.has( symbolName ))
    {
        let typeArgs: readonly ts.Type[] | undefined;

        try
        {
            typeArgs = checker.getTypeArguments( type as ts.TypeReference );
        }
        catch
        {
            typeArgs = ( type as ts.TypeReference ).typeArguments;
        }

        if( !typeArgs?.[0]){ return undefined }
        type = typeArgs[0];
    }

    const dataProp = checker.getPropertyOfType( type, 'data' );

    if( dataProp )
    {
        return checker.getTypeOfSymbol( dataProp );
    }

    return type;
}
