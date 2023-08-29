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
exports.delete = exports.rescind = exports.grant = exports.leave = exports.join = exports.update = exports.create = void 0;
const validator_1 = __importDefault(require("validator"));
const privileges_1 = __importDefault(require("../privileges"));
const events_1 = __importDefault(require("../events"));
const groups_1 = __importDefault(require("../groups"));
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const notifications_1 = __importDefault(require("../notifications"));
const slugify_1 = __importDefault(require("../slugify"));
function isOwner(caller, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        const hasAdminPrivilege = yield privileges_1.default.admin.can('admin:groups', caller.uid);
        const isGlobalModerator = yield user_1.default.isGlobalModerator(caller.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isOwner = yield groups_1.default.ownership.isOwner(caller.uid, groupName);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const group = yield groups_1.default.getGroupData(groupName);
        const check = isOwner || hasAdminPrivilege || (isGlobalModerator && !group.system);
        if (!check) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
function logGroupEvent(caller, event, additional) {
    return __awaiter(this, void 0, void 0, function* () {
        yield events_1.default.log(Object.assign({ type: event, uid: caller.uid, ip: caller.ip }, additional));
    });
}
function create(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller.uid) {
            throw new Error('[[error:no-privileges]]');
        }
        else if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        else if (typeof data.name !== 'string' || groups_1.default.isPrivilegeGroup(data.name)) {
            throw new Error('[[error:invalid-group-name]]');
        }
        const canCreate = yield privileges_1.default.global.can('group:create', caller.uid);
        if (!canCreate) {
            throw new Error('[[error:no-privileges]]');
        }
        data.ownerUid = caller.uid;
        data.system = false;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const groupData = yield groups_1.default.create(data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield logGroupEvent(caller, 'group-create', {
            groupName: data.name,
        });
        return groupData;
    });
}
exports.create = create;
function update(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const groupName = yield groups_1.default.getGroupNameByGroupSlug(data.slug);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield isOwner(caller, groupName);
        delete data.slug;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield groups_1.default.update(groupName, data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = yield groups_1.default.getGroupData(data.name || groupName);
        return result;
    });
}
exports.update = update;
function _delete(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupName = yield groups_1.default.getGroupNameByGroupSlug(data.slug);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield isOwner(caller, groupName);
        if (groups_1.default.systemGroups.includes(groupName) ||
            groups_1.default.ephemeralGroups.includes(groupName)) {
            throw new Error('[[error:not-allowed]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield groups_1.default.destroy(groupName);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield logGroupEvent(caller, 'group-delete', {
            groupName: groupName,
        });
    });
}
exports.delete = _delete;
function join(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        if (caller.uid <= 0 || !data.uid) {
            throw new Error('[[error:invalid-uid]]');
        }
        const groupName = yield groups_1.default.getGroupNameByGroupSlug(data.slug);
        if (!groupName) {
            throw new Error('[[error:no-group]]');
        }
        const isCallerAdmin = yield user_1.default.isAdministrator(caller.uid);
        if (!isCallerAdmin && (groups_1.default.systemGroups.includes(groupName) ||
            groups_1.default.isPrivilegeGroup(groupName))) {
            throw new Error('[[error:not-allowed]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const groupData = yield groups_1.default.getGroupData(groupName);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isCallerOwner = yield groups_1.default.ownership.isOwner(caller.uid, groupName);
        const userExists = yield user_1.default.exists(data.uid);
        if (!userExists) {
            throw new Error('[[error:invalid-uid]]');
        }
        const calledUidAsString = caller.uid;
        const dataUidAsString = data.uid;
        const isSelf = parseInt(calledUidAsString, 10) === parseInt(dataUidAsString, 10);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (!meta_1.default.config.allowPrivateGroups && isSelf) {
            // all groups are public!
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield groups_1.default.join(groupName, data.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield logGroupEvent(caller, 'group-join', {
                groupName: groupName,
                targetUid: data.uid,
            });
            return;
        }
        if (!isCallerAdmin && isSelf && groupData.private && groupData.disableJoinRequests) {
            throw new Error('[[error:group-join-disabled]]');
        }
        if ((!groupData.private && isSelf) || isCallerAdmin || isCallerOwner) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield groups_1.default.join(groupName, data.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield logGroupEvent(caller, 'group-join', {
                groupName: groupName,
                targetUid: data.uid,
            });
        }
        else if (isSelf) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield groups_1.default.requestMembership(groupName, caller.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield logGroupEvent(caller, 'group-request-membership', {
                groupName: groupName,
                targetUid: data.uid,
            });
        }
    });
}
exports.join = join;
function leave(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        if (caller.uid <= 0) {
            throw new Error('[[error:invalid-uid]]');
        }
        const calledUidAsString = caller.uid;
        const dataUidAsString = data.uid;
        const isSelf = parseInt(calledUidAsString, 10) === parseInt(dataUidAsString, 10);
        const groupName = yield groups_1.default.getGroupNameByGroupSlug(data.slug);
        if (!groupName) {
            throw new Error('[[error:no-group]]');
        }
        if (typeof groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        if (groupName === 'administrators' && isSelf) {
            throw new Error('[[error:cant-remove-self-as-admin]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const groupData = yield groups_1.default.getGroupData(groupName);
        const isCallerAdmin = yield user_1.default.isAdministrator(caller.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isCallerOwner = yield groups_1.default.ownership.isOwner(caller.uid, groupName);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userExists = yield user_1.default.exists(data.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isMember = yield groups_1.default.isMember(data.uid, groupName);
        if (!userExists) {
            throw new Error('[[error:invalid-uid]]');
        }
        if (!isMember) {
            return;
        }
        if (groupData.disableLeave && isSelf) {
            throw new Error('[[error:group-leave-disabled]]');
        }
        if (isSelf || isCallerAdmin || isCallerOwner) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield groups_1.default.leave(groupName, data.uid);
        }
        else {
            throw new Error('[[error:no-privileges]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const { displayname } = yield user_1.default.getUserFields(data.uid, ['username']);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const slugified = (0, slugify_1.default)(groupName);
        const path = `/groups/${slugified}`;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const notification = yield notifications_1.default.create({
            type: 'group-leave',
            bodyShort: `[[groups:membership.leave.notification_title, ${displayname}, ${groupName}]]`,
            nid: `group:${validator_1.default.escape(groupName)}:uid:${data.uid}:group-leave`,
            path: path,
            from: data.uid,
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids = yield groups_1.default.getOwners(groupName);
        yield notifications_1.default.push(notification, uids);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield logGroupEvent(caller, 'group-leave', {
            groupName: groupName,
            targetUid: data.uid,
        });
    });
}
exports.leave = leave;
function grant(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupName = yield groups_1.default.getGroupNameByGroupSlug(data.slug);
        yield isOwner(caller, groupName);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield groups_1.default.ownership.grant(data.uid, groupName);
        yield logGroupEvent(caller, 'group-owner-grant', {
            groupName: groupName,
            targetUid: data.uid,
        });
    });
}
exports.grant = grant;
function rescind(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupName = yield groups_1.default.getGroupNameByGroupSlug(data.slug);
        yield isOwner(caller, groupName);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield groups_1.default.ownership.rescind(data.uid, groupName);
        yield logGroupEvent(caller, 'group-owner-rescind', {
            groupName: groupName,
            targetUid: data.uid,
        });
    });
}
exports.rescind = rescind;
