// eslint-disable-next-line import/no-import-module-exports
import plugins from '../plugins';
// eslint-disable-next-line import/no-import-module-exports
import db from '../database';
// eslint-disable-next-line import/no-import-module-exports
import utils from '../utils';
// eslint-disable-next-line import/no-import-module-exports
import { PostObject } from '../types';

export interface Result{
    pids: number[],
    posts: PostObject[],
    fields: string[],
}
const intFields : string[] = [
    'uid', 'pid', 'tid', 'deleted', 'timestamp',
    'upvotes', 'downvotes', 'deleterUid', 'edited',
    'replies', 'bookmarks',
];

export interface Posts {
    getPostsFields(pids: number[], fields: string[]): Promise<PostObject[]>;
    getPostData(pid:number):Promise<PostObject>;
    getPostsData(pids:number[]):Promise<PostObject[]>;
    getPostField(pid: number, field: string): Promise<PostObject>;
    getPostFields(pid: number, fields: string[]):Promise<PostObject>;
    setPostField(pid: number, field: string, value: number);
    setPostFields(pid: number, data :object);
}

function modifyPost(post: PostObject, fields: string[]) {
    if (post) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.parseIntFields(post, intFields, fields);
        if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
            post.votes = post.upvotes - post.downvotes;
        }
        if (post.hasOwnProperty('timestamp')) {
            post.timestampISO = utils.toISOString(post.timestamp) as string;
        }
        if (post.hasOwnProperty('edited')) {
            post.editedISO = (post.edited !== 0 ? utils.toISOString(post.edited) : '') as string;
        }
    }
}
function configurePosts(Posts: Posts): void {
    Posts.getPostsFields = async function (pids, fields) {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        const keys = pids.map(pid => `post:${pid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData = await db.getObjects(keys, fields) as PostObject[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = await plugins.hooks.fire('filter:post.getFields', {
            pids: pids,
            posts: postData,
            fields: fields,
        }) as Result;
        result.posts.forEach(post => modifyPost(post, fields));
        return result.posts;
    };

    Posts.getPostData = async function (pid) {
        const posts = await Posts.getPostsFields([pid], []);
        return (posts && posts.length) ? posts[0] : null;
    };

    Posts.getPostsData = async function (pids) {
        return await Posts.getPostsFields(pids, []);
    };

    Posts.getPostField = async function (pid, field) {
        const post = await Posts.getPostFields(pid, [field]);
        return (post ? post[field] : null) as PostObject;
    };

    Posts.getPostFields = async function (pid, fields) {
        const posts = await Posts.getPostsFields([pid], fields);
        return posts ? posts[0] : null;
    };

    Posts.setPostField = async function (pid, field, value) {
        await Posts.setPostFields(pid, { [field]: value });
    };

    Posts.setPostFields = async function (pid, data) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`post:${pid}`, data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:post.setFields', { data: { ...data, pid } });
    };
}

module.exports = configurePosts;
