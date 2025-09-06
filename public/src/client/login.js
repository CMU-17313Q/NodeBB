'use strict';


define('forum/login', ['hooks', 'translator', 'jquery-form'], function (hooks, translator) {
	const Login = {
		_capsState: false,
	};

	Login.init = function () {
		const errorEl = $('#login-error-notify');
		const submitEl = $('#login');
		const formEl = $('#login-form');

		bindSubmitHandler({ formEl, submitEl, errorEl });


		// Guard against caps lock
		Login.capsLockCheck(document.querySelector('#password'), document.querySelector('#caps-lock-warning'));

		if ($('#content #username').val()) {
			$('#content #password').val('').focus();
		} else {
			$('#content #username').focus();
		}
		$('#content #noscript').val('false');
	};

	Login.capsLockCheck = (inputEl, warningEl) => {
		const toggle = (state) => {
			warningEl.classList[state ? 'remove' : 'add']('hidden');
			warningEl.parentNode.classList[state ? 'add' : 'remove']('has-warning');
		};
		if (!inputEl) {
			return;
		}
		inputEl.addEventListener('keyup', function (e) {
			if (Login._capsState && e.key === 'CapsLock') {
				toggle(false);
				Login._capsState = !Login._capsState;
				return;
			}
			Login._capsState = e.getModifierState && e.getModifierState('CapsLock');
			toggle(Login._capsState);
		});

		if (Login._capsState) {
			toggle(true);
		}
	};

	function bindSubmitHandler({ formEl, submitEl, errorEl }) {
		submitEl.on('click', async function (e) {
			e.preventDefault();

			const username = $('#username').val();
			const password = $('#password').val();

			clearError(errorEl);

			if (!isFilled(username, password)) {
				showError(errorEl, '[[error:invalid-username-or-password]]');
				return;
			}

			if (isDisabled(submitEl)) {
				return;
			}
			setDisabled(submitEl, true);

			try {
				const hookData = await hooks.fire('filter:app.login', {
					username,
					password,
					cancel: false,
				});
				if (hookData.cancel) {
					setDisabled(submitEl, false);
					return;
				}
			} catch (err) {
				showError(errorEl, err.message);
				setDisabled(submitEl, false);
				return;
			}

			hooks.fire('action:app.login');
			formEl.ajaxSubmit({
				headers: { 'x-csrf-token': config.csrf_token },
				beforeSend: function () {
					app.flags._login = true;
				},
				success: handleSuccessRedirect,
				error: function (data) {
					handleAjaxError({ data, errorEl, submitEl });
				},
			});
		});
	}

	function isFilled(username, password) {
		return Boolean(username && password);
	}

	function isDisabled($el) {
		return $el.hasClass('disabled');
	}

	function setDisabled($el, state) {
		$el.toggleClass('disabled', !!state);
	}

	function clearError($errorEl) {
		$errorEl.addClass('hidden').find('p').text('');
	}

	function showError($errorEl, message) {
		$errorEl.find('p').translateText(message);
		$errorEl.removeClass('hidden');
	}

	function handleSuccessRedirect(data) {
		hooks.fire('action:app.loggedIn', data);
		const pathname = utils.urlToLocation(data.next).pathname;
		const params = utils.params({ url: data.next });
		params.loggedin = true;
		delete params.register; // clear register message incase it exists
		const qs = $.param(params);
		window.location.href = pathname + '?' + qs;
	}

	function handleAjaxError({ data, errorEl, submitEl }) {
		let message = data.responseText;
		const errInfo = data.responseJSON;

		if (data.status === 403 && data.responseText === 'Forbidden') {
			window.location.href = config.relative_path + '/login?error=csrf-invalid';
			return;
		}

		if (errInfo && Object.prototype.hasOwnProperty.call(errInfo, 'banned_until')) {
			message = errInfo.banned_until ?
				translator.compile(
					'error:user-banned-reason-until',
					(new Date(errInfo.banned_until).toLocaleString()),
					errInfo.reason
				) :
				'[[error:user-banned-reason, ' + errInfo.reason + ']]';
		}

		showError(errorEl, message);
		setDisabled(submitEl, false);

		// Select the entire password if that field has focus
		if ($('#password:focus').length) {
			$('#password').select();
		}
	}


	return Login;
});
