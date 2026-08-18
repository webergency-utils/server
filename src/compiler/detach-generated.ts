import ts from 'typescript';

const NO_COMMENTS = ts.EmitFlags.NoComments | ts.EmitFlags.NoNestedComments;

/**
 * Generated validator / parser / serializer trees are parsed from templates, so
 * their `pos` values index into a throwaway file. Once those nodes are spliced
 * into a user source file, the emitter treats those positions as offsets in the
 * user text and reprints nearby comments in the middle of the generated JS.
 */
export function detachGeneratedExpression( expr: ts.Expression ): ts.Expression
{
    const walk = ( node: ts.Node ): void =>
    {
        ( node as { original?: ts.Node } ).original = undefined;
        ( node as { emitNode?: unknown } ).emitNode = undefined;
        ts.setTextRange( node, { pos : -1, end : -1 });
        ts.setEmitFlags( node, NO_COMMENTS );
        ts.forEachChild( node, walk, arr =>
        {
            for( const child of arr )
            {
                walk( child );
            }
        });
    };

    walk( expr );

    return expr;
}
