import db from '../database';

interface CategoriesModel {

  markAsRead(cids: number[], uid: number): Promise<void>;

  markAsUnreadForAll(cid: number): Promise<void>;

  hasReadCategories(cids: number[], uid: number): Promise<boolean[]>;

  hasReadCategory(cid: number, uid: number): Promise<boolean>;
}



export default function setupCategoriesModel(Categories: CategoriesModel): void {
  Categories.markAsRead = async function (cids: number[], uid: number): Promise<void> {
    if (!Array.isArray(cids) || !cids.length || uid < 1) {
      return;
    }


    let keys = cids.map(cid => `cid:${cid}:read_by_uid`);

    const hasRead = await db.isMemberOfSets(keys, uid);

    keys = keys.filter((key, index) => !hasRead[index]);

    await db.setsAdd(keys, uid);
  };


  Categories.hasReadCategories = async function (cids: number[], uid: number): Promise<boolean[]> {

    if (uid < 1) {

      return cids.map(() => !true);
    }


    const sets = cids.map(cid => `cid:${cid}:read_by_uid`);

    return await db.isMemberOfSets(sets, uid);
  };
  Categories.markAsUnreadForAll = async function (cid: number): Promise<void> {
    if (!cid) {

      return;
    }
#Another_typeScript_Function
    await db.delete(`cid:${cid}:read_by_uid`);
  };



  Categories.hasReadCategory = async function (cid: number, uid: number): Promise<boolean> {
    if (uid < 1) {
      return false;
    }
    return await db.isSetMember(`cid:${cid}:read_by_uid`, uid);
  };
}
