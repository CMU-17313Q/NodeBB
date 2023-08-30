import db from '../database'; 
import { CallbackBasedApi, Database } from '../database';

interface CategoriesModel extends CallbackBasedApi {
    markAsRead: (cids: number[], uid: number) => Promise<void>;
    markAsUnreadForAll: (cid: number) => Promise<void>;
    hasReadCategories: (cids: number[], uid: number) => Promise<boolean[]>;
    hasReadCategory: (cid: number, uid: number) => Promise<boolean>;
}

const Categories: CategoriesModel = {
    async markAsRead(cids: number[], uid: number): Promise<void> {
        if (!Array.isArray(cids) || !cids.length || uid <= 0) {
            return;
        }
        let keys: string[] = cids.map(cid => `cid:${cid}:read_by_uid`);
        const hasRead: boolean[] = await db.isMemberOfSets(keys, uid);
        keys = keys.filter((key, index) => !hasRead[index]);
        await db.setsAdd(keys, uid);
    },

    async markAsUnreadForAll(cid: number): Promise<void> {
        if (!parseInt(cid.toString(), 10)) {
            return;
        }
        await db.delete(`cid:${cid}:read_by_uid`);
    },

    async hasReadCategories(cids: number[], uid: number): Promise<boolean[]> {
        if (uid <= 0) {
            return cids.map(() => false);
        }

        const sets: string[] = cids.map(cid => `cid:${cid}:read_by_uid`);
        return await db.isMemberOfSets(sets, uid);
    },

    async hasReadCategory(cid: number, uid: number): Promise<boolean> {
        if (uid <= 0) {
            return false;
        }
        return await db.isSetMember(`cid:${cid}:read_by_uid`, uid);
    },
};

export default Categories;
