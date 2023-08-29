"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
// 'use strict';
const user_1 = __importDefault(require("../user"));
const database_1 = __importDefault(require("../database"));
const groupsFunction = function (Groups) {
    Groups.search = async function (query, options) {
        if (!query) {
            return [];
        }
        query = String(query).toLowerCase();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let groupNames = await database_1.default.getSortedSetRange('groups:createtime', 0, -1);
        if (!options.hideEphemeralGroups) {
            groupNames = [...Groups.ephemeralGroups, ...groupNames];
        }
        groupNames = groupNames.filter((name) => name.toLowerCase().includes(query) &&
            name !== Groups.BANNED_USERS && // hide banned-users in searches
            !Groups.isPrivilegeGroup(name));
        groupNames = groupNames.slice(0, 100);
        let groupsData;
        if (options.showMembers) {
            groupsData = await Groups.getGroupsAndMembers(groupNames);
        }
        else {
            groupsData = await Groups.getGroupsData(groupNames);
        }
        groupsData = groupsData.filter(Boolean);
        if (options.filterHidden) {
            groupsData = groupsData.filter(group => !group.hidden);
        }
        return Groups.sort(options.sort, groupsData);
    };
    Groups.sort = function (strategy, groups) {
        switch (strategy) {
            case 'count':
                groups.sort((a, b) => (a.slug > b.slug ? 1 : -1)).sort((a, b) => b.memberCount - a.memberCount);
                break;
            case 'date':
                groups.sort((a, b) => b.createtime - a.createtime);
                break;
            case 'alpha':
            default:
                groups.sort((a, b) => (a.slug > b.slug ? 1 : -1));
        }
        return groups;
    };
    Groups.searchMembers = async function (data) {
        if (!data.query) {
            const users = await Groups.getOwnersAndMembers(data.groupName, data.uid, 0, 19);
            return { users: users };
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const results = await user_1.default.search(Object.assign(Object.assign({}, data), { paginate: false, hardCap: -1 }));
        const uids = results.users.map(user => user && user.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isOwners = await Groups.ownership.isOwners(uids, data.groupName);
        results.users.forEach((user, index) => {
            if (user) {
                user.isOwner = isOwners[index];
            }
        });
        results.users.sort((a, b) => {
            if (a.isOwner && !b.isOwner) {
                return -1;
            }
            else if (!a.isOwner && b.isOwner) {
                return 1;
            }
            return 0;
        });
        return results;
    };
};
module.exports = groupsFunction;
