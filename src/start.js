"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const benchpressjs_1 = __importDefault(require("benchpressjs"));
const socket_io_1 = __importDefault(require("./socket.io"));
const upgrade_1 = __importDefault(require("./upgrade"));
const webserver_1 = __importDefault(require("./webserver"));
const analytics_1 = __importDefault(require("./analytics"));
const database_1 = __importDefault(require("./database"));
const meta_1 = __importDefault(require("./meta"));
const translator_1 = __importDefault(require("./translator"));
const notifications_1 = __importDefault(require("./notifications"));
const user_1 = __importDefault(require("./user"));
const plugins_1 = __importDefault(require("./plugins"));
const topics_1 = __importDefault(require("./topics"));
function runUpgrades() {
    return __awaiter(this, void 0, void 0, function* () {
        yield upgrade_1.default.check();
        yield upgrade_1.default.run();
    });
}
function printStartupInfo() {
    if (nconf_1.default.get('isPrimary')) {
        winston_1.default.info('Initializing NodeBB v%s %s', nconf_1.default.get('version'), nconf_1.default.get('url'));
        const expr = nconf_1.default.get('database');
        const host = nconf_1.default.get(`${expr}:host`);
        const exprInside = nconf_1.default.get('database');
        const exprAnother = nconf_1.default.get(`${exprInside}:port`);
        const storeLocation = host ? `at ${host}${!host.includes('/') ? `:${exprAnother}` : ''}` : '';
        winston_1.default.verbose('* using %s store %s', nconf_1.default.get('database'), storeLocation);
        winston_1.default.verbose('* using themes stored in: %s', nconf_1.default.get('themes_path'));
    }
}
function shutdown(code) {
    winston_1.default.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
    try {
        webserver_1.default.destroy();
        winston_1.default.info('[app] Web server closed to connections.');
        analytics_1.default.writeData().then(() => console.log(1)).catch(() => console.log(1));
        winston_1.default.info('[app] Live analytics saved.');
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        database_1.default.close();
        winston_1.default.info('[app] Database connection closed.');
        winston_1.default.info('[app] Shutdown complete.');
        process.exit(code || 0);
    }
    catch (err) {
        process.exit(code || 0);
    }
}
function restart() {
    if (process.send) {
        winston_1.default.info('[app] Restarting...');
        process.send({
            action: 'restart',
        });
    }
    else {
        winston_1.default.error('[app] Could not restart server. Shutting down.');
        shutdown(1);
    }
}
function addProcessHandlers() {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', restart);
    process.on('uncaughtException', (err) => {
        winston_1.default.error(err.stack);
        meta_1.default.js.killMinifier();
        shutdown(1);
    });
    process.on('message', (msg) => {
        if (msg && msg.compiling === 'tpl') {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            benchpressjs_1.default.flush();
        }
        else if (msg && msg.compiling === 'lang') {
            translator_1.default.flush();
        }
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        printStartupInfo();
        addProcessHandlers();
        try {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.init();
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.checkCompatibility();
            yield meta_1.default.configs.init();
            if (nconf_1.default.get('runJobs')) {
                yield runUpgrades();
            }
            if (nconf_1.default.get('dep-check') === undefined || nconf_1.default.get('dep-check') !== false) {
                yield meta_1.default.dependencies.check();
            }
            else {
                winston_1.default.warn('[init] Dependency checking skipped!');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.initSessionStore();
            yield socket_io_1.default.init(webserver_1.default.server);
            if (nconf_1.default.get('runJobs')) {
                notifications_1.default.startJobs();
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                user_1.default.startJobs();
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                plugins_1.default.startJobs();
                topics_1.default.scheduled.startJobs();
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.delete('locks');
            }
            yield webserver_1.default.listen();
            if (process.send) {
                process.send({
                    action: 'listening',
                });
            }
        }
        catch (err) {
            // Either way, bad stuff happened. Abort start.
            process.exit();
        }
    });
}
exports.default = start;
