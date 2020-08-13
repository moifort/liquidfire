#!/usr/bin/env node

const sade = require('sade');
const fireway = require('./index');
const pkg = require('../package.json');

const prog = sade(pkg.name).version(pkg.version);

prog
    .command('migrate')
    .option('--path', 'Path to migration files', './migrations')
    .option('--projectId', 'Target firebase project')
    .option('--emulator', 'Run on emulator')
    .describe('Migrates schema to the latest version')
    .example('migrate')
    .example('migrate --path=./my-migrations')
    .example('migrate --projectId=my-staging-id')
    .example('migrate --dryrun')
    .action(async (opts) => {
        try {
            await fireway.migrate(opts)
        } catch (e) {
            console.log('ERROR:', e.message);
            process.exit(1);
        }
    });

prog.parse(process.argv);
