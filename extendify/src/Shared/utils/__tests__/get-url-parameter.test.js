import { getUrlParameter } from '@shared/utils/get-url-parameter';

describe('getUrlParameter', () => {
	beforeEach(() => {
		jest.restoreAllMocks();
		window.history.pushState({}, '', '/');
	});

	it('should return null if parameter does not exist', () => {
		window.history.pushState({}, '', '/?param1=value1');
		expect(getUrlParameter('param2')).toBeNull();
	});

	it('should return the correct parameter value from URL', () => {
		window.history.pushState({}, '', '/?param1=value1&param2=value2');
		expect(getUrlParameter('param1')).toBe('value1');
		expect(getUrlParameter('param2')).toBe('value2');
	});

	it('should cleanup the parameter in url after use', () => {
		window.history.pushState({}, '', '/?param1=Hello%20World');
		const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

		getUrlParameter('param1');

		expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, '/');
	});

	it('should NOT cleanup the parameter in url if cleanUrl is false', () => {
		window.history.pushState({}, '', '/?param1=Hello%20World');
		const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

		getUrlParameter('param1', false);

		expect(replaceStateSpy).not.toHaveBeenCalled();
	});

	it('should NOT affect other parameters in url when cleanup', () => {
		window.history.pushState({}, '', '/?param1=Hello%20World&other=keep-it');
		const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

		getUrlParameter('param1');

		expect(replaceStateSpy).toHaveBeenCalledWith(
			{},
			document.title,
			'/?other=keep-it',
		);
	});
});
