import plugins from '../plugins';
import db from '../database';


// import { PostObject } from './types';

// import posts from '../posts';


interface postData {
    pid: string;
    uid: string;
    bookmarks: number;
}

declare global{
    interface Posts {
        bookmark: (pid: string, uid: string) => Promise<BookmarkResult>;
        unbookmark: (pid: string, uid: string) => Promise<BookmarkResult>;
        getPostFields: (pid: string, fields: string[]) => Promise<postData | null>;
        hasBookmarked: (pid: string | string[], uid: string) => Promise<boolean | boolean[]>;
        setPostField: (pid: string, field: string, value: number) => Promise<void>; // Problem:Update the value type
    }
}

interface BookmarkResult {
    post: postData;
    isBookmarked: boolean;
}



export = function (Posts: Posts) {
    async function toggleBookmark(type: string, pid: string, uid: string) {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }

        const isBookmarking: boolean = type === 'bookmark';


        const [postData, hasBookmarked]: [postData, boolean[] | boolean] = await Promise.all([
            Posts.getPostFields(pid, ['pid', 'uid']),
            Posts.hasBookmarked(pid, uid),
        ]);


        if (isBookmarking && hasBookmarked) {
            throw new Error('[[error:already-bookmarked]]');
        }

        if (!isBookmarking && !hasBookmarked) {
            throw new Error('[[error:already-unbookmarked]]');
        }

        if (isBookmarking) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);


        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const newBookmarksCount: number = await db.setCount(`pid:${pid}:users_bookmarked`) as number;
        postData.bookmarks = newBookmarksCount;



        await Posts.setPostField(pid, 'bookmarks', postData.bookmarks);

        await plugins.hooks.fire(`action:post.${type}`, {
            pid: pid,
            uid: uid,
            owner: postData.uid,
            current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
        });

        return {
            post: postData,
            isBookmarked: isBookmarking,
        };
    }


    Posts.bookmark = async function (pid: string, uid: string): Promise<{ post: postData; isBookmarked: boolean; }> {
        return await toggleBookmark('bookmark', pid, uid);
    };

    Posts.unbookmark = async function (pid: string, uid: string): Promise<{ post: postData; isBookmarked: boolean; }> {
        return await toggleBookmark('unbookmark', pid, uid);
    };

    Posts.hasBookmarked = async function (pid: string | string[], uid: string): Promise<boolean | boolean[]> {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }

        if (Array.isArray(pid)) {
            const sets: string[] = pid.map(pid => `pid:${pid}:users_bookmarked`);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isMember: boolean = await db.isMemberOfSets(sets, uid) as boolean;
            return isMember;
        }


        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isNewMember = await db.isSetMember(`pid:${pid}:users_bookmarked`, uid) as boolean;
        return isNewMember;
    };
    return Posts;
};


