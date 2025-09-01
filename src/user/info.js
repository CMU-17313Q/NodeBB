'use strict';

const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');
const utils = require('../utils');
const plugins = require('../plugins');
const Flags = require('../flags');

/**
 * Top-level helpers. Nothing inside module.exports defines new functions
 * with return statements. We only assign/bind references there.
 */

async function getLatestBanInfo(uid) {
	// Simply retrieves the last record of the user's ban, even if they've been unbanned since then.
	const record = await db.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 0);
	if (!record.length) {
		throw new Error('no-ban-info');
	}
	const banInfo = await db.getObject(record[0]);
	const expire = parseInt(banInfo.expire, 10);
	const expire_readable = utils.toISOString(expire);
	return {
		uid: uid,
		timestamp: banInfo.timestamp,
		banned_until: expire,
		expiry: expire, /* backward compatible alias */
		banned_until_readable: expire_readable,
		expiry_readable: expire_readable, /* backward compatible alias */
		reason: validator.escape(String(banInfo.reason || '')),
	};
}

async function getFlagMetadata(flags) {
	const postFlags = flags.filter(flag => flag && flag.type === 'post');
	const reports = await Promise.all(flags.map(flag => Flags.getReports(flag.flagId)));

	flags.forEach((flag, idx) => {
		if (flag) {
			flag.timestamp = parseInt(flag.datetime, 10);
			flag.timestampISO = utils.toISOString(flag.datetime);
			flag.reports = reports[idx];
		}
	});

	const pids = postFlags.map(flagObj => parseInt(flagObj.targetId, 10));
	const postData = await posts.getPostsFields(pids, ['tid']);
	const tids = postData.map(post => post.tid);

	const topicData = await topics.getTopicsFields(tids, ['title']);
	postFlags.forEach((flagObj, idx) => {
		flagObj.pid = flagObj.targetId;
		if (!tids[idx]) {
			flagObj.targetPurged = true;
		}
		return _.extend(flagObj, topicData[idx]);
	});

	return flags;
}

async function formatBanMuteData(User, keys, noReasonLangKey) {
	const data = await db.getObjects(keys);
	const uids = data.map(d => d.fromUid);
	const usersData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);

	return data.map((banObj, index) => {
		banObj.user = usersData[index];
		banObj.until = parseInt(banObj.expire, 10);
		banObj.untilISO = utils.toISOString(banObj.until);
		banObj.timestampISO = utils.toISOString(banObj.timestamp);
		banObj.reason = validator.escape(String(banObj.reason || '')) || noReasonLangKey;
		return banObj;
	});
}

async function getModerationHistory(User, uid) {
	let [flags, bans, mutes] = await Promise.all([
		db.getSortedSetRevRangeWithScores(`flags:byTargetUid:${uid}`, 0, 19),
		db.getSortedSetRevRange([
			`uid:${uid}:bans:timestamp`, `uid:${uid}:unbans:timestamp`,
		], 0, 19),
		db.getSortedSetRevRange([
			`uid:${uid}:mutes:timestamp`, `uid:${uid}:unmutes:timestamp`,
		], 0, 19),
	]);

	const keys = flags.map(flagObj => `flag:${flagObj.value}`);
	const payload = await db.getObjectsFields(keys, ['flagId', 'type', 'targetId', 'datetime']);

	[flags, bans, mutes] = await Promise.all([
		getFlagMetadata(payload),
		formatBanMuteData(User, bans, '[[user:info.banned-no-reason]]'),
		formatBanMuteData(User, mutes, '[[user:info.muted-no-reason]]'),
	]);

	return { flags, bans, mutes };
}

async function getHistory(User, set) {
	const data = await db.getSortedSetRevRangeWithScores(set, 0, -1);
	data.forEach((item) => {
		item.timestamp = item.score;
		item.timestampISO = utils.toISOString(item.score);
		const parts = item.value.split(':');
		item.value = validator.escape(String(parts[0]));
		item.byUid = validator.escape(String(parts[2] || ''));
		delete item.score;
	});

	const uids = _.uniq(data.map(d => d && d.byUid).filter(Boolean));
	const usersData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
	const uidToUser = _.zipObject(uids, usersData);
	data.forEach((d) => {
		if (d.byUid) {
			d.byUser = uidToUser[d.byUid];
		}
	});
	return data;
}

/**
 * Moderation notes helpers rewritten to reduce parameter count by using an options object.
 */
async function _getModerationNotes(User, { uid, start, stop }) {
	// console.log("DEEMA_ALKHALIFA");
	const noteIds = await db.getSortedSetRevRange(`uid:${uid}:moderation:notes`, start, stop);
	return await _getModerationNotesByIds(User, { uid, noteIds });
}

async function _getModerationNotesByIds(User, { uid, noteIds }) {
	const keys = noteIds.map(id => `uid:${uid}:moderation:note:${id}`);
	const notes = await db.getObjects(keys);
	const uids = [];

	notes.forEach((note, idx) => {
		if (note) {
			note.id = noteIds[idx];
			uids.push(note.uid);
			note.timestampISO = utils.toISOString(note.timestamp);
		}
	});

	const userData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
	await Promise.all(notes.map(async (note, index) => {
		if (note) {
			note.rawNote = validator.escape(String(note.note));
			note.note = await plugins.hooks.fire('filter:parse.raw', String(note.note));
			note.user = userData[index];
		}
	}));
	return notes;
}

async function appendModerationNote({ uid, noteData }) {
	await db.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
	await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
}

async function setModerationNote({ uid, noteData }) {
	await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
}

/**
 * Exported initializer: only assigns/binds pre-defined helpers.
 * No nested function literals with `return` inside this body.
 */
module.exports = function (User) {
	// Temporary runtime proof (uncomment when you do the screenshot), then remove before commit:
	// console.log("DEEMA_ALKHALIFA");

	// Direct assignments
	User.getLatestBanInfo = getLatestBanInfo;
	User.appendModerationNote = appendModerationNote;
	User.setModerationNote = setModerationNote;

	// Pre-bind helpers that require `User`
	User.getModerationHistory = getModerationHistory.bind(null, User);
	User.getHistory = getHistory.bind(null, User);

	// Keep public API signatures the same while using internal helpers with fewer params
	User.getModerationNotes = function (uid, start, stop) {
		return _getModerationNotes(User, { uid, start, stop });
	};
	User.getModerationNotesByIds = function (uid, noteIds) {
		return _getModerationNotesByIds(User, { uid, noteIds });
	};
};
