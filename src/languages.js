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
exports.userTimeagoCode = exports.list = exports.listCodes = exports.get = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const utils_1 = __importDefault(require("./utils"));
const plugins_1 = __importDefault(require("./plugins"));
const constants_1 = require("./constants");
function get(language, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const languagesPath = path_1.default.join(__dirname, '../build/public/language');
        const pathToLanguageFile = path_1.default.join(languagesPath, language, `${namespace}.json`);
        if (!pathToLanguageFile.startsWith(languagesPath)) {
            throw new Error('[[error:invalid-path]]');
        }
        const data = yield promises_1.default.readFile(pathToLanguageFile, 'utf8');
        const parsed = JSON.parse(data);
        const result = yield plugins_1.default.hooks.fire('filter:languages.get', {
            language,
            namespace,
            data: parsed,
        });
        return result.data;
    });
}
exports.get = get;
let codeCache;
function listCodes() {
    return __awaiter(this, void 0, void 0, function* () {
        if (codeCache && codeCache.length) {
            return codeCache;
        }
        const languagesPath = path_1.default.join(__dirname, '../build/public/language');
        const file = yield promises_1.default.readFile(path_1.default.join(languagesPath, 'metadata.json'), 'utf8');
        const parsed = JSON.parse(file);
        codeCache = parsed.languages;
        return parsed.languages;
    });
}
exports.listCodes = listCodes;
let listCache;
function list() {
    return __awaiter(this, void 0, void 0, function* () {
        if (listCache && listCache.length) {
            return listCache;
        }
        const codes = yield listCodes();
        let languages = yield Promise.all(codes.map((folder) => __awaiter(this, void 0, void 0, function* () {
            const languagesPath = path_1.default.join(__dirname, '../build/public/language');
            const configPath = path_1.default.join(languagesPath, folder, 'language.json');
            const file = yield promises_1.default.readFile(configPath, 'utf8');
            const lang = JSON.parse(file);
            return lang;
        })));
        languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);
        listCache = languages;
        return languages;
    });
}
exports.list = list;
function userTimeagoCode(userLang) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield promises_1.default.readdir(path_1.default.join(constants_1.paths.nodeModules, '/timeago/locales'));
        const timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);
        const languageCodes = yield listCodes();
        const timeagoCode = utils_1.default.userLangToTimeagoCode(userLang);
        if (languageCodes.includes(userLang) && timeagoCodes.includes(timeagoCode)) {
            return timeagoCode;
        }
        return '';
    });
}
exports.userTimeagoCode = userTimeagoCode;
