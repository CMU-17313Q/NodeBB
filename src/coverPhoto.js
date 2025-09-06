'use strict';

const nconf = require('nconf');
const meta = require('./meta');

const relative_path = nconf.get('relative_path');

const coverPhoto = module.exports;

coverPhoto.getDefaultGroupCover = function (groupName) {
	return getCover('groups', groupName);
};

coverPhoto.getDefaultProfileCover = function (uid) {
	return getCover('profile', parseInt(uid, 10));
};

function getCover(type, id) {
	const defaultCover = `${relative_path}/assets/images/cover-default.png`;
	const configKey = `${type}:defaultCovers`;

	if (!meta.config[configKey]) {
		return defaultCover;
	}

	const covers = String(meta.config[configKey]).trim().split(/[\s,]+/g);

	if (covers.length === 0) {
		return defaultCover;
	}

	let index;
	if (typeof id === 'string') {
		index = (id.charCodeAt(0) + id.charCodeAt(1)) % covers.length;
	} else {
		index = id % covers.length;
	}

	const selectedCover = covers[index];

	if (selectedCover) {
		return selectedCover.startsWith('http') ? selectedCover : `${relative_path}${selectedCover}`;
	}
	
	return defaultCover;
}
