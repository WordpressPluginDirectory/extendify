export const visitToLoginPage = (query = '') => {
	const question = query.startsWith('?') ? '' : '?';
	cy.visit(`wp-login.php${question}${query}`);
};

export const visitAdminPage = (adminPath = '', query = '', options = {}) => {
	const question = query.startsWith('?') ? '' : '?';
	cy.visit(`wp-admin/${adminPath}${question}${query}`, options);
};
