import validator from 'validator';
import privileges from '../privileges';
import events from '../events';
import groups from '../groups';
import user from '../user';
import meta from '../meta';
import notifications from '../notifications';
import slugify from '../slugify';
import { GroupDataObject } from '../types/group';

interface Caller {
    uid: number | string
    ip: string
}

interface Data {
    name: string
    ownerUid: number | string
    system: boolean
    slug: string
    uid: number | string
}

async function isOwner(caller: Caller, groupName: string) {
    if (typeof groupName !== 'string') {
        throw new Error('[[error:invalid-group-name]]');
    }
    const hasAdminPrivilege: boolean = await privileges.admin.can('admin:groups', caller.uid) as boolean;
    const isGlobalModerator: boolean = await user.isGlobalModerator(caller.uid) as boolean;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const isOwner: boolean = await groups.ownership.isOwner(caller.uid, groupName) as boolean;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const group: GroupDataObject = await groups.getGroupData(groupName) as GroupDataObject;

    const check = isOwner || hasAdminPrivilege || (isGlobalModerator && !group.system);
    if (!check) {
        throw new Error('[[error:no-privileges]]');
    }
}

async function logGroupEvent(caller: Caller, event: string, additional) {
    await events.log({
        type: event,
        uid: caller.uid,
        ip: caller.ip,
        ...additional,
    });
}

export async function create(caller: Caller, data: Data) {
    if (!caller.uid) {
        throw new Error('[[error:no-privileges]]');
    } else if (!data) {
        throw new Error('[[error:invalid-data]]');
    } else if (typeof data.name !== 'string' || groups.isPrivilegeGroup(data.name)) {
        throw new Error('[[error:invalid-group-name]]');
    }

    const canCreate: boolean = await privileges.global.can('group:create', caller.uid) as boolean;
    if (!canCreate) {
        throw new Error('[[error:no-privileges]]');
    }
    data.ownerUid = caller.uid;
    data.system = false;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const groupData: GroupDataObject = await groups.create(data) as GroupDataObject;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await logGroupEvent(caller, 'group-create', {
        groupName: data.name,
    });
    return groupData;
}

export async function update(caller: Caller, data: Data) {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }
    const groupName: string = await groups.getGroupNameByGroupSlug(data.slug) as string;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await isOwner(caller, groupName);

    delete data.slug;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await groups.update(groupName, data);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const result: GroupDataObject = await groups.getGroupData(data.name || groupName) as GroupDataObject;
    return result;
}


async function _delete(caller: Caller, data: Data) {
    const groupName: string = await groups.getGroupNameByGroupSlug(data.slug) as string;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await isOwner(caller, groupName);
    if (
        groups.systemGroups.includes(groupName) ||
        groups.ephemeralGroups.includes(groupName)
    ) {
        throw new Error('[[error:not-allowed]]');
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await groups.destroy(groupName);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await logGroupEvent(caller, 'group-delete', {
        groupName: groupName,
    });
}

export async function join(caller: Caller, data: Data) {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }
    if (caller.uid <= 0 || !data.uid) {
        throw new Error('[[error:invalid-uid]]');
    }

    const groupName: string = await groups.getGroupNameByGroupSlug(data.slug) as string;
    if (!groupName) {
        throw new Error('[[error:no-group]]');
    }

    const isCallerAdmin: boolean = await user.isAdministrator(caller.uid) as boolean;
    if (!isCallerAdmin && (
        groups.systemGroups.includes(groupName) ||
        groups.isPrivilegeGroup(groupName)
    )) {
        throw new Error('[[error:not-allowed]]');
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const groupData: GroupDataObject = await groups.getGroupData(groupName) as GroupDataObject;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const isCallerOwner: boolean = await groups.ownership.isOwner(caller.uid, groupName) as boolean;
    const userExists: boolean = await user.exists(data.uid) as boolean;


    if (!userExists) {
        throw new Error('[[error:invalid-uid]]');
    }

    const calledUidAsString: string = caller.uid as string;
    const dataUidAsString: string = data.uid as string;
    const isSelf = parseInt(calledUidAsString, 10) === parseInt(dataUidAsString, 10);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (!meta.config.allowPrivateGroups && isSelf) {
        // all groups are public!
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await groups.join(groupName, data.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await logGroupEvent(caller, 'group-join', {
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
        await groups.join(groupName, data.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await logGroupEvent(caller, 'group-join', {
            groupName: groupName,
            targetUid: data.uid,
        });
    } else if (isSelf) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await groups.requestMembership(groupName, caller.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await logGroupEvent(caller, 'group-request-membership', {
            groupName: groupName,
            targetUid: data.uid,
        });
    }
}

export async function leave(caller: Caller, data: Data) {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }
    if (caller.uid <= 0) {
        throw new Error('[[error:invalid-uid]]');
    }
    const calledUidAsString: string = caller.uid as string;
    const dataUidAsString: string = data.uid as string;
    const isSelf: boolean = parseInt(calledUidAsString, 10) === parseInt(dataUidAsString, 10);
    const groupName: string = await groups.getGroupNameByGroupSlug(data.slug) as string;
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
    const groupData: GroupDataObject = await groups.getGroupData(groupName) as GroupDataObject;
    const isCallerAdmin: boolean = await user.isAdministrator(caller.uid) as boolean;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const isCallerOwner: boolean = await groups.ownership.isOwner(caller.uid, groupName) as boolean;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const userExists: boolean = await user.exists(data.uid) as boolean;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const isMember: boolean = await groups.isMember(data.uid, groupName) as boolean;


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
        await groups.leave(groupName, data.uid);
    } else {
        throw new Error('[[error:no-privileges]]');
    }


    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { displayname }: {displayname: string} = await user.getUserFields(data.uid, ['username']) as {displayname: string};
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const slugified: string = slugify(groupName) as string;
    const path = `/groups/${slugified}`;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const notification: Notification = await notifications.create({
        type: 'group-leave',
        bodyShort: `[[groups:membership.leave.notification_title, ${displayname}, ${groupName}]]`,
        nid: `group:${validator.escape(groupName)}:uid:${data.uid}:group-leave`,
        path: path,
        from: data.uid,
    }) as Notification;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const uids : string[] = await groups.getOwners(groupName) as string[];
    await notifications.push(notification, uids);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await logGroupEvent(caller, 'group-leave', {
        groupName: groupName,
        targetUid: data.uid,
    });
}

export async function grant(caller: Caller, data: Data) {
    const groupName: string = await groups.getGroupNameByGroupSlug(data.slug) as string;
    await isOwner(caller, groupName);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await groups.ownership.grant(data.uid, groupName);
    await logGroupEvent(caller, 'group-owner-grant', {
        groupName: groupName,
        targetUid: data.uid,
    });
}

export async function rescind(caller: Caller, data: Data) {
    const groupName: string = await groups.getGroupNameByGroupSlug(data.slug) as string;
    await isOwner(caller, groupName);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await groups.ownership.rescind(data.uid, groupName);
    await logGroupEvent(caller, 'group-owner-rescind', {
        groupName: groupName,
        targetUid: data.uid,
    });
}

export {
    _delete as delete,
};
