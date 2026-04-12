/**
 * Apply all RLS policies from scripts/enable-rls.sql directly to Supabase.
 *
 * Run: node scripts/apply-rls-direct.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Read env ────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found. Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf-8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.+)`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : process.env[key];
};

const SUPABASE_URL  = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY   = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const DB_PASSWORD   = getEnv('SUPABASE_DB_PASSWORD');   // optional but required for direct connection
const PROJECT_REF   = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';

if (!SUPABASE_URL) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL not set in .env.local');
    process.exit(1);
}
if (!PROJECT_REF) {
    console.error('ERROR: Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
}

if (!DB_PASSWORD) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('  SUPABASE_DB_PASSWORD not set in .env.local');
    console.error('');
    console.error('  To get it: Supabase Dashboard → Project Settings');
    console.error('             → Database → Database password (Reset if needed)');
    console.error('');
    console.error('  Add to .env.local:');
    console.error('    SUPABASE_DB_PASSWORD=your-database-password');
    console.error('');
    console.error('  OR run the SQL manually (no install needed):');
    console.error(`  → https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    console.error('    Paste the contents of: scripts/enable-rls.sql');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
}

// ─── Load SQL from file ───────────────────────────────────────────────────────
const sqlFilePath = path.resolve(__dirname, 'enable-rls.sql');
if (!fs.existsSync(sqlFilePath)) {
    console.error(`ERROR: ${sqlFilePath} not found.`);
    process.exit(1);
}
const rawSql = fs.readFileSync(sqlFilePath, 'utf-8');

/**
 * Split the SQL file into individual statements.
 * Handles multi-line statements and $$ dollar-quoted function bodies.
 */
function splitStatements(sql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';

    const lines = sql.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Skip pure comment lines and blanks (outside statements)
        if (!inDollarQuote && (trimmed.startsWith('--') || trimmed === '')) {
            if (current.trim()) current += '\n';
            continue;
        }

        current += line + '\n';

        // Detect entering/leaving dollar-quoted string
        if (!inDollarQuote) {
            const match = line.match(/(\$[^$]*\$)/g);
            if (match) {
                inDollarQuote = true;
                dollarTag = match[0];
            }
        } else {
            if (line.includes(dollarTag)) {
                inDollarQuote = false;
                dollarTag = '';
            }
        }

        // A semicolon at end of trimmed line terminates the statement
        if (!inDollarQuote && trimmed.endsWith(';')) {
            const stmt = current.trim();
            if (stmt && stmt !== ';') statements.push(stmt);
            current = '';
        }
    }
    if (current.trim()) statements.push(current.trim());
    return statements;
}

const SQL_STATEMENTS = splitStatements(rawSql).filter(s => {
    const upper = s.toUpperCase().trim();
    // Skip the verification SELECT (last query in file) during apply
    return !upper.startsWith('SELECT');
});

// ─── Connection helpers ───────────────────────────────────────────────────────
// Supabase uses the actual DB password (not the service role JWT) for direct connections.
const poolerConn  = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
const directConn  = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

async function tryConnect(connStr, label) {
    console.log(`Trying ${label}...`);
    const client = new pg.Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 12000,
    });
    try {
        await client.connect();
        console.log(`✓ Connected via ${label}\n`);
        return client;
    } catch (err) {
        console.log(`✗ ${label} failed: ${err.message}`);
        return null;
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('======================================================');
    console.log('   SAMBATEK — Applying RLS Policies to Supabase');
    console.log('======================================================');
    console.log(`Project: ${PROJECT_REF}`);
    console.log(`SQL statements to apply: ${SQL_STATEMENTS.length}\n`);

    // Try Supavisor pooler first, then direct connection
    let client = await tryConnect(poolerConn, 'Supavisor pooler (port 6543)');
    if (!client) client = await tryConnect(directConn, 'Direct (port 5432)');

    if (!client) {
        console.error('\n✗ Could not connect to the database.');
        console.error('\nFallback: run the SQL manually in the Supabase SQL Editor:');
        console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
        console.error('  Copy the contents of scripts/enable-rls.sql and paste it there.\n');
        process.exit(1);
    }

    let succeeded = 0;
    let failed    = 0;
    let skipped   = 0;

    for (const sql of SQL_STATEMENTS) {
        const preview = sql.replace(/\s+/g, ' ').substring(0, 90);
        try {
            await client.query(sql);
            console.log(`  ✓ ${preview}`);
            succeeded++;
        } catch (err) {
            const msg = err.message ?? '';
            if (msg.includes('does not exist') || msg.includes('not found')) {
                console.log(`  ~ SKIP (table/col missing): ${preview}`);
                skipped++;
            } else if (msg.includes('already exists')) {
                console.log(`  ✓ (already exists): ${preview}`);
                succeeded++;
            } else {
                console.log(`  ✗ FAIL: ${preview}`);
                console.log(`         ${msg}`);
                failed++;
            }
        }
    }

    await client.end();

    console.log('\n======================================================');
    console.log(`  Results: ✓ ${succeeded} applied  ~ ${skipped} skipped  ✗ ${failed} failed`);
    console.log('======================================================\n');

    // ─── Verification query ───────────────────────────────────────────────
    console.log('Verifying RLS status on all public tables...\n');
    const verifyClient = new pg.Client({
        connectionString: poolerConn,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 12000,
    });

    try {
        await verifyClient.connect();
        const result = await verifyClient.query(`
            SELECT tablename,
                   rowsecurity,
                   (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) AS policy_count
            FROM pg_tables t
            WHERE schemaname = 'public'
            ORDER BY rowsecurity ASC, tablename;
        `);

        let allSecure = true;
        console.log('Table                           RLS        Policies');
        console.log('──────────────────────────────────────────────────');
        for (const row of result.rows) {
            const status      = row.rowsecurity ? '✅ SECURED ' : '❌ EXPOSED ';
            const policyCount = row.policy_count.toString().padStart(3);
            console.log(`${row.tablename.padEnd(32)}${status}  ${policyCount}`);
            if (!row.rowsecurity) allSecure = false;
        }

        console.log('\n');
        if (allSecure) {
            console.log('✅  All tables have RLS enabled. Your database is secured.');
        } else {
            console.log('⚠️   Some tables still have RLS DISABLED.');
            console.log('    Enable RLS on those tables in the Supabase Dashboard');
            console.log('    → Database → Tables → [table] → Enable RLS');
        }
        await verifyClient.end();
    } catch (err) {
        console.log('Could not run verification query:', err.message);
    }

    if (failed > 0) {
        console.log('\n⚠️   Some statements failed. As a fallback, run scripts/enable-rls.sql');
        console.log(`    manually in: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
