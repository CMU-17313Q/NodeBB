import categories from '../categories';
import events from '../events';
import user from '../user';
import groups from '../groups';
import privileges from '../privileges';
import { CategoryObject } from '../types/category';

interface Caller {
    uid: string ;
    ip: string
}

interface Data {
    uid: string;
    cid: string;
    member: string | number;
    privilege: string | string[];
    set: string
}
interface UserPrivilege {
    [key: string]: boolean,
    read?: boolean,
}

export async function get(caller: Caller, data: Data) : Promise<CategoryObject> {
    const userPrivileges: UserPrivilege = await privileges.categories.get(data.cid, caller.uid) as UserPrivilege;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const category: CategoryObject = await categories.getCategoryData(data.cid) as CategoryObject;
    if (!category || !userPrivileges.read) {
        return null;
    }
    return category;
}

export async function create(caller: Caller, data: Data) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const response : CategoryObject = await categories.create(data) as CategoryObject;
    const categoryIds: number[] = [response.cid];
    const userUid : string = caller.uid;
    const categoryObjs:CategoryObject[] = await categories.getCategories(categoryIds, userUid) as CategoryObject[];
    return categoryObjs[0];
}

export async function update(caller: Caller, data: Data) {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await categories.update(data);
}

export async function _delete(caller: Caller, data: Data): Promise<void> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const name: string = await categories.getCategoryField(data.cid, 'name') as string;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await categories.purge(data.cid, caller.uid);
    await events.log({
        type: 'category-purge',
        uid: caller.uid,
        ip: caller.ip,
        cid: data.cid,
        name: name,
    });
}

export async function getPrivileges(caller: Caller, cid : string) {
    if (cid === 'admin') {
        return await privileges.admin.list(caller.uid);
    }
    if (!parseInt(cid, 10)) {
        return await privileges.global.list();
    }
    return await privileges.categories.list(cid);
}

export async function setPrivilege(caller : Caller, data : Data) {
    const [userExists, groupExists] = await Promise.all([
        user.exists(data.member) as boolean,
        groups.exists(data.member) as boolean,
    ]);

    if (!userExists && !groupExists) {
        throw new Error('[[error:no-user-or-group]]');
    }
    const privs = Array.isArray(data.privilege) ? data.privilege : [data.privilege];
    const type :string = data.set ? 'give' : 'rescind';
    if (!privs.length) {
        throw new Error('[[error:invalid-data]]');
    }
    if (parseInt(data.cid, 10) === 0) {
        const adminPrivList : string[] = await privileges.admin.getPrivilegeList() as string[];
        const adminPrivs : string[] = privs.filter(priv => adminPrivList.includes(priv));
        if (adminPrivs.length) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await privileges.admin[type](adminPrivs, data.member);
        }
        const globalPrivList : string[] = await privileges.global.getPrivilegeList() as string[];
        const globalPrivs : string[] = privs.filter(priv => globalPrivList.includes(priv));
        if (globalPrivs.length) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await privileges.global[type](globalPrivs, data.member);
        }
    } else {
        const categoryPrivList : string[] = await privileges.categories.getPrivilegeList() as string[];
        const categoryPrivs: string[] = privs.filter(priv => categoryPrivList.includes(priv));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await privileges.categories[type](categoryPrivs, data.cid, data.member);
    }

    await events.log({
        uid: caller.uid,
        type: 'privilege-change',
        ip: caller.ip,
        privilege: data.privilege.toString(),
        cid: data.cid,
        action: data.set ? 'grant' : 'rescind',
        target: data.member,
    });
}

export {
    _delete as delete,
};
