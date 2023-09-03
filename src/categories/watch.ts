
import * as db from '../database';
import * as user from '../user';


interface UserSettings {
    showemail: boolean;
    showfullname: boolean;
    openOutgoingLinksInNewTab: boolean;
    dailyDigestFreq: string;
    usePagination: boolean;
    topicsPerPage: number;
    postsPerPage: number;
    userLang: string;
    acpLang: string;
    topicPostSort: string;
    categoryTopicSort: string;
    followTopicsOnCreate: boolean;
    followTopicsOnReply: boolean;
    upvoteNotifFreq: string;
    restrictChat: boolean;
    topicSearchEnabled: boolean;
    updateUrlWithPostIndex: boolean;
    bootswatchSkin: string;
    homePageRoute: string;
    scrollToMyPost: boolean;
    categoryWatchState: string;
}



export default function (Categories) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.watchStates = {
        ignoring: 1 as number,
        notwatching: 2 as number,
        watching: 3 as number,
    };
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.isIgnored = async function (cids: number[], uid: string) : Promise<boolean[]> {
        if (!(parseInt(uid, 10) > 0)) {
            return cids.map(() => false);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const states: number[] = await Categories.getWatchState(cids, uid) as number[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (states.map((state: number) => state === Categories.watchStates.ignoring));
    };
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.getWatchState = async function (cids: number[], uid: string): Promise<number[]> {
        if (!(parseInt(uid, 10) > 0)) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return cids.map(() => (Categories.watchStates.notwatching as number));
        }
        if (!Array.isArray(cids) || !cids.length) {
            return [] as number[];
        }
        const keys = cids.map((cid: number) => `cid:${cid}:uid:watch:state`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const [userSettings, states] : [UserSettings, number[]] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getSettings(uid) as UserSettings,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetsScore(keys, uid) as number[],
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return states.map((state: number) => state || (
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Categories.watchStates[userSettings.categoryWatchState] as number));
    };
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.getIgnorers = async function (cid: number, start: number, stop: number): Promise<number> {
        const count = (stop === -1) ? -1 : (stop - start + 1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSortedSetRevRangeByScore(
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            `cid:${cid}:uid:watch:state`, start, count, (Categories.watchStates.ignoring as number), (Categories.watchStates.ignoring as number)
        ) as number;
    };
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.filterIgnoringUids = async function (cid: number, uids: string[]): Promise<string[]> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const states: number[] = await Categories.getUidsWatchStates(cid, uids) as number[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const readingUids = uids.filter(
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (uid: string, index: number) => uid && states[index] !== Categories.watchStates.ignoring
        );
        return readingUids;
    };
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.getUidsWatchStates = async function (cid: number, uids: string[]) {
        const [userSettings, states]: [UserSettings, number[]] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getMultipleUserSettings(uids) as UserSettings,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetScores(`cid:${cid}:uid:watch:state`, uids) as number[],
        ]);
        return states.map(
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (state: number, index: number) => state || (
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Categories.watchStates[userSettings[index].categoryWatchState] as number)
        );
    };
}
