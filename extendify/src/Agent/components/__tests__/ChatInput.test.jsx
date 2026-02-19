import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

jest.mock('@agent/state/global', () => ({
	useGlobalStore: () => ({ isMobile: false }),
}));
jest.mock('@agent/state/workflows', () => ({
	useWorkflowStore: () => ({
		getWorkflowsByFeature: () => [],
		block: null,
	}),
}));
jest.mock('@agent/components/ChatTools', () => ({
	ChatTools: () => null,
	__esModule: true,
}));

beforeAll(() => {
	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
		configurable: true,
		get() {
			if (this.id === 'extendify-agent-chat') return 600;
			return 100;
		},
	});
});

describe('ChatInput — input limit', () => {
	const setup = (props = {}) => {
		const handleSubmit = jest.fn();
		render(
			<div id="extendify-agent-chat">
				<ChatInput disabled={false} handleSubmit={handleSubmit} {...props} />
			</div>,
		);
		const textarea = screen.getByRole('textbox');
		const sendBtn = screen.getByRole('button', { name: /send message/i });
		const user = userEvent.setup();
		return { textarea, sendBtn, handleSubmit, user };
	};

	test('disables sending and shows a warning when exceeding 1500 chars', async () => {
		const { textarea, sendBtn, handleSubmit, user } = setup();

		const longText = 'x'.repeat(1501);
		await user.type(textarea, longText);

		expect(screen.getByText(/message too long/i)).toBeInTheDocument();
		expect(sendBtn).toBeDisabled();

		await user.type(textarea, '{enter}');
		expect(handleSubmit).not.toHaveBeenCalled();
	});

	test('sends normally when below the limit', async () => {
		const { textarea, sendBtn, handleSubmit, user } = setup();

		await user.type(textarea, 'hello world');
		expect(sendBtn).toBeEnabled();

		await user.click(sendBtn);
		expect(handleSubmit).toHaveBeenCalledWith('hello world');
	});

	test('pressing Enter sends when within the limit', async () => {
		const { textarea, handleSubmit, user } = setup();

		await user.type(textarea, 'short message{enter}');
		expect(handleSubmit).toHaveBeenCalledWith('short message');
	});
});
