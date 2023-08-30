import fs from 'fs/promises';
import path from 'path';
import utils from './utils';
import plugins from './plugins';
import { paths } from './constants';

interface Language {
    code: string,
    name: string,
    dir: string
}

interface ParseResult {
    languages: string[]
}

interface Result {
    data: Language[]
}


export async function get(language: string, namespace: string) {
    const languagesPath = path.join(__dirname, '../build/public/language');
    const pathToLanguageFile = path.join(languagesPath, language, `${namespace}.json`);

    if (!pathToLanguageFile.startsWith(languagesPath)) {
        throw new Error('[[error:invalid-path]]');
    }

    const data = await fs.readFile(pathToLanguageFile, 'utf8');
    const parsed: ParseResult = JSON.parse(data) as ParseResult;

    const result: Result = await plugins.hooks.fire('filter:languages.get', {
        language,
        namespace,
        data: parsed,
    }) as Result;

    return result.data;
}

let codeCache: string[];

export async function listCodes() {
    if (codeCache && codeCache.length) {
        return codeCache;
    }
    const languagesPath = path.join(__dirname, '../build/public/language');
    const file = await fs.readFile(path.join(languagesPath, 'metadata.json'), 'utf8');
    const parsed: ParseResult = JSON.parse(file) as ParseResult;
    codeCache = parsed.languages;
    return parsed.languages;
}

let listCache: Language[];

export async function list() {
    if (listCache && listCache.length) {
        return listCache;
    }

    const codes = await listCodes();

    let languages: Language[] = await Promise.all(codes.map(async (folder) => {
        const languagesPath = path.join(__dirname, '../build/public/language');
        const configPath = path.join(languagesPath, folder, 'language.json');
        const file = await fs.readFile(configPath, 'utf8');
        const lang: Language = JSON.parse(file) as Language;
        return lang;
    }));
    

    languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);

    listCache = languages;
    return languages;
}

export async function userTimeagoCode(userLang: string) {
    const files = await fs.readdir(path.join(paths.nodeModules, '/timeago/locales'));
    const timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);
    const languageCodes = await listCodes();
    const timeagoCode: string = utils.userLangToTimeagoCode(userLang) as string;

    if (languageCodes.includes(userLang) && timeagoCodes.includes(timeagoCode)) {
        return timeagoCode;
    }
    return '';
}
