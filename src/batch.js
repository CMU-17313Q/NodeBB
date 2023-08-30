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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processArray = exports.processSortedSet = void 0;
var util = require("util");
var database_1 = require("./database");
var utils_1 = require("./utils");
var promisify_1 = require("./promisify");
var DEFAULT_BATCH_SIZE = 100;
var sleep = util.promisify(setTimeout);
function processSortedSet(setKey, process, options) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, start, stop, method, ids;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    options = options || {};
                    if (!process) {
                        throw new Error('[[error:process-not-a-function]]');
                    }
                    if (!options.progress) return [3 /*break*/, 2];
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    _a = options.progress;
                    return [4 /*yield*/, database_1.default.sortedSetCard(setKey)];
                case 1:
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    _a.total = (_b.sent());
                    _b.label = 2;
                case 2:
                    options.batch = options.batch || DEFAULT_BATCH_SIZE;
                    if (!(database_1.default.processSortedSet && !options.doneIf && !utils_1.default.isNumber(options.alwaysStartAt))) return [3 /*break*/, 4];
                    return [4 /*yield*/, database_1.default.processSortedSet(setKey, process, options)];
                case 3: 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                return [2 /*return*/, _b.sent()]; // Explicitly type the return
                case 4:
                    options.doneIf = options.doneIf || function () {
                        return false;
                    };
                    start = 0;
                    stop = options.batch - 1;
                    _b.label = 5;
                case 5:
                    if (!true) return [3 /*break*/, 9];
                    method = "getSortedSetRange".concat(options.withScores ? 'WithScores' : '');
                    ids = database_1.default[method](setKey, start, stop);
                    if (!ids.length || options.doneIf(start, stop, ids)) {
                        return [3 /*break*/, 9];
                    }
                    // eslint-disable-next-line no-await-in-loop
                    return [4 /*yield*/, process(ids)];
                case 6:
                    // eslint-disable-next-line no-await-in-loop
                    _b.sent();
                    start += utils_1.default.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
                    stop = start + options.batch - 1;
                    if (!options.interval) return [3 /*break*/, 8];
                    // eslint-disable-next-line no-await-in-loop
                    return [4 /*yield*/, sleep(options.interval)];
                case 7:
                    // eslint-disable-next-line no-await-in-loop
                    _b.sent();
                    _b.label = 8;
                case 8: return [3 /*break*/, 5];
                case 9: return [2 /*return*/];
            }
        });
    });
}
exports.processSortedSet = processSortedSet;
function processArray(array, process, options) {
    return __awaiter(this, void 0, void 0, function () {
        var batch, start, currentBatch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    options = options || {};
                    if (!Array.isArray(array) || !array.length) {
                        return [2 /*return*/];
                    }
                    batch = options.batch || DEFAULT_BATCH_SIZE;
                    start = 0;
                    _a.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 5];
                    currentBatch = array.slice(start, start + batch);
                    if (!currentBatch.length) {
                        return [3 /*break*/, 5];
                    }
                    // eslint-disable-next-line no-await-in-loop
                    return [4 /*yield*/, process(currentBatch)];
                case 2:
                    // eslint-disable-next-line no-await-in-loop
                    _a.sent();
                    start += batch;
                    if (!options.interval) return [3 /*break*/, 4];
                    // eslint-disable-next-line no-await-in-loop
                    return [4 /*yield*/, sleep(options.interval)];
                case 3:
                    // eslint-disable-next-line no-await-in-loop
                    _a.sent();
                    _a.label = 4;
                case 4: return [3 /*break*/, 1];
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.processArray = processArray;
(0, promisify_1.default)(exports);
