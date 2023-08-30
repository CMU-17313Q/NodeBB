import nconf from 'nconf';
import url from 'url';
import { Format } from 'logform';
import winston from 'winston';
import path from 'path';
import semver from 'semver';
import chalk from 'chalk';
import { paths } from './constants';


export function setupWinston() {
    if (!winston.format) {
        return;
    }

    const formats: Format[] = [];
    if (nconf.get('log-colorize') !== 'false') {
        formats.push(winston.format.colorize());
    }

    if (nconf.get('json-logging')) {
        formats.push(winston.format.timestamp());
        formats.push(winston.format.json());
    } else {
        const timestampFormat = winston.format((info) => {
            const one: string = nconf.get('port') as string;
            const dateString = `${new Date().toISOString()} [${one}/${global.process.pid}]`;
            info.level = `${dateString} - ${info.level}`;
            return info;
        });
        formats.push(timestampFormat());
        formats.push(winston.format.splat());
        formats.push(winston.format.simple());
    }

    const winFormat = winston.format.combine.apply(null, formats) as Format;
    winston.configure({
        level: nconf.get('log-level') as string || (process.env.NODE_ENV === 'production' ? 'info' : 'verbose'),
        format: winFormat,
        transports: [
            new winston.transports.Console({
                handleExceptions: true,
            }),
        ],
    });
}

export function loadConfig(configFile: string) {
    nconf.file({
        file: configFile,
    });

    nconf.defaults({
        base_dir: paths.baseDir,
        themes_path: paths.themes,
        upload_path: 'public/uploads',
        views_dir: path.join(paths.baseDir, 'build/public/templates'),
        version: '2.8.1',
        isCluster: false,
        isPrimary: true,
        jobsDisabled: false,
    });

    // Explicitly cast as Bool, loader.js passes in isCluster as string 'true'/'false'
    const castAsBool = ['isCluster', 'isPrimary', 'jobsDisabled'];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    nconf.stores.env.readOnly = false;
    castAsBool.forEach((prop) => {
        const value: string | boolean = nconf.get(prop) as string | boolean;
        if (value !== undefined) {
            nconf.set(prop, ['1', 1, 'true', true].includes(value));
        }
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    nconf.stores.env.readOnly = true;
    nconf.set('runJobs', nconf.get('isPrimary') && !nconf.get('jobsDisabled'));

    // Ensure themes_path is a full filepath
    nconf.set('themes_path', path.resolve(paths.baseDir, nconf.get('themes_path') as string));
    nconf.set('core_templates_path', path.join(paths.baseDir, 'src/views'));
    nconf.set('base_templates_path', path.join(nconf.get('themes_path') as string, 'nodebb-theme-persona/templates'));

    nconf.set('upload_path', path.resolve(nconf.get('base_dir') as string, nconf.get('upload_path') as string));
    nconf.set('upload_url', '/assets/uploads');


    // nconf defaults, if not set in config
    if (!nconf.get('sessionKey')) {
        nconf.set('sessionKey', 'express.sid');
    }

    if (nconf.get('url')) {
        const urlFirst: string = nconf.get('url') as string;
        nconf.set('url', urlFirst.replace(/\/$/, ''));
        const vals = nconf.get('url') as string;
        nconf.set('url_parsed', url.parse(vals));
        // Parse out the relative_url and other goodies from the configured URL
        const urlObject = url.parse(nconf.get('url') as string);
        const relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
        nconf.set('base_url', `${urlObject.protocol}//${urlObject.host}`);
        nconf.set('secure', urlObject.protocol === 'https:');
        nconf.set('use_port', !!urlObject.port);
        nconf.set('relative_path', relativePath);
        if (!nconf.get('asset_base_url')) {
            nconf.set('asset_base_url', `${relativePath}/assets`);
        }
        nconf.set('port', nconf.get('PORT') as string || nconf.get('port') as string || urlObject.port || (nconf.get('PORT_ENV_VAR') as string ? nconf.get(nconf.get('PORT_ENV_VAR') as string) as string : false) || 4567);

        // cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
        const domain = nconf.get('cookieDomain') as string || urlObject.hostname;
        const origins = nconf.get('socket.io:origins') as string || `${urlObject.protocol}//${domain}:*`;
        nconf.set('socket.io:origins', origins);
    }
}

export function versionCheck() {
    const version = process.version.slice(1);
    const range = '>=16';
    const compatible = semver.satisfies(version, range);
    if (!compatible) {
        winston.warn('Your version of Node.js is too outdated for NodeBB. Please update your version of Node.js.');
        winston.warn(`Recommended ${chalk.green(range)}, ${chalk.yellow(version)} provided\n`);
    }
}
