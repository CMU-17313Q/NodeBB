'use strict';

const validator = require('validator');
const nconf = require('nconf');

const meta = require('../meta');
const groups = require('../groups');
const user = require('../user');
const helpers = require('./helpers');
const pagination = require('../pagination');
const privileges = require('../privileges');

const groupsController = module.exports;

const url = nconf.get('url');

groupsController.list = async function (req, res) {
	const sort = req.query.sort || 'alpha';
	const page = parseInt(req.query.page, 10) || 1;
	const [allowGroupCreation, [groupData, pageCount]] = await Promise.all([
		privileges.global.can('group:create', req.uid),
		getGroups(req, sort, page),
	]);

	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}${req.url.replace(/^\/api/, '')}`,
		},
	];

	res.render('groups/list', {
		groups: groupData,
		allowGroupCreation: allowGroupCreation,
		sort: validator.escape(String(sort)),
		pagination: pagination.create(page, pageCount, req.query),
		title: '[[pages:groups]]',
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
	});
};

async function getGroups(req, sort, page) {
	const resultsPerPage = req.query.query ? 100 : 15;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	if (req.query.query) {
		const filterHidden = req.query.filterHidden === 'true' || !await user.isAdministrator(req.uid);
		const groupData = await groups.search(req.query.query, {
			sort,
			filterHidden: filterHidden,
			showMembers: req.query.showMembers === 'true',
			hideEphemeralGroups: req.query.hideEphemeralGroups === 'true',
			excludeGroups: Array.isArray(req.query.excludeGroups) ? req.query.excludeGroups : [],
		});
		const pageCount = Math.ceil(groupData.length / resultsPerPage);

		return [groupData.slice(start, stop + 1), pageCount];
	}

	const [groupData, groupCount] = await Promise.all([
		groups.getGroupsBySort(sort, start, stop),
		groups.getGroupCountBySort(sort),
	]);

	const pageCount = Math.ceil(groupCount / resultsPerPage);
	return [groupData, pageCount];
}

// Helper function to handle slug normalization
async function normalizeSlug(req, res) {
	const lowercaseSlug = req.params.slug.toLowerCase();
	if (req.params.slug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.slug = lowercaseSlug;
			return lowercaseSlug;
		}
		res.redirect(`${nconf.get('relative_path')}/groups/${lowercaseSlug}`);
		return null; // here we can see redirection happening
	}
	return lowercaseSlug;
}

// Helper function to check group visibility permissions
async function checkGroupAccess(groupName, { uid, isAdmin, isGlobalMod }) {
	const isHidden = await groups.isHidden(groupName);
	
	if (!isHidden || isAdmin || isGlobalMod) {
		return true; // group access is proved here
	}
	
	// For hidden groups, we need to check membership or invitation
	const [isMember, isInvited] = await Promise.all([
		groups.isMember(uid, groupName),
		groups.isInvited(uid, groupName),
	]);
	
	return isMember || isInvited;
}

// Helper function to fetch group data
async function fetchGroupData(groupName, uid) {
	const [groupData, posts] = await Promise.all([
		groups.get(groupName, {
			uid: uid,
			truncateUserList: true,
			userListCount: 20,
		}),
		groups.getLatestMemberPosts(groupName, 10, uid),
	]);
	
	return { groupData, posts };
}


groupsController.details = async function (req, res, next) {
	
	// Normalizing slug
	const normalizedSlug = await normalizeSlug(req, res);
	if (normalizedSlug === null) {
		return; // Redirection is here happenning
	}
	
	// Getting group name and check if it exists
	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}
	
	const exists = await groups.exists(groupName);
	if (!exists) {
		return next();
	}
	
	// Checking the permissions
	const [isAdmin, isGlobalMod] = await Promise.all([
		privileges.admin.can('admin:groups', req.uid),
		user.isGlobalModerator(req.uid),
	]);
	
	const hasAccess = await checkGroupAccess(groupName, { uid: req.uid, isAdmin, isGlobalMod });
	if (!hasAccess) {
		return next();
	}
	
	// Fetching and rendering the data
	const { groupData, posts } = await fetchGroupData(groupName, req.uid);
	if (!groupData) {
		return next();
	}
	
	// Setting the response
	res.locals.linkTags = [{
		rel: 'canonical',
		href: `${url}/groups/${normalizedSlug}`,
	}];
	
	res.render('groups/details', {
		title: `[[pages:group, ${groupData.displayName}]]`,
		group: groupData,
		posts: posts,
		isAdmin: isAdmin,
		isGlobalMod: isGlobalMod,
		allowPrivateGroups: meta.config.allowPrivateGroups,
		breadcrumbs: helpers.buildBreadcrumbs([
			{ text: '[[pages:groups]]', url: '/groups' }, 
			{ text: groupData.displayName },
		]),
	});
};

groupsController.members = async function (req, res, next) {
	const page = parseInt(req.query.page, 10) || 1;
	const usersPerPage = 50;
	const start = Math.max(0, (page - 1) * usersPerPage);
	const stop = start + usersPerPage - 1;
	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}
	const [groupData, isAdminOrGlobalMod, isMember, isHidden] = await Promise.all([
		groups.getGroupData(groupName),
		user.isAdminOrGlobalMod(req.uid),
		groups.isMember(req.uid, groupName),
		groups.isHidden(groupName),
	]);

	if (isHidden && !isMember && !isAdminOrGlobalMod) {
		return next();
	}
	const users = await user.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop);

	const breadcrumbs = helpers.buildBreadcrumbs([
		{ text: '[[pages:groups]]', url: '/groups' },
		{ text: validator.escape(String(groupName)), url: `/groups/${req.params.slug}` },
		{ text: '[[groups:details.members]]' },
	]);

	const pageCount = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
	res.render('groups/members', {
		users: users,
		pagination: pagination.create(page, pageCount, req.query),
		breadcrumbs: breadcrumbs,
	});
};
