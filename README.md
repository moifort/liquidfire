# fireway
A schema migration tool for firestore heavily inspired by [flyway](https://flywaydb.org/)

## Install

```bash
yarn add @moifort/fireway
```

## CLI

```bash
Usage
  $ fireway <command> [options]

Available Commands
  migrate    Migrates schema to the latest version

For more info, run any command with the `--help` flag
  $ fireway migrate --help

Options
  -v, --version    Displays current version
  -h, --help       Displays this message
```

### `fireway migrate`
```bash
Description
  Migrates schema to the latest version

Usage
  $ fireway migrate [options]

Options
  --path         Path to migration files  (default ./migrations)
  --projectId    Target firebase project
  --emulator     Run on emulator
  -h, --help     Displays this message

Examples
  $ fireway migrate
  $ fireway migrate --path=./my-migrations
  $ fireway migrate --projectId=my-staging-id
```

## Migration file format

Migration file name format: `vXXX__[description].js` when `XXX` is a number ex: `001`, `002`

```js
// each script gets a pre-configured firestore admin instance
module.exports.migrate = async ({firestore}) => {
    await firestore.collection('name').add({key: new Date()});
};
```

## Migration results

Migration results are stored in the `fireway` collection in `firestore`

```js

{
  checksum: 'fdfe6a55a7c97a4346cb59871b4ce97c',
  description: 'example',
  execution_time: 1221,
  installed_by: 'system_user_name',
  installed_on: firestore.Timestamp(),
  installed_rank: 3,
  script: 'v0.0.1__example.js',
  success: true,
  type: 'js',
  version: '0.0.1'
}
```

## Migration logic

1. Gather all the migration files and sort them according to semver
2. Find the last migration in the `fireway` collection
3. If the last migration failed, stop. (remove the failed result or restore the db to continue)
4. Run the migration scripts since the last migration

## Authentication

To run on your project (with your CD for instance) give `GOOGLE_CREDENTIALS` environment variable. 

`GOOGLE_CREDENTIALS='{ "type": "service_account",  "project_id": "...",  "private_key_id": "...",  "private_key": "...",  "client_email": ...",  "token_uri": "..." }' fireway migrate --path=./migration/prod`

You can find the json on your firebase console: **Settings/Service Account/SDK Admin Key/Generate private key**

You dont need `GOOGLE_CREDENTIALS` if you use `--emulators` but you must provide `--projectId`

## Thanks

@kevlened
