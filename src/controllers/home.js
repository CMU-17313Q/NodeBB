"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginHook = exports.rewrite = void 0;
const url = __importStar(require("url"));
const plugins = __importStar(require("../plugins"));
const meta = __importStar(require("../meta"));
const user = __importStar(require("../user"));
function adminHomePageRoute() {
    const config = meta.config; // Type assertion
    const { homePageRoute, homePageCustom } = config;
    const route = (homePageRoute === 'custom' ? homePageCustom : homePageRoute) || 'categories';
    return route.replace(/^\//, '');
}
function getUserHomeRoute(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const settings = yield user.getSettings(uid);
        let route = adminHomePageRoute();
        if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
            route = (settings.homePageRoute || route).replace(/^\/+/, '');
        }
        return route;
    });
}
function rewrite(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
            return next();
        }
        let route = adminHomePageRoute();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.allowUserHomePage) {
            route = yield getUserHomeRoute(req.uid);
        }
        let parsedUrl;
        try {
            parsedUrl = url.parse(route, true);
        }
        catch (err) {
            return next(err);
        }
        const { pathname } = parsedUrl;
        const hook = `action:homepage.get:${pathname}`;
        if (!plugins.hooks.hasListeners(hook)) {
            req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
        }
        else {
            res.locals.homePageRoute = pathname;
        }
        req.query = Object.assign(parsedUrl.query, req.query);
        next();
    });
}
exports.rewrite = rewrite;
function pluginHook(req, res, next) {
    // assert the type of res.locals.homePageRoute
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;
    plugins.hooks
        .fire(hook, {
        req: req,
        res: res,
        next: next,
    })
        .catch((error) => {
        // Handle the error here
        console.error('Error in pluginHook:', error);
        next(error); // Propagate the error
    });
}
exports.pluginHook = pluginHook;
