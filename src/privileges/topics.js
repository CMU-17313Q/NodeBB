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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canEdit = exports.isOwnerOrAdminOrMod = exports.isAdminOrMod = exports.canDelete = exports.canPurge = exports.filterUids = exports.filterTids = exports.can = exports.get = exports.canViewDeletedScheduled = void 0;
const lodash_1 = __importDefault(require("lodash"));
const meta_1 = __importDefault(require("../meta"));
const topics = __importStar(require("../topics"));
const user = __importStar(require("../user"));
const helpers = __importStar(require("./helpers"));
const categories = __importStar(require("../categories"));
const plugins = __importStar(require("../plugins"));
const privsCategories = __importStar(require("./categories"));
function canViewDeletedScheduled(topic, privileges = {}, viewDeleted = false, viewScheduled = false) {
    if (!topic) {
        return false;
    }
    const { deleted = false, scheduled = false } = topic;
    const { view_deleted = viewDeleted, view_scheduled = viewScheduled } = privileges;
    // conceptually exclusive, scheduled topics deemed to be not deleted (they can only be purged)
    if (scheduled) {
        return view_scheduled;
    }
    else if (deleted) {
        return view_deleted;
    }
    return true;
}
exports.canViewDeletedScheduled = canViewDeletedScheduled;
function get(tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = parseInt(uid, 10);
        const privs = [
            'topics:reply', 'topics:read', 'topics:schedule', 'topics:tag',
            'topics:delete', 'posts:edit', 'posts:history',
            'posts:delete', 'posts:view_deleted', 'read', 'purge',
        ];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const topicData = yield topics.getTopicFields(tid, ['cid', 'uid', 'locked', 'deleted', 'scheduled']);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [userPrivileges, isAdministrator, isModerator, disabled] = yield Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            helpers.isAllowedTo(privs, userId, topicData.cid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            user.isAdministrator(userId),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            user.isModerator(userId, topicData.cid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            categories.getCategoryField(topicData.cid, 'disabled'),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const privData = lodash_1.default.zipObject(privs, userPrivileges);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isOwner = userId > 0 && userId === topicData.uid;
        const isAdminOrMod = isAdministrator || isModerator;
        const editable = isAdminOrMod;
        const deletable = (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const mayReply = canViewDeletedScheduled(topicData, {}, false, privData['topics:schedule']);
        return yield plugins.hooks.fire('filter:privileges.topics.get', {
            'topics:reply': (privData['topics:reply'] && ((!topicData.locked && mayReply) || isModerator)) || isAdministrator,
            'topics:read': privData['topics:read'] || isAdministrator,
            'topics:schedule': privData['topics:schedule'] || isAdministrator,
            'topics:tag': privData['topics:tag'] || isAdministrator,
            'topics:delete': (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator,
            'posts:edit': (privData['posts:edit'] && (!topicData.locked || isModerator)) || isAdministrator,
            'posts:history': privData['posts:history'] || isAdministrator,
            'posts:delete': (privData['posts:delete'] && (!topicData.locked || isModerator)) || isAdministrator,
            'posts:view_deleted': privData['posts:view_deleted'] || isAdministrator,
            read: privData.read || isAdministrator,
            purge: (privData.purge && (isOwner || isModerator)) || isAdministrator,
            view_thread_tools: editable || deletable,
            editable: editable,
            deletable: deletable,
            view_deleted: isAdminOrMod || isOwner || privData['posts:view_deleted'],
            view_scheduled: privData['topics:schedule'] || isAdministrator,
            isAdminOrMod: isAdminOrMod,
            disabled: disabled,
            tid: tid,
            uid: uid,
        });
    });
}
exports.get = get;
function can(privilege, tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const cid = yield topics.getTopicField(tid, 'cid');
        return yield privsCategories.can(privilege, cid, uid);
    });
}
exports.can = can;
function filterTids(privilege, tids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(tids) || !tids.length) {
            return [];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const topicsData = yield topics.getTopicsFields(tids, ['tid', 'cid', 'deleted', 'scheduled']);
        const cids = lodash_1.default.uniq(topicsData.map(topic => topic.cid));
        const results = yield privsCategories.getBase(privilege, cids, uid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const allowedCids = cids.filter((cid, index) => (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        !results.categories[index].disabled && (results.allowedTo[index] || results.isAdmin)));
        const cidsSet = new Set(allowedCids);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const canViewDeleted = lodash_1.default.zipObject(cids, results.view_deleted);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const canViewScheduled = lodash_1.default.zipObject(cids, results.view_scheduled);
        tids = topicsData.filter(t => (cidsSet.has(t.cid) &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (results.isAdmin ||
                canViewDeletedScheduled(t, {}, canViewDeleted[t.cid], canViewScheduled[t.cid])))).map(t => t.tid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = yield plugins.hooks.fire('filter:privileges.topics.filter', {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            privilege: privilege,
            uid: uid,
            tids: tids,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return data ? data.tids : [];
    });
}
exports.filterTids = filterTids;
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
function filterUids(privilege, tid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids) || !uids.length) {
            return [];
        }
        uids = lodash_1.default.uniq(uids);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const topicData = yield topics.getTopicFields(tid, ['tid', 'cid', 'deleted', 'scheduled']);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [disabled, allowedTo, isAdmins] = yield Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            categories.getCategoryField(topicData.cid, 'disabled'),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            helpers.isUsersAllowedTo(privilege, uids, topicData.cid),
            user.isAdministrator(uids),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (topicData.scheduled) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const canViewScheduled = yield helpers.isUsersAllowedTo('topics:schedule', uids, topicData.cid);
            uids = uids.filter((uid, index) => canViewScheduled[index]);
        }
        return uids.filter((uid, index) => !disabled &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            ((allowedTo[index] && (topicData.scheduled || !topicData.deleted)) || isAdmins[index]));
    });
}
exports.filterUids = filterUids;
function canPurge(tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
        const cid = yield topics.getTopicField(tid, 'cid');
        const [purge, owner, isAdmin, isModerator] = yield Promise.all([
            privsCategories.isUserAllowedTo('purge', cid, uid),
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
            topics.isOwner(tid, uid),
            user.isAdministrator(uid),
            user.isModerator(uid, cid),
        ]);
        return (purge && (owner || isModerator)) || isAdmin;
    });
}
exports.canPurge = canPurge;
function canDelete(tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
        const topicData = yield topics.getTopicFields(tid, ['uid', 'cid', 'postcount', 'deleterUid']);
        const [isModerator, isAdministrator, isOwner, allowedTo] = yield Promise.all([
            user.isModerator(uid, topicData.cid),
            user.isAdministrator(uid),
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
            topics.isOwner(tid, uid),
            helpers.isAllowedTo('topics:delete', uid, [topicData.cid]),
        ]);
        if (isAdministrator) {
            return true;
        }
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
        const { preventTopicDeleteAfterReplies } = meta_1.default.config;
        if (!isModerator && preventTopicDeleteAfterReplies &&
            ((Number(topicData.postcount) - 1) >= preventTopicDeleteAfterReplies)) {
            const langKey = preventTopicDeleteAfterReplies > 1 ?
                /*
                eslint-disable
                 @typescript-eslint/no-unsafe-member-access,
                 @typescript-eslint/restrict-template-expressions
                 */
                `[[error:cant-delete-topic-has-replies, ${meta_1.default.config.preventTopicDeleteAfterReplies}]]` :
                '[[error:cant-delete-topic-has-reply]]';
            /*
            eslint-enable
            @typescript-eslint/no-unsafe-member-access,
            @typescript-eslint/restrict-template-expressions
            */
            throw new Error(langKey);
        }
        const { deleterUid } = topicData;
        const deleterUidInt = parseInt(deleterUid, 10);
        return allowedTo[0] && ((isOwner && (deleterUidInt === 0 || deleterUidInt === topicData.uid)) || isModerator);
    });
}
exports.canDelete = canDelete;
function isAdminOrMod(tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const cid = yield topics.getTopicField(tid, 'cid');
        return yield privsCategories.isAdminOrMod(cid, uid);
    });
}
exports.isAdminOrMod = isAdminOrMod;
function isOwnerOrAdminOrMod(tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isOwner, isAdminOrMod] = yield Promise.all([
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
            topics.isOwner(tid, uid),
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
            topics.isAdminOrMod(tid, uid),
        ]);
        return isOwner || isAdminOrMod;
    });
}
exports.isOwnerOrAdminOrMod = isOwnerOrAdminOrMod;
function canEdit(tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield isOwnerOrAdminOrMod(tid, uid);
    });
}
exports.canEdit = canEdit;
