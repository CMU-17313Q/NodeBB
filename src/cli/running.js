"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.status = exports.restart = exports.stop = exports.start = exports.getRunningPid = void 0;
const fs_1 = __importDefault(require("fs"));
const child_process_1 = __importDefault(require("child_process"));
const chalk_1 = __importDefault(require("chalk"));
const debugFork_1 = __importDefault(require("../meta/debugFork"));
const constants_1 = require("../constants");
const cwd = constants_1.paths.baseDir;
function getRunningPid(callback) {
    fs_1.default.readFile(constants_1.paths.pidfile, {
        encoding: 'utf-8',
    }, (err, pid) => {
        if (err) {
            return callback(err, null);
        }
        const parsed = parseInt(pid, 10);
        try {
            process.kill(parsed, 0);
            callback(null, parsed);
        }
        catch (e) {
            callback(e, null);
        }
    });
}
exports.getRunningPid = getRunningPid;
function start(options) {
    if (options.dev) {
        process.env.NODE_ENV = 'development';
        (0, debugFork_1.default)(constants_1.paths.loader, ['--no-daemon', '--no-silent'], {
            env: process.env,
            stdio: 'inherit',
            cwd,
        });
        return;
    }
    if (options.log) {
        console.log(`\n${[
            chalk_1.default.bold('Starting NodeBB with logging output'),
            chalk_1.default.red('Hit ') + chalk_1.default.bold('Ctrl-C ') + chalk_1.default.red('to exit'),
            'The NodeBB process will continue to run in the background',
            `Use "${chalk_1.default.yellow('./nodebb stop')}" to stop the NodeBB server`,
        ].join('\n')}`);
    }
    else if (!options.silent) {
        console.log(`\n${[
            chalk_1.default.bold('Starting NodeBB'),
            `  "${chalk_1.default.yellow('./nodebb stop')}" to stop the NodeBB server`,
            `  "${chalk_1.default.yellow('./nodebb log')}" to view server output`,
            `  "${chalk_1.default.yellow('./nodebb help')}" for more commands\n`,
        ].join('\n')}`);
    }
    // Spawn a new NodeBB process
    const child = (0, debugFork_1.default)(constants_1.paths.loader, process.argv.slice(3), {
        env: process.env,
        cwd,
    });
    if (options.log) {
        child_process_1.default.spawn('tail', ['-F', './logs/output.log'], {
            stdio: 'inherit',
            cwd,
        });
    }
    return child;
}
exports.start = start;
function stop() {
    getRunningPid((err, pid) => {
        if (!err) {
            process.kill(pid, 'SIGTERM');
            console.log('Stopping NodeBB. Goodbye!');
        }
        else {
            console.log('NodeBB is already stopped.');
        }
    });
}
exports.stop = stop;
function restart(options) {
    getRunningPid((err, pid) => {
        if (!err) {
            console.log(chalk_1.default.bold('\nRestarting NodeBB'));
            process.kill(pid, 'SIGTERM');
            options.silent = true;
            start(options);
        }
        else {
            console.warn('NodeBB could not be restarted, as a running instance could not be found.');
        }
    });
}
exports.restart = restart;
function status() {
    getRunningPid((err, pid) => {
        if (!err) {
            console.log(`\n${[
                chalk_1.default.bold('NodeBB Running ') + chalk_1.default.cyan(`(pid ${pid.toString()})`),
                `\t"${chalk_1.default.yellow('./nodebb stop')}" to stop the NodeBB server`,
                `\t"${chalk_1.default.yellow('./nodebb log')}" to view server output`,
                `\t"${chalk_1.default.yellow('./nodebb restart')}" to restart NodeBB\n`,
            ].join('\n')}`);
        }
        else {
            console.log(chalk_1.default.bold('\nNodeBB is not running'));
            console.log(`\t"${chalk_1.default.yellow('./nodebb start')}" to launch the NodeBB server\n`);
        }
    });
}
exports.status = status;
function log() {
    console.log(`${chalk_1.default.red('\nHit ') + chalk_1.default.bold('Ctrl-C ') + chalk_1.default.red('to exit\n')}\n`);
    child_process_1.default.spawn('tail', ['-F', './logs/output.log'], {
        stdio: 'inherit',
        cwd,
    });
}
exports.log = log;
