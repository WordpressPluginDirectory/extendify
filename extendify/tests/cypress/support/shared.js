// Escape single quotes in JSON string to prevent CLI command issues
export const safeJsonStringify = (state) =>
	JSON.stringify(state).replace(/'/g, "'\\''");
