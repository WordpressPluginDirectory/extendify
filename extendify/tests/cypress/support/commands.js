import { login } from './login-logout';
import { visitAdminPage, visitToLoginPage } from './navigate-pages';

Cypress.Commands.add('visitLoginPage', (query) => visitToLoginPage(query));
Cypress.Commands.add('visitAdminPage', (path, query, options) =>
	visitAdminPage(path, query, options),
);
Cypress.Commands.add('loginUser', (username, password) =>
	login(username, password),
);
