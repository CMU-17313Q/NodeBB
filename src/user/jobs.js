'use strict';

const winston = require('winston');
const cronJob = require('cron').CronJob;
const db = require('../database');
const meta = require('../meta');

const jobs = {};

function startDigestJob({name, cronString, term, user}) {
	jobs[name] = new cronJob(cronString, (async () => {
		winston.verbose(`[user/jobs] Digest job (${name}) started.`);
		try {
			if (name === 'digest.weekly') {
				const counter = await db.increment('biweeklydigestcounter');
				if (counter % 2) {
					await user.digest.execute({ interval: 'biweek' });
				}
			}
			await user.digest.execute({ interval: term });
		} catch (err) {
			winston.error(err.stack);
		}
	}), null, true);
	winston.verbose(`[user/jobs] Starting job (${name})`);
}

function startJobs(user) {
	winston.verbose('[user/jobs] (Re-)starting jobs...');

	let { digestHour } = meta.config;

	// Fix digest hour if invalid
	if (isNaN(digestHour)) {
		digestHour = 17;
	} else if (digestHour > 23 || digestHour < 0) {
		digestHour = 0;
	}

	user.stopJobs();

	startDigestJob({
		name: 'digest.daily', 
		cronString: `0 ${digestHour} * * *`, 
		term: 'day', 
		user: user,
	});
	startDigestJob({
		name: 'digest.weekly', 
		cronString: `0 ${digestHour} * * 0`, 
		term: 'week', 
		user: user,
	});
	startDigestJob({
		name: 'digest.monthly', 
		cronString: `0 ${digestHour} 1 * *`, 
		term: 'month', 
		user: user,
	});

	jobs['reset.clean'] = new cronJob('0 0 * * *', user.reset.clean, null, true);
	winston.verbose('[user/jobs] Starting job (reset.clean)');

	winston.verbose(`[user/jobs] jobs started`);
};

function stopJobs() {
	let terminated = 0;
	// Terminate any active cron jobs
	for (const jobId of Object.keys(jobs)) {
		winston.verbose(`[user/jobs] Terminating job (${jobId})`);
		jobs[jobId].stop();
		delete jobs[jobId];
		terminated += 1;
	}
	if (terminated > 0) {
		winston.verbose(`[user/jobs] ${terminated} jobs terminated`);
	}
};

module.exports = function (User) {
	User.startJobs = () => startJobs(User);
	User.stopJobs = () => stopJobs();
};
