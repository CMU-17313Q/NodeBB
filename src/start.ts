import nconf from 'nconf';
import winston from 'winston';
import benchpressjs from 'benchpressjs';
import sockets from './socket.io';
import upgrade from './upgrade';
import webserver from './webserver';
import analytics from './analytics';
import db from './database';
import meta from './meta';
import translator from './translator';
import notifications from './notifications';
import user from './user';
import plugins from './plugins';
import topics from './topics';

interface Message {
    compiling: string
}

async function runUpgrades() {
    await upgrade.check();
    await upgrade.run();
}

function printStartupInfo() {
    if (nconf.get('isPrimary')) {
        winston.info('Initializing NodeBB v%s %s', nconf.get('version'), nconf.get('url'));

        const expr: string = nconf.get('database') as string;
        const host: string = nconf.get(`${expr}:host`) as string;
        const exprInside: string = nconf.get('database') as string;
        const exprAnother: string = nconf.get(`${exprInside}:port`) as string;
        const storeLocation:string = host ? `at ${host}${!host.includes('/') ? `:${exprAnother}` : ''}` : '';

        winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
        winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
    }
}

function shutdown(code: number) {
    winston.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
    try {
        webserver.destroy();
        winston.info('[app] Web server closed to connections.');
        analytics.writeData().then(() => console.log(1)).catch(() => console.log(1));
        winston.info('[app] Live analytics saved.');
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.close();
        winston.info('[app] Database connection closed.');
        winston.info('[app] Shutdown complete.');
        process.exit(code || 0);
    } catch (err) {
        process.exit(code || 0);
    }
}

function restart() {
    if (process.send) {
        winston.info('[app] Restarting...');
        process.send({
            action: 'restart',
        });
    } else {
        winston.error('[app] Could not restart server. Shutting down.');
        shutdown(1);
    }
}


function addProcessHandlers() {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', restart);
    process.on('uncaughtException', (err) => {
        winston.error(err.stack);

        meta.js.killMinifier();
        shutdown(1);
    });
    process.on('message', (msg: Message) => {
        if (msg && msg.compiling === 'tpl') {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            benchpressjs.flush();
        } else if (msg && msg.compiling === 'lang') {
            translator.flush();
        }
    });
}

export default async function start() {
    printStartupInfo();

    addProcessHandlers();

    try {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.init();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.checkCompatibility();
        await meta.configs.init();

        if (nconf.get('runJobs')) {
            await runUpgrades();
        }

        if (nconf.get('dep-check') === undefined || nconf.get('dep-check') !== false) {
            await meta.dependencies.check();
        } else {
            winston.warn('[init] Dependency checking skipped!');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.initSessionStore();
        await sockets.init(webserver.server);

        if (nconf.get('runJobs')) {
            notifications.startJobs();
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.startJobs();
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            plugins.startJobs();
            topics.scheduled.startJobs();
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.delete('locks');
        }

        await webserver.listen();

        if (process.send) {
            process.send({
                action: 'listening',
            });
        }
    } catch (err) {
        // Either way, bad stuff happened. Abort start.
        process.exit();
    }
}
