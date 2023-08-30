import winston from 'winston';
import db from '../../database';

import posts from '../../posts';
import topics from '../../topics';

import { PostObject, TopicObject } from '../../types';
// copied from core since this function was removed
// https://github.com/NodeBB/NodeBB/blob/v1.x.x/src/posts/flags.js
async function dismissFlag(pid: number) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const postData: PostObject = await db.getObjectFields(`post:${pid}`, ['pid', 'uid', 'flags']) as PostObject;
    if (!postData.pid) {
        return;
    }
    if (postData.uid && postData.flags > 0) {
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetIncrBy('users:flags', -postData.flags, postData.uid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectFieldBy(`user:${postData.uid}`, 'flags', -postData.flags),
        ]);
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const uids: number[] = await db.getSortedSetRange(`pid:${pid}:flag:uids`, 0, -1) as number[];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const nids = uids.map(uid => `post_flag:${pid}:uid:${uid}`);

    await Promise.all([
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.deleteAll(nids.map(nid => `notifications:${nid}`)),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.sortedSetRemove('notifications', nids),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.delete(`pid:${pid}:flag:uids`),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.sortedSetsRemove([
            'posts:flagged',
            'posts:flags:count',
            `uid:${postData.uid}:flag:pids`,
        ], pid),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.deleteObjectField(`post:${pid}`, 'flags'),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.delete(`pid:${pid}:flag:uid:reason`),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.deleteObjectFields(`post:${pid}`, ['flag:state', 'flag:assignee', 'flag:notes', 'flag:history']),
    ]);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0);
}


export = {
    name: 'Dismiss flags from deleted topics',
    timestamp: Date.UTC(2016, 3, 29),
    method: async function () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const pids: number [] = await db.getSortedSetRange('posts:flagged', 0, -1) as number [];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData: PostObject [] = await posts.getPostsFields(pids, ['tid']) as PostObject[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tids = postData.map(t => t.tid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topicData: TopicObject[] = await topics.getTopicsFields(tids, ['deleted']) as TopicObject[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const toDismiss = topicData.map((t, idx) => (parseInt(t.deleted, 10) === 1 ? pids[idx] : null)).filter(Boolean);

        winston.verbose(`[2016/04/29] ${toDismiss.length} dismissable flags found`);
        await Promise.all(toDismiss.map(dismissFlag));
    },
};
