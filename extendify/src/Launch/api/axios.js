import axios from 'axios';

const Axios = axios.create({
	baseURL: window.extSharedData.root,
	headers: {
		'X-WP-Nonce': window.extSharedData.nonce,
		'X-Requested-With': 'XMLHttpRequest',
		'X-Extendify-Launch': true,
		'X-Extendify': true,
	},
});

Axios.interceptors.request.use(
	(request) => checkDevMode(request),
	(error) => error,
);
Axios.interceptors.response.use(
	(response) => findResponse(response),
	(error) => handleErrors(error),
);

const findResponse = (response) => {
	return Object.prototype.hasOwnProperty.call(response, 'data')
		? response.data
		: response;
};

const handleErrors = (error) => {
	if (!error.response) {
		return;
	}
	console.error(error.response);
	// if 4XX, return the error object
	if (error.response.status >= 400 && error.response.status < 500) {
		return Promise.reject(error.response);
	}
	return Promise.reject(findResponse(error.response));
};

const checkDevMode = (request) => {
	request.headers['X-Extendify-Launch-Dev-Mode'] =
		window.location.search.indexOf('DEVMODE') > -1;
	request.headers['X-Extendify-Launch-Local-Mode'] =
		window.location.search.indexOf('LOCALMODE') > -1;
	return request;
};

export { Axios };
