import { processPlaceholders } from '@page-creator/api/WPApi';

export const processPatterns = async (patterns) => {
	const maxAttempts = 3;
	const delay = 1000; // 1 second delay between retries

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await processPlaceholders(patterns);
		} catch (error) {
			if (attempt === maxAttempts) {
				console.error(
					`Failed to process patterns after ${maxAttempts} attempts:`,
					error,
				);
				return patterns;
			}
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
};
