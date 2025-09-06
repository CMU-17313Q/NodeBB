'use strict';

const privileges = require('../privileges');
const plugins = require('../plugins');
const helpers = require('./helpers');
const apiController = require('./api');

const adminController = {
	dashboard: require('./admin/dashboard'),
	categories: require('./admin/categories'),
	privileges: require('./admin/privileges'),
	adminsMods: require('./admin/admins-mods'),
	tags: require('./admin/tags'),
	groups: require('./admin/groups'),
	digest: require('./admin/digest'),
	appearance: require('./admin/appearance'),
	extend: {
		widgets: require('./admin/widgets'),
		rewards: require('./admin/rewards'),
	},
	events: require('./admin/events'),
	hooks: require('./admin/hooks'),
	logs: require('./admin/logs'),
	errors: require('./admin/errors'),
	database: require('./admin/database'),
	cache: require('./admin/cache'),
	plugins: require('./admin/plugins'),
	settings: require('./admin/settings'),
	logger: require('./admin/logger'),
	themes: require('./admin/themes'),
	users: require('./admin/users'),
	uploads: require('./admin/uploads'),
	info: require('./admin/info'),
};

adminController.routeIndex = async (req, res) => {
	const privilegeSet = await privileges.admin.get(req.uid);

	if (privilegeSet.superadmin || privilegeSet['admin:dashboard']) {
		return adminController.dashboard.get(req, res);
	}

	const redirects = {
		'admin:categories': 'admin/manage/categories',
		'admin:privileges': 'admin/manage/privileges',
		'admin:users': 'admin/manage/users',
		'admin:groups': 'admin/manage/groups',
		'admin:admins-mods': 'admin/manage/admins-mods',
		'admin:tags': 'admin/manage/tags',
		'admin:settings': 'admin/settings/general',
	};

	for (const [privilege, route] of Object.entries(redirects)) {
		if (privilegeSet[privilege]) {
			return helpers.redirect(res, route);
		}
	}

	return helpers.notAllowed(req, res);
};

adminController.loadConfig = async function (req) {
	const config = await apiController.loadConfig(req);
	await plugins.hooks.fire('filter:config.get.admin', config);
	return config;
};

adminController.getConfig = async (req, res) => {
	const config = await adminController.loadConfig(req);
	res.json(config);
};

module.exports = adminController;
