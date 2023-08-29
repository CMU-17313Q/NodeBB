"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCallbackedFunction = void 0;
const util_1 = __importDefault(require("util"));
/*
             eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
              @typescript-eslint/no-explicit-any
             */
function isCallbackedFunction(func) {
    if (typeof func !== 'function') {
        return false;
    }
    const str = func.toString().split('\n')[0];
    return str.includes('callback)');
}
exports.isCallbackedFunction = isCallbackedFunction;
function wrapCallback(origFn) {
    return util_1.default.promisify(origFn);
}
function promisifyModule(theModule, ignoreKeys = []) {
    function promisifyRecursive(module) {
        const keys = Object.keys(module);
        keys.forEach((key) => {
            if (ignoreKeys.includes(key)) {
                return;
            }
            /*
            eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
            @typescript-eslint/no-unsafe-argument
            */
            if (isCallbackedFunction(module[key])) {
                /*
                eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-argument
                */
                module[key] = wrapCallback(module[key]);
                /*
                eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-argument
                */
            }
            else if (typeof module[key] === 'object' && module[key] !== null) {
                /*
                eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                @typescript-eslint/no-unsafe-argument
                */
                promisifyRecursive(module[key]);
            }
        });
    }
    promisifyRecursive(theModule);
}
exports.default = promisifyModule;
