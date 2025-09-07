'use strict';

const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');
const activitypub = require('../activitypub');

module.exports = function (Posts) {
	Posts.getCidByPid = async function (pid) {
		const tid = await Posts.getPostField(pid, 'tid');

		if (!tid && activitypub.helpers.isUri(pid)) {
			return -1; // fediverse pseudo-category
		}
		return topics.getTopicField(tid, 'cid');
	};

	Posts.getCidsByPids = async function (pids) {
		const postData = await Posts.getPostsFields(pids, ['tid']);
		const tids = _.uniq(postData.map(p => p && p.tid).filter(Boolean));
		const topicData = await topics.getTopicsFields(tids, ['cid']);
		const tidToTopic = _.zipObject(tids, topicData);

		// guard against null posts
		return postData.map(p => (p && tidToTopic[p.tid] && tidToTopic[p.tid].cid) || undefined);
	};

	Posts.filterPidsByCid = async function (pids, cid) {

		if (!cid) return pids;

		if (!Array.isArray(cid) || cid.length === 1) {
			return filterPidsBySingleCid(pids, cid);
		}

		const pidsArr = await Promise.all(cid.map(c => Posts.filterPidsByCid(pids, c)));
		return _.union(...pidsArr);
	};

	async function filterPidsBySingleCid(pids, cid) {
		const cidNum = parseInt(Array.isArray(cid) ? cid[0] : cid, 10);
		const key = `cid:${cidNum}:pids`;
		const isMembers = await db.isSortedSetMembers(key, pids);
		return pids.filter((pid, index) => pid && isMembers[index]);
	}
};