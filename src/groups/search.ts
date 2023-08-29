// 'use strict';
import userModule from '../user';
import dbModule from '../database';

interface Group {
    slug: string;
    createtime: number;
    memberCount: number;
    hidden?: boolean;
}

interface User {
    uid: number;
    isOwner: boolean;
}

interface SearchResults {
    users: User[];
}

interface OwnershipObject {
    isOwners(a:number[], b:string): Promise<boolean[]>;
}
interface GroupsModule {
    getOwnersAndMembers(a:string, b:number, c:number, d:number): Promise<User[]>;
    ownership: OwnershipObject;
    getGroupsData(groupNames: string[]): Group[] | PromiseLike<Group[]>;
    getGroupsAndMembers(groupNames: string[]): Group[] | PromiseLike<Group[]>;
    isPrivilegeGroup(name: string): unknown;
    BANNED_USERS: string;
    ephemeralGroups: string[];
    search(query: string, options: SearchOptions): Promise<Group[]>;
    sort(strategy: string, groups: Group[]): Group[];
    searchMembers(data: MemberSearchData): Promise<SearchResults>;
}

interface SearchOptions {
    hideEphemeralGroups?: boolean;
    showMembers?: boolean;
    filterHidden?: boolean;
    sort: string;
}

interface MemberSearchData {
    query?: string;
    groupName: string;
    uid: number;
}

interface SearchResultObject {
    matchCount: number;
    pageCount: number;
    timing: number;
    users: User[]
}
const groupsFunction: (Groups: GroupsModule) => void = function (Groups: GroupsModule) {
    Groups.search = async function (query: string, options: SearchOptions): Promise<Group[]> {
        if (!query) {
            return [];
        }
        query = String(query).toLowerCase();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let groupNames: string[] = await dbModule.getSortedSetRange('groups:createtime', 0, -1) as string[];
        if (!options.hideEphemeralGroups) {
            groupNames = [...Groups.ephemeralGroups, ...groupNames] as string[];
        }
        groupNames = groupNames.filter(
            (name:string) => name.toLowerCase().includes(query) &&
                name !== Groups.BANNED_USERS && // hide banned-users in searches
                !Groups.isPrivilegeGroup(name)
        );
        groupNames = groupNames.slice(0, 100);

        let groupsData: Group[];
        if (options.showMembers) {
            groupsData = await Groups.getGroupsAndMembers(groupNames);
        } else {
            groupsData = await Groups.getGroupsData(groupNames);
        }
        groupsData = groupsData.filter(Boolean);
        if (options.filterHidden) {
            groupsData = groupsData.filter(group => !group.hidden);
        }
        return Groups.sort(options.sort, groupsData);
    };

    Groups.sort = function (strategy: string, groups: Group[]): Group[] {
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

    Groups.searchMembers = async function (data: MemberSearchData): Promise<SearchResults> {
        if (!data.query) {
            const users: User[] = await Groups.getOwnersAndMembers(data.groupName, data.uid, 0, 19);
            return { users: users };
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const results: SearchResultObject = await userModule.search({
            ...data,
            paginate: false,
            hardCap: -1,
        }) as SearchResultObject;

        const uids: number[] = results.users.map(user => user && user.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isOwners: boolean[] = await Groups.ownership.isOwners(uids, data.groupName);

        results.users.forEach((user, index) => {
            if (user) {
                user.isOwner = isOwners[index];
            }
        });

        results.users.sort((a:User, b:User) => {
            if (a.isOwner && !b.isOwner) {
                return -1;
            } else if (!a.isOwner && b.isOwner) {
                return 1;
            }
            return 0;
        });
        return results;
    };
};

export = groupsFunction;






