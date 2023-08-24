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
exports.delete = exports.unfollow = exports.ignore = exports.follow = exports.unlock = exports.lock = exports.unpin = exports.pin = exports.purge = exports.restore = exports.reply = exports.create = exports.get = void 0;
const user_1 = __importDefault(require("../user"));
const topics_1 = __importDefault(require("../topics"));
const posts_1 = __importDefault(require("../posts"));
const meta_1 = __importDefault(require("../meta"));
const privileges_1 = __importDefault(require("../privileges"));
const helpers_1 = __importDefault(require("./helpers"));
const socket_io_1 = __importDefault(require("../socket.io"));
const helpers_2 = __importDefault(require("../socket.io/helpers"));
const { doTopicAction } = helpers_1.default;
function get(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPrivileges = yield privileges_1.default.topics.get(data.tid, caller.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topic = topics_1.default.getTopicData(data.tid);
        if (!topic ||
            !userPrivileges.read ||
            !userPrivileges['topics:read'] ||
            !privileges_1.default.topics.canViewDeletedScheduled(topic, userPrivileges)) {
            return null;
        }
        return topic;
    });
}
exports.get = get;
function create(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const payload = Object.assign({}, data);
        payload.tags = payload.tags || [];
        helpers_1.default.setDefaultPostData(caller, payload);
        const dataTimestamp = typeof data.timestamp === 'string' ? parseInt(data.timestamp, 10) : data.timestamp;
        const isScheduling = dataTimestamp > payload.timestamp;
        if (isScheduling) {
            if (yield privileges_1.default.categories.can('topics:schedule', data.cid, caller.uid)) {
                payload.timestamp = dataTimestamp;
            }
            else {
                throw new Error('[[error:no-privileges]]');
            }
        }
        yield meta_1.default.blacklist.test(caller.ip);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const shouldQueue = yield posts_1.default.shouldQueue(caller.uid, payload);
        if (shouldQueue) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield posts_1.default.addToQueue(payload);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = yield topics_1.default.post(payload);
        yield topics_1.default.thumbs.migrate(data.uuid, result.topicData.tid);
        yield helpers_2.default.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
        yield helpers_2.default.emitToUids('event:new_topic', result.topicData, [caller.uid]);
        yield helpers_2.default.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });
        return result.topicData;
    });
}
exports.create = create;
function reply(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (!data || !data.tid || (meta_1.default.config.minimumPostLength !== 0 && !data.content)) {
            throw new Error('[[error:invalid-data]]');
        }
        const payload = Object.assign({}, data);
        helpers_1.default.setDefaultPostData(caller, payload);
        yield meta_1.default.blacklist.test(caller.ip);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const shouldQueue = yield posts_1.default.shouldQueue(caller.uid, payload);
        if (shouldQueue) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield posts_1.default.addToQueue(payload);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData = yield topics_1.default.reply(payload); // postData seems to be a subset of postObj, refactor?
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postObj = yield posts_1.default.getPostSummaryByPids([postData.pid], caller.uid, {});
        const meta_config = meta_1.default.config;
        const result = {
            posts: [postData],
            'reputation:disabled': meta_config['reputation:disabled'] === 1,
            'downvote:disabled': meta_config['downvote:disabled'] === 1,
        };
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        user_1.default.updateOnlineUsers(caller.uid);
        if (caller.uid) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield helpers_2.default.emitToUids('event:new_post', result, [caller.uid]);
        }
        else if (caller.uid === 0) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield socket_io_1.default.in('online_guests').emit('event:new_post', result);
        }
        yield helpers_2.default.notifyNew(caller.uid, 'newPost', result);
        return postObj[0];
    });
}
exports.reply = reply;
function _delete(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('delete', 'event:topic_deleted', caller, {
            tids: data.tids,
        });
    });
}
exports.delete = _delete;
function restore(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('restore', 'event:topic_restored', caller, {
            tids: data.tids,
        });
    });
}
exports.restore = restore;
function purge(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('purge', 'event:topic_purged', caller, {
            tids: data.tids,
        });
    });
}
exports.purge = purge;
function pin(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('pin', 'event:topic_pinned', caller, {
            tids: data.tids,
        });
    });
}
exports.pin = pin;
function unpin(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('unpin', 'event:topic_unpinned', caller, {
            tids: data.tids,
        });
    });
}
exports.unpin = unpin;
function lock(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('lock', 'event:topic_locked', caller, {
            tids: data.tids,
        });
    });
}
exports.lock = lock;
function unlock(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('unlock', 'event:topic_unlocked', caller, {
            tids: data.tids,
        });
    });
}
exports.unlock = unlock;
function follow(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield topics_1.default.follow(data.tid, caller.uid);
    });
}
exports.follow = follow;
function ignore(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield topics_1.default.ignore(data.tid, caller.uid);
    });
}
exports.ignore = ignore;
function unfollow(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield topics_1.default.unfollow(data.tid, caller.uid);
    });
}
exports.unfollow = unfollow;
