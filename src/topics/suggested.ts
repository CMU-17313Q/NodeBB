import _ from 'lodash';
import db from '../database';
import user from '../user';
import privileges from '../privileges';
import search from '../search';

interface Topic {
    tid: number;
    title: string;
    cid: number;
    timestamp: number;
    lastposttime: 0;
    postcount: 0;
    viewcount: 0;
}

export default function (Topics: any) {
    Topics.getSuggestedTopics = async function (
        tid: number, uid: number, start: number, stop: number, cutoff = 0
    ): Promise<Topic[]> {
        let tids: number[];
        cutoff = cutoff === 0 ? cutoff : (cutoff * 2592000000);

        const tagTids = await getTidsWithSameTags(tid, cutoff);
        const searchTids = await getSearchTids(tid, uid, cutoff);

        tids = _.uniq([...tagTids, ...searchTids]);

        let categoryTids: number[] = [];
        if (stop !== -1 && tids.length < stop - start + 1) {
            categoryTids = await getCategoryTids(tid, cutoff);
        }

        tids = _.shuffle(_.uniq([...tids, ...categoryTids]));
        tids = await privileges.topics.filterTids('topics:read', tids, uid);

        const topicData: Topic[] = await Topics.getTopicsByTids(tids, uid);

        return topicData
            .filter(topic => topic && topic.tid !== tid)
            .slice(start, stop !== -1 ? stop + 1 : undefined)
            .sort((t1, t2) => (t2.timestamp || 0) - (t1.timestamp || 0));
    };

    async function getTidsWithSameTags(tid: number, cutoff: number): Promise<number[]> {
        const tags: string[] = await Topics.getTopicTags(tid);
        let tids: string[];
        if (cutoff === 0) {
            tids = await db.getSortedSetRevRange(tags.map(tag => `tag:${tag}:topics`), 0, -1);
        } else {
            tids = await db.getSortedSetRevRangeByScore(tags.map(tag => `tag:${tag}:topics`), 0, -1, '+inf', Date.now() - cutoff);
        }
        return tids.filter(_tid => _tid !== tid.toString()).map(Number);
    }

    async function getSearchTids(tid: number, uid: number, cutoff: number): Promise<number[]> {
        const topicData = await Topics.getTopicFields(tid, ['title', 'cid']);
        const searchData = await search.search({
            query: topicData.title,
            searchIn: 'titles',
            matchWords: 'any',
            categories: [topicData.cid],
            uid: uid,
            returnIds: true,
            timeRange: cutoff !== 0 ? cutoff / 1000 : 0,
            timeFilter: 'newer',
        });
        return searchData.tids.filter(_tid => _tid !== tid).map(Number);
    }

    async function getCategoryTids(tid: number, cutoff: number): Promise<number[]> {
        const cid = await Topics.getTopicField(tid, 'cid');
        let tids: string[];
        if (cutoff === 0) {
            tids = await db.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9);
        } else {
            tids = await db.getSortedSetRevRangeByScore(`cid:${cid}:tids:lastposttime`, 0, 9, '+inf', Date.now() - cutoff);
        }
        return tids.map(Number).filter(_tid => _tid !== tid);
    }
}
