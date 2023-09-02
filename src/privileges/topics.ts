import _ from 'lodash';

import meta from '../meta';
import * as topics from '../topics';
import * as user from '../user';
import * as helpers from './helpers';
import * as categories from '../categories';
import * as plugins from '../plugins';
import * as privsCategories from './categories';
import { TopicObject } from '../types/topic';


// const privsTopics = module.exports;

/*
type Topic = {
    deleted?: boolean;
    scheduled?: boolean;
};
*/

/*
type TopicData = {
    tid: number,
    cid: number,
    uid: number,
    mainPid: number,
    postcount: number,
    viewcount: number,
    postercount: number,
    deleted: boolean,
    locked: boolean,
    pinned: boolean,
    pinExpiry: number,
    timestamp: number,
    upvotes: number,
    downvotes: number,
    lastposttime: number,
    deleterUid: number,
    scheduled: boolean
    // [key: string]: any,  // other properties
};
*/

type GetReturnType = {
    'topics:reply': boolean;
    'topics:read': boolean;
    'topics:schedule': boolean;
    'topics:tag': boolean;
    'topics:delete': boolean;
    'posts:edit': boolean;
    'posts:history': boolean;
    'posts:delete': boolean;
    'posts:view_deleted': boolean;
    read: boolean;
    purge: boolean;
    view_thread_tools: boolean;
    editable: boolean;
    deletable: boolean;
    view_deleted: boolean;
    view_scheduled: boolean;
    isAdminOrMod: boolean;
    disabled: boolean;
    tid: string;
    uid: string;
};


export function canViewDeletedScheduled(
    topic: TopicObject | null,
    privileges: { view_deleted?: boolean; view_scheduled?: boolean } = {},
    viewDeleted = false,
    viewScheduled = false
): boolean {
    if (!topic) {
        return false;
    }
    const { deleted = false, scheduled = false } = topic;
    const { view_deleted = viewDeleted, view_scheduled = viewScheduled } = privileges;

    // conceptually exclusive, scheduled topics deemed to be not deleted (they can only be purged)
    if (scheduled) {
        return view_scheduled;
    } else if (deleted) {
        return view_deleted;
    }

    return true;
}


export async function get(tid: string, uid: string): Promise<GetReturnType> {
    const userId = parseInt(uid, 10);

    const privs = [
        'topics:reply', 'topics:read', 'topics:schedule', 'topics:tag',
        'topics:delete', 'posts:edit', 'posts:history',
        'posts:delete', 'posts:view_deleted', 'read', 'purge',
    ];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const topicData: TopicObject = await topics.getTopicFields(tid, ['cid', 'uid', 'locked', 'deleted', 'scheduled']) as TopicObject;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [userPrivileges, isAdministrator, isModerator, disabled]: [boolean[], boolean, boolean, boolean] =
        await Promise.all([
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
    const privData: { [key: string]: boolean } = _.zipObject(privs, userPrivileges);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isOwner = userId > 0 && userId === topicData.uid;

    const isAdminOrMod: boolean = isAdministrator || isModerator;
    const editable = isAdminOrMod;
    const deletable = (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const mayReply = canViewDeletedScheduled(topicData, {}, false, privData['topics:schedule']);

    return await plugins.hooks.fire('filter:privileges.topics.get', {
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
    }) as GetReturnType;
}




export async function can(privilege: string, tid: string, uid: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const cid: number = await topics.getTopicField(tid, 'cid');
    return await privsCategories.can(privilege, cid, uid) as boolean;
}

export async function filterTids(privilege: string, tids: number[], uid: string) {
    if (!Array.isArray(tids) || !tids.length) {
        return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const topicsData = await topics.getTopicsFields(tids, ['tid', 'cid', 'deleted', 'scheduled']) as TopicObject[];
    const cids: number[] = _.uniq(topicsData.map(topic => topic.cid));
    const results = await privsCategories.getBase(privilege, cids, uid);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const allowedCids = cids.filter((cid, index) => (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        !results.categories[index].disabled && (results.allowedTo[index] || results.isAdmin)
    ));

    const cidsSet = new Set(allowedCids);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const canViewDeleted = _.zipObject(cids, results.view_deleted);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const canViewScheduled = _.zipObject(cids, results.view_scheduled);

    tids = topicsData.filter(t => (
        cidsSet.has(t.cid) &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        (results.isAdmin ||
            canViewDeletedScheduled(t, {}, canViewDeleted[t.cid] as boolean, canViewScheduled[t.cid] as boolean))
    )).map(t => t.tid);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await plugins.hooks.fire('filter:privileges.topics.filter', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        privilege: privilege,
        uid: uid,
        tids: tids,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return data ? data.tids : [];
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export async function filterUids(privilege: string, tid: number, uids: number[]): Promise<number[]> {
    if (!Array.isArray(uids) || !uids.length) {
        return [];
    }

    uids = _.uniq(uids);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const topicData: TopicObject = await topics.getTopicFields(tid, ['tid', 'cid', 'deleted', 'scheduled']) as TopicObject;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [disabled, allowedTo, isAdmins] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        categories.getCategoryField(topicData.cid, 'disabled'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        helpers.isUsersAllowedTo(privilege, uids, topicData.cid),
        user.isAdministrator(uids),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (topicData.scheduled) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const canViewScheduled = await helpers.isUsersAllowedTo('topics:schedule', uids, topicData.cid) as boolean;
        uids = uids.filter((uid, index) => canViewScheduled[index]);
    }

    return uids.filter((uid, index) => !disabled &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ((allowedTo[index] && (topicData.scheduled || !topicData.deleted)) || isAdmins[index]));
}


export async function canPurge(tid: string, uid: string): Promise<boolean> {
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
    const cid: number = await topics.getTopicField(tid, 'cid') as number;

    const [purge, owner, isAdmin, isModerator] = await Promise.all([
        privsCategories.isUserAllowedTo('purge', cid, uid),
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
        topics.isOwner(tid, uid),
        user.isAdministrator(uid),
        user.isModerator(uid, cid),
    ]) as [boolean, boolean, boolean, boolean];
    return (purge && (owner || isModerator)) || isAdmin;
}

export async function canDelete(tid: string, uid: string): Promise<boolean> {
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
    const topicData = await topics.getTopicFields(tid, ['uid', 'cid', 'postcount', 'deleterUid']) as TopicObject;
    const [isModerator, isAdministrator, isOwner, allowedTo] = await Promise.all([
        user.isModerator(uid, topicData.cid),
        user.isAdministrator(uid),
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
        topics.isOwner(tid, uid),
        helpers.isAllowedTo('topics:delete', uid, [topicData.cid]),
    ]) as [boolean, boolean, boolean, boolean];

    if (isAdministrator) {
        return true;
    }

    // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
    const { preventTopicDeleteAfterReplies } = meta.config;

    if (!isModerator && preventTopicDeleteAfterReplies &&
        ((Number(topicData.postcount) - 1) >= preventTopicDeleteAfterReplies)) {
        const langKey = preventTopicDeleteAfterReplies > 1 ?
            /*
            eslint-disable
             @typescript-eslint/no-unsafe-member-access,
             @typescript-eslint/restrict-template-expressions
             */
            `[[error:cant-delete-topic-has-replies, ${meta.config.preventTopicDeleteAfterReplies}]]` :
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
}

export async function isAdminOrMod(tid: string, uid: string): Promise<boolean> {
    if (parseInt(uid, 10) <= 0) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const cid: number = await topics.getTopicField(tid, 'cid');
    return await privsCategories.isAdminOrMod(cid, uid) as boolean;
}



export async function isOwnerOrAdminOrMod(tid: string, uid: string): Promise<boolean> {
    const [isOwner, isAdminOrMod] = await Promise.all([
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
        topics.isOwner(tid, uid),
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
        topics.isAdminOrMod(tid, uid),
    ]) as [boolean, boolean];
    return isOwner || isAdminOrMod;
}

export async function canEdit(tid: string, uid: string): Promise<boolean> {
    return await isOwnerOrAdminOrMod(tid, uid);
}






