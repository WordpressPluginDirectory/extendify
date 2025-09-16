import apiFetch from '@wordpress/api-fetch';
import { allowedSettings } from '@agent/workflows/settings/edit-wp-setting';

export default async ({ settingName }) => {
	if (!allowedSettings.includes(settingName)) {
		throw new Error('Setting not allowed');
	}
	const response = await apiFetch({
		path: '/wp/v2/settings?context=edit',
	});

	return { oldSettingValue: response[settingName] };
};
