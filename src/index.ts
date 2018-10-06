#!/usr/bin/env node
require('source-map-support').install()

import * as fs from 'fs'
import {promisify} from 'util'
import * as program from 'commander'
import * as ini from 'ini'
var expandTilde = require('expand-tilde')
import * as AWS from 'aws-sdk'
import * as debug from 'debug'

const log = debug('main')

const PACKAGE_JSON = require('../../package.json')

program
    .version(PACKAGE_JSON.version)
    .description(PACKAGE_JSON.description)
    .option('-c, --mfa-code [digits]', 'The code from the MFA device')
    .option('-s, --source-profile [name]', 'The profile used to request the token', 'default')
    .option('-m, --mfa-profile [name]', 'The profile to update with the token', 'mfa')
    .option('-f, --file [path]', 'The credentials file to update', '~/.aws/credentials')
    .option('-v, --verbose', 'Display verbose logging')
    .option('-b, --backup', 'Create a backup of the credentials file')
    .option('-S, --backup-suffix [suffix]', 'Suffix to use for the backup file', '.BACKUP')
    .parse(process.argv)

const options = {
    mfaCode: program.mfaCode,
    srcProfile: program.sourceProfile,
    mfaProfile: program.mfaProfile,
    file: program.file,
    verbose: program.verbose,
    backup: program.backup,
    backupSuffix: program.backupSuffix
}

log('options', options)

if (program.args.length > 0) {
    program.help()
    process.exit(1)
}

if (!options.mfaCode) {
    console.error('FATAL: USAGE: No MFA code specified, please use the --mfa-code option')
    process.exit(1)
}

function info(message: string, ...args: any[]) {
    if (options.verbose) {
        console.log(message, ...args)
    }
}

const fatalInfo: any = {
    options
}

function fatal(message: string, ...args: any[]) {
    console.error(message, ...args)
    log('Debug info:', fatalInfo)
    process.exit(1)
}

function ensure(value: string, what: string, name: string): string {
    if (!value) {
        fatal(`The ${what} does not have a '${name}' value`)
    }
    return value
}

async function load(path: string): Promise<object> {
    const rawContents = await promisify(fs.readFile)(path, 'utf-8')
    const iniFile = ini.parse(rawContents)
    if (options.backup) {
        const backupPath = path + ensure(options.backupSuffix, 'program options', '--backup-suffix')
        info('Creating backup to: ', backupPath)
        await promisify(fs.writeFile)(backupPath, rawContents)
    }
    return iniFile
}

async function save(path: string, contents: object): Promise<void> {
    const rawContents = ini.encode(contents)
    log('new file', rawContents)
    await promisify(fs.writeFile)(path, rawContents)
}


async function main() {
    const iniObj: any = await load(expandTilde(options.file))
    log(`Read init file: path=${options.file}`, iniObj)

    const srcSection: any = iniObj[options.srcProfile]
    if (!srcSection) {
        fatal('Could not find the source section in the ini file')
    }
    log('Source profile: ', srcSection)
    fatalInfo.srcSection = srcSection
    const srcSectionMessage = `source section '${srcSection}'`

    const sts = new AWS.STS({
        accessKeyId: ensure(srcSection.aws_access_key_id, srcSectionMessage, 'aws_access_key_id'),
        secretAccessKey: ensure(srcSection.aws_secret_access_key, srcSectionMessage, 'aws_secret_access_key')
    })
    info('Requesting session token from AWS')
    const tokenReply = await sts.getSessionToken({
        SerialNumber: ensure(srcSection.mfa_serial, srcSectionMessage, 'mfa_serial'),
        TokenCode: ensure(options.mfaCode, 'program options', '--mfa-code')
    }).promise()
    info('Got back MFA-based token from AWS')

    const oldMfaSection = iniObj[options.mfaProfile]
    const expires = tokenReply.Credentials!.Expiration.toISOString()

    const mfaSection = {
        ...oldMfaSection,
        aws_access_key_id: tokenReply.Credentials!.AccessKeyId,
        aws_secret_access_key: tokenReply.Credentials!.SecretAccessKey,
        aws_session_token: tokenReply.Credentials!.SessionToken,
        expires
    }
    log(`New MFA section: name=${options.mfaProfile}`, mfaSection)

    iniObj[ensure(options.mfaProfile, 'program options', '--mfa-profile')] = mfaSection

    log('ini', iniObj)
    save(expandTilde(options.file), iniObj)

    console.log(`New credentials have been save to the profile ${options.mfaProfile}, expires ${expires}`)
}

main()
    .then(() => {
        log('finished successfully')
    })
    .catch((err) => {
        console.error('failed', err)
    })



