'use strict';

const async = require('async');
const db = require('../database');
const user = require('../user');

// ---- implementations moved out of the exports wrapper ----

async function getUserBookmark(tid, uid) {
	// TEMP: log for manual verification; remove before final commit
	//console.log('NOOR_NIKNAM:getUserBookmark', { tid, uid });
	// Or, if you prefer winston:
	// require.main.require('winston').info('NOOR_NIKNAM:getUserBookmark', { tid, uid });

	if (Number.parseInt(uid, 10) <= 0) {
		return null;
	}
	return db.sortedSetScore(`tid:${tid}:bookmarks`, uid);
}

async function getUserBookmarks(tids, uid) {
	if (Number.parseInt(uid, 10) <= 0) {
		return tids.map(() => null);
	}
	return db.sortedSetsScore(
		tids.map(tid => `tid:${tid}:bookmarks`),
		uid
	);
}

async function setUserBookmark(tid, uid, index) {
	// TEMP: log for manual verification; remove before final commit
	//console.log('NOOR_NIKNAM:setUserBookmark', { tid, uid, index });

	if (Number.parseInt(uid, 10) <= 0) {
		return;
	}
	await db.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
}

async function getTopicBookmarks(tid) {
	return db.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1);
}

async function updateTopicBookmarks(Topics, tid, pids) {
	const maxIndex = await Topics.getPostCount(tid);
	const indices = await db.sortedSetRanks(`tid:${tid}:posts`, pids);
	const postIndices = indices.map(i => (i === null ? 0 : i + 1));
	const minIndex = Math.min(...postIndices);

	const bookmarks = await getTopicBookmarks(tid);

	const uidData = bookmarks
		.map(b => ({ uid: b.value, bookmark: Number.parseInt(b.score, 10) }))
		.filter(data => data.bookmark >= minIndex);

	await async.eachLimit(uidData, 50, async (data) => {
		let bookmark = Math.min(data.bookmark, maxIndex);

		postIndices.forEach((i) => {
			if (i < data.bookmark) {
				bookmark -= 1;
			}
		});

		// ensure valid bookmark if last post(s) were removed
		bookmark = Math.min(bookmark, maxIndex - pids.length);
		if (bookmark === data.bookmark) {
			return;
		}

		const settings = await user.getSettings(data.uid);
		if (settings.topicPostSort === 'most_votes') {
			return;
		}

		await setUserBookmark(tid, data.uid, bookmark);
	});
}

// ---- export wrapper with no returns ----
module.exports = function (Topics) {
	Topics.getUserBookmark = getUserBookmark;
	Topics.getUserBookmarks = getUserBookmarks;
	Topics.setUserBookmark = setUserBookmark;
	Topics.getTopicBookmarks = getTopicBookmarks;
	Topics.updateTopicBookmarks = (tid, pids) =>
		updateTopicBookmarks(Topics, tid, pids);
};
