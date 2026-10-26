#!/usr/bin/env node
/**
 * Automatically approves and merges all open Dependabot pull requests targeting `main`.
 *
 * Usage:
 *   node scripts/merge-dependabot.mjs [options]
 *   npm run dependabot -- [options]
 *
 * Options:
 *   --base <branch>   Target base branch (default: main)
 *   --squash          Squash and merge (default)
 *   --rebase          Rebase and merge
 *   --merge           Create a merge commit
 *   --auto            Enable GitHub auto-merge instead of immediate merge
 *   --admin           Use administrator privileges to bypass branch protection / failing checks
 *   --dry-run         List matching Dependabot PRs without approving or merging
 */
import { execFileSync } from 'node:child_process';

const DEPENDABOT_LOGINS = new Set([
    'app/dependabot',
    'dependabot[bot]',
    'dependabot'
]);

function parseArgs( argv )
{
    const opts = {
        base     : 'main',
        strategy : '--squash',
        auto     : false,
        admin    : false,
        dryRun   : false
    };

    for( let i = 0; i < argv.length; i++ )
    {
        const arg = argv[i];

        if( arg === '--base' && argv[i + 1])
        {
            opts.base = argv[++i];
        }
        else if( arg === '--squash' || arg === '--rebase' || arg === '--merge' )
        {
            opts.strategy = arg;
        }
        else if( arg === '--auto' )
        {
            opts.auto = true;
        }
        else if( arg === '--admin' )
        {
            opts.admin = true;
        }
        else if( arg === '--dry-run' )
        {
            opts.dryRun = true;
        }
    }

    return opts;
}

function runGh( args, allowFailure = false )
{
    try
    {
        return execFileSync( 'gh', args, {
            encoding : 'utf8',
            stdio    : [ 'ignore', 'pipe', 'pipe' ]
        }).trim();
    }
    catch( err )
    {
        if( allowFailure )
        {
            return null;
        }

        const stderr = err.stderr ? String( err.stderr ).trim() : err.message;

        throw new Error( stderr || `gh ${args.join( ' ' )} failed` );
    }
}

function listDependabotPrs( base )
{
    const raw = runGh([
        'pr',
        'list',
        '--state',
        'open',
        '--base',
        base,
        '--limit',
        '100',
        '--json',
        'number,title,author,baseRefName,headRefName,isDraft,mergeable,mergeStateStatus,url'
    ]);

    const allPrs = JSON.parse( raw || '[]' );

    return allPrs
        .filter(( pr ) => !pr.isDraft && DEPENDABOT_LOGINS.has( pr.author?.login ))
        .sort(( a, b ) => a.number - b.number );
}

function getFreshPrState( number )
{
    const raw = runGh([
        'pr',
        'view',
        String( number ),
        '--json',
        'state,mergeable,mergeStateStatus'
    ], true );

    return raw ? JSON.parse( raw ) : null;
}

function main()
{
    const opts = parseArgs( process.argv.slice( 2 ));
    const prs = listDependabotPrs( opts.base );

    if( prs.length === 0 )
    {
        console.log( `No open Dependabot PRs targeting '${opts.base}'.` );

        return;
    }

    console.log( `Found ${prs.length} open Dependabot PR(s) targeting '${opts.base}':` );

    for( const pr of prs )
    {
        console.log( `  #${pr.number}: ${pr.title} [${pr.mergeStateStatus || pr.mergeable || 'UNKNOWN'}]` );
    }

    if( opts.dryRun )
    {
        console.log( '\nDry run complete — no PRs were modified.' );

        return;
    }

    let mergedCount = 0;
    let queuedCount = 0;
    let failedCount = 0;

    for( const pr of prs )
    {
        console.log( `\nProcessing PR #${pr.number}: ${pr.title}` );

        // 1. Approve the PR (best-effort)
        runGh([ 'pr', 'review', String( pr.number ), '--approve' ], true );

        // 2. Re-check fresh merge state (previous merge in loop may have advanced base branch)
        const fresh = getFreshPrState( pr.number ) || pr;

        if( fresh.state && fresh.state !== 'OPEN' )
        {
            console.log( `  ✔ PR #${pr.number} is already ${fresh.state}` );
            continue;
        }

        if( fresh.mergeStateStatus === 'BEHIND' && !opts.admin )
        {
            console.log( `  Updating branch for PR #${pr.number}...` );
            const updated = runGh([ 'pr', 'update-branch', String( pr.number ), '--rebase' ], true );

            if( updated === null )
            {
                runGh([ 'pr', 'comment', String( pr.number ), '--body', '@dependabot rebase' ], true );
            }
        }

        // 3. Merge (or enable auto-merge)
        const mergeArgs = [
            'pr',
            'merge',
            String( pr.number ),
            opts.strategy,
            '--delete-branch'
        ];

        if( opts.auto )
        {
            mergeArgs.push( '--auto' );
        }

        if( opts.admin )
        {
            mergeArgs.push( '--admin' );
        }

        try
        {
            runGh( mergeArgs );

            if( opts.auto )
            {
                console.log( `  ✔ Auto-merge enabled for PR #${pr.number}` );
                queuedCount++;
            }
            else
            {
                console.log( `  ✔ Merged PR #${pr.number}` );
                mergedCount++;
            }
        }
        catch( err )
        {
            // Fallback to --auto when direct merge is blocked by pending status checks
            if( !opts.auto && !opts.admin )
            {
                const autoOutcome = runGh([ ...mergeArgs, '--auto' ], true );

                if( autoOutcome !== null )
                {
                    console.log( `  ✔ Auto-merge enabled for PR #${pr.number} (waiting on status checks)` );
                    queuedCount++;
                    continue;
                }
            }

            console.error( `  ✖ Failed to merge PR #${pr.number}: ${err.message}` );

            if( !opts.admin && fresh.mergeStateStatus === 'BLOCKED' )
            {
                console.error( '    Tip: re-run with `npm run dependabot -- --admin` to bypass branch protection.' );
            }

            failedCount++;
        }
    }

    console.log( `\nSummary: ${mergedCount} merged, ${queuedCount} queued for auto-merge, ${failedCount} failed.` );

    if( failedCount > 0 )
    {
        process.exitCode = 1;
    }
}

main();
