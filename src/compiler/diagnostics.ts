import ts from 'typescript';

/**
 * Codes are ours, not TypeScript's; they sit well above the compiler's range so a reader
 * can tell where the message came from.
 */
export const DiagnosticCode = {
    DECORATOR_MISUSE  : 90001,
    UNRESOLVED_CLASS  : 90002,
    INVALID_SIGNATURE : 90003,
    SCHEMA_GENERATION : 90004
} as const;

export type DiagnosticSink = ( diagnostic: ts.Diagnostic ) => void;

/**
 * Collects compile problems as `ts.Diagnostic` so a host can print them the way tsc does.
 *
 * Hosts that understand diagnostics (webergency-tsc, ts-patch) pass a sink and get normal
 * `file:line:col - error TS90001` output. Hosts that do not (the dev-time `register` loader,
 * a bare `ts.transform`) see `throwIfErrors()` raise the same messages, so a mistake is
 * never silently compiled away.
 */
export class DiagnosticReporter
{
    private readonly collected : ts.Diagnostic[] = [];

    public constructor( private readonly sink?: DiagnosticSink ) {}

    public get diagnostics(): readonly ts.Diagnostic[]
    {
        return this.collected;
    }

    public get errors(): ts.Diagnostic[]
    {
        return this.collected.filter( d => d.category === ts.DiagnosticCategory.Error );
    }

    /** True when a host is printing diagnostics itself, so nothing needs to be thrown. */
    public get reportsToHost(): boolean
    {
        return this.sink !== undefined;
    }

    public error( node: ts.Node, code: number, messageText: string ): void
    {
        this.add( node, code, messageText, ts.DiagnosticCategory.Error );
    }

    public warning( node: ts.Node, code: number, messageText: string ): void
    {
        this.add( node, code, messageText, ts.DiagnosticCategory.Warning );
    }

    private add( node: ts.Node, code: number, messageText: string, category: ts.DiagnosticCategory ): void
    {
        const file = node.getSourceFile();
        const diagnostic: ts.Diagnostic = {
            file,
            start  : node.getStart(),
            length : node.getWidth(),
            messageText,
            category,
            code,
            source : 'webergency'
        };

        this.collected.push( diagnostic );
        this.sink?.( diagnostic );
    }

    /** `[Compile Error] file:line:col - message`, one per line. */
    public formatErrors(): string
    {
        return this.errors.map(( d ) =>
        {
            const message = ts.flattenDiagnosticMessageText( d.messageText, '\n' );

            if( !d.file || d.start === undefined ) { return `[Compile Error] ${message}` }

            const { line, character } = d.file.getLineAndCharacterOfPosition( d.start );

            return `[Compile Error] ${d.file.fileName}:${line + 1}:${character + 1} - ${message}`;
        }).join( '\n' );
    }

    /** For hosts without diagnostic support: surface errors the only way they will notice. */
    public throwIfErrors(): void
    {
        if( this.reportsToHost || this.errors.length === 0 ) { return }

        throw new Error( this.formatErrors());
    }
}
