import { Request } from 'express';

import user from '../user';
import topics from '../topics';
import posts from '../posts';
import meta from '../meta';
import privileges from '../privileges';
import apiHelpers from './helpers';
import websockets from '../socket.io';
import socketHelpers from '../socket.io/helpers';

const { doTopicAction } = apiHelpers;

interface Caller extends Request {
  uid: number,
  ip: string,
}

interface Data {
  uuid: string,
  cid: string,
  tid?: string,
  tids?: string[],
  tags: string[],
  content?: string,
  timestamp: number,
}

interface UserPriv {
  [key: string]: boolean,
  read?: boolean,
}

interface Topic {
  [key: string]: boolean,
  deleted: boolean,
  schedule: boolean,
}

interface Post {
  id: number,
  pid: number,
  type: string,
  queued: boolean,
  message: string,
}

interface CreateTopic {
  topicData: Topic,
  postData: Post,
}

interface MetaConfig {
  [key: string]: number,
}

export async function get(caller: Caller, data: Data): Promise<Topic> {
    const userPrivileges: UserPriv = await privileges.topics.get(data.tid, caller.uid) as UserPriv;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const topic: Topic = topics.getTopicData(data.tid) as Topic;

    if (
        !topic ||
        !userPrivileges.read ||
        !userPrivileges['topics:read'] ||
        !privileges.topics.canViewDeletedScheduled(topic, userPrivileges)
    ) {
        return null;
    }

    return topic;
}

export async function create(caller: Caller, data: Data): Promise<Topic | Error> {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }

    const payload = { ...data };
    payload.tags = payload.tags || [];
    apiHelpers.setDefaultPostData(caller, payload);

    const dataTimestamp: number = typeof data.timestamp === 'string' ? parseInt(data.timestamp, 10) : data.timestamp;
    const isScheduling: boolean = dataTimestamp > payload.timestamp;
    if (isScheduling) {
        if (await privileges.categories.can('topics:schedule', data.cid, caller.uid)) {
            payload.timestamp = dataTimestamp;
        } else {
            throw new Error('[[error:no-privileges]]');
        }
    }

    await meta.blacklist.test(caller.ip);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const shouldQueue: boolean = await posts.shouldQueue(caller.uid, payload) as boolean;
    if (shouldQueue) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await posts.addToQueue(payload) as Topic;
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const result: CreateTopic = await topics.post(payload) as CreateTopic;
    await topics.thumbs.migrate(data.uuid, result.topicData.tid);

    await socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
    await socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
    await socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });

    return result.topicData;
}

export async function reply(caller: Caller, data: Data): Promise<Post | Error> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (!data || !data.tid || (meta.config.minimumPostLength !== 0 && !data.content)) {
        throw new Error('[[error:invalid-data]]');
    }
    const payload = { ...data };
    apiHelpers.setDefaultPostData(caller, payload);

    await meta.blacklist.test(caller.ip);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const shouldQueue: boolean = await posts.shouldQueue(caller.uid, payload) as boolean;
    if (shouldQueue) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await posts.addToQueue(payload) as Post;
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const postData: Post = await topics.reply(payload) as Post; // postData seems to be a subset of postObj, refactor?

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const postObj: Post[] = await posts.getPostSummaryByPids([postData.pid], caller.uid, {}) as Post[];

    const meta_config: MetaConfig = meta.config as MetaConfig;

    const result = {
        posts: [postData],
        'reputation:disabled': meta_config['reputation:disabled'] === 1,
        'downvote:disabled': meta_config['downvote:disabled'] === 1,
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    user.updateOnlineUsers(caller.uid);
    if (caller.uid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await socketHelpers.emitToUids('event:new_post', result, [caller.uid]);
    } else if (caller.uid === 0) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await websockets.in('online_guests').emit('event:new_post', result);
    }

    await socketHelpers.notifyNew(caller.uid, 'newPost', result);

    return postObj[0];
}

async function _delete(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('delete', 'event:topic_deleted', caller, {
        tids: data.tids,
    });
}

export async function restore(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('restore', 'event:topic_restored', caller, {
        tids: data.tids,
    });
}

export async function purge(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('purge', 'event:topic_purged', caller, {
        tids: data.tids,
    });
}

export async function pin(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('pin', 'event:topic_pinned', caller, {
        tids: data.tids,
    });
}

export async function unpin(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('unpin', 'event:topic_unpinned', caller, {
        tids: data.tids,
    });
}

export async function lock(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('lock', 'event:topic_locked', caller, {
        tids: data.tids,
    });
}

export async function unlock(caller: Caller, data: Data): Promise<void> {
    await doTopicAction('unlock', 'event:topic_unlocked', caller, {
        tids: data.tids,
    });
}

export async function follow(caller: Caller, data: Data): Promise<void> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await topics.follow(data.tid, caller.uid);
}

export async function ignore(caller: Caller, data: Data): Promise<void> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await topics.ignore(data.tid, caller.uid);
}

export async function unfollow(caller: Caller, data: Data): Promise<void> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await topics.unfollow(data.tid, caller.uid);
}

export {
    _delete as delete,
};
