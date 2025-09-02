
'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const utils = require('../utils');

const helpers = require('./helpers');

const postsController = module.exports;

postsController.redirectToPost = async function (req, res, next) {
	const pid = parsePid(req.params.pid);
	if (!pid) return next();

	await maybeAssertActivityPubNote(pid, req.uid);

	const { canRead, path } = await fetchAccessAndPath(pid, req.uid);
	if (!path) return next();
	if (!canRead) return helpers.notAllowed(req, res);

	setActivityPubLinkHeaderIfEnabled(res, req.params.pid);

	const url = buildUrlWithQuery(path, req.query);
	return helpers.redirect(res, url, true);
};


postsController.getRecentPosts = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const data = await posts.getRecentPosts(req.uid, start, stop, req.params.term);
	res.json(data);
};

// --- Local helpers (no behavior change) ---

function parsePid(raw) {
	return utils.isNumber(raw) ? parseInt(raw, 10) : raw;
}

async function maybeAssertActivityPubNote(pid, uid) {
	// Kickstart note assertion if applicable
	if (!utils.isNumber(pid) && uid && meta.config.activitypubEnabled) {
		const exists = await posts.exists(pid);
		if (!exists) {
			await activitypub.notes.assert(uid, pid);
		}
	}
}

async function fetchAccessAndPath(pid, uid) {
	const [canRead, path] = await Promise.all([
		privileges.posts.can('topics:read', pid, uid),
		posts.generatePostPath(pid, uid),
	]);
	return { canRead, path };
}

function setActivityPubLinkHeaderIfEnabled(res, routePid) {
	if (meta.config.activitypubEnabled) {
		res.set(
			'Link',
			`<${nconf.get('url')}/post/${routePid}>; rel="alternate"; type="application/activity+json"`
		);
	}
}

function buildUrlWithQuery(path, query) {
	const qs = querystring.stringify(query);
	return qs ? `${path}?${qs}` : path;
}
