const path = require('path')
const md5 = require('md5')
const fs = require('fs')
const admin = require('firebase-admin')
const adminTest = require('@firebase/testing')

async function migrate({path: dir = './migrations', projectId, emulator = false} = {}) {
    const stats = {
        scannedFiles: 0,
        executedFiles: 0,
    }

    if (!path.isAbsolute(dir)) {
        dir = path.join(process.cwd(), dir)
    }

    if (!(fs.existsSync(dir))) {
        throw new Error(`No directory at ${dir}`)
    }

    const filenames = []
    for (const file of fs.readdirSync(dir)) {
        if (!(fs.statSync(path.join(dir, file))).isDirectory()) {
            filenames.push(file)
        }
    }

    const versionToFile = new Map()
    let files = filenames.map(filename => {
        const [filenameVersion, description] = filename.split('__')
        if (!description) {
            throw new Error(`This filename doesn't match the required format: ${filename}`)
        }

        const version = parseInt(filenameVersion)
        if (isNaN(version)) {
            throw new Error(`Version is not a number: ${filename}`)
        }

        const existingFile = versionToFile.get(version)
        if (existingFile) {
            throw new Error(`Both ${filename} and ${existingFile} have the same version`)
        }
        versionToFile.set(version, filename)

        return {
            filename,
            path: path.join(dir, filename),
            version,
            description: path.basename(description, '.js')
        }
    }).filter(Boolean)

    stats.scannedFiles = files.length
    console.log(`Found ${stats.scannedFiles} migration files`)

    const app = emulator
        ? adminTest.initializeAdminApp({projectId})
        : admin.initializeApp({credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_CREDENTIALS))})

    const firestore = app.firestore()
    const firewayCollection = firestore.collection('fireway')

    // Get the latest migration
    const result = await firewayCollection
        .orderBy('installed_rank', 'desc')
        .limit(1)
        .get()
    const [latestDoc] = result.docs
    const latest = latestDoc && latestDoc.data()

    if (latest && !latest.success) {
        throw new Error(`Migration to version ${latest.version} using ${latest.script} failed! Please restore backups and roll back database and code!`)
    }

    let installed_rank
    if (latest) {
        files = files.filter(file => file.version > latest.version)
        installed_rank = latest.installed_rank
    } else {
        installed_rank = -1
    }

    files.sort((f1, f2) => f1 - f2)

    console.log(`Executing ${files.length} migration files`)

    // Execute them in order
    for (const file of files) {
        stats.executedFiles += 1
        console.log('Running', file.filename)

        let migration
        try {
            migration = require(file.path)
        } catch (e) {
            console.log(e)
            throw e
        }

        const start = new Date()
        let success, finish
        try {
            await migration.migrate({app, firestore})
            success = true
        } catch (e) {
            console.log(`Error in ${file.filename}`, e)
            success = false
        } finally {
            finish = new Date()
        }

        // Upload the results
        console.log(`Uploading the results for ${file.filename}`)

        installed_rank += 1
        const id = `${installed_rank}-${file.version}-${file.description}`
        await firewayCollection.doc(id).set({
            installed_rank,
            description: file.description,
            version: file.version,
            script: file.filename,
            type: 'js',
            checksum: md5(await fs.readFileSync(file.path)),
            installed_on: start,
            execution_time: finish - start,
            success
        })

        if (!success) {
            throw new Error('Stopped at first failure')
        }
    }

    await app.delete()

    const {scannedFiles, executedFiles} = stats
    console.log('Finished all firestore migrations')
    console.log(`Files scanned:${scannedFiles} executed:${executedFiles}`)
}

module.exports = {migrate}
