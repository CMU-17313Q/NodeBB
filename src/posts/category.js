'use strict';


const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');
const activitypub = require('../activitypub');

module.exports = function (Posts) {
	Posts.getCidByPid = async function (pid) {
		const tid = await Posts.getPostField(pid, 'tid');
		console.log('SHAHD_TEST getCidByPid', pid, tid);
		let result;
		if (!tid && activitypub.helpers.isUri(pid)) {
			result = -1; // fediverse pseudo-category
		} else {
			result = await topics.getTopicField(tid, 'cid');
		}
		
		return result;
	};

	Posts.getCidsByPids = async function (pids) {
		const postData = await Posts.getPostsFields(pids, ['tid']);
		const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
		const topicData = await topics.getTopicsFields(tids, ['cid']);
		const tidToTopic = _.zipObject(tids, topicData);

		const cids = postData.map(post => tidToTopic[post.tid] && tidToTopic[post.tid].cid);
		return cids;
	};
	
	Posts.filterPidsByCid = async function (pids, cid) {
		console.log('SHAHD_TEST filterPidsByCid', cid);
		let filteredPids;
		if (!cid) {
			filteredPids = pids;
		} else if (!Array.isArray(cid) || cid.length === 1) {
			filteredPids = await filterPidsBySingleCid(pids, cid);
		} else {
			const pidsArr = await Promise.all(cid.map(c => Posts.filterPidsByCid(pids, c)));
			filteredPids = _.union(...pidsArr);
		}
		
		return filteredPids;
	};
	
	async function filterPidsBySingleCid(pids) {
		const isMembers = await db.isSortedSetMembers('cid:${parseInt(cid, 10)}:pids', pids);
		const result = pids.filter((pid, index) => pid && isMembers[index]);
		return result;
	}


};