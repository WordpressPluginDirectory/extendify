import classNames from 'classnames';
import { CheckboxInput } from '@launch/components/CheckboxInput';
import { PreviewIcon } from '@launch/svg';

export const PageSelectButton = ({
	page,
	previewing,
	onPreview,
	checked,
	onChange,
	forceChecked = false,
}) => (
	<div className="border border-gray-300 rounded flex items-center">
		<div
			className={classNames('grow text-gray-900 overflow-hidden', {
				'bg-gray-300': forceChecked,
			})}>
			<CheckboxInput
				label={page.name}
				slug={page.slug}
				checked={checked}
				onChange={onChange}
				locked={forceChecked}
			/>
		</div>

		<button
			type="button"
			className={classNames(
				'hidden lg:flex items-center h-full min-h-6 min-w-6 shrink py-3 px-4 border-l border-gray-300 cursor-pointer',
				{
					'bg-gray-100 text-gray-800': !previewing,
					'bg-design-main text-white': previewing,
				},
			)}
			onClick={onPreview}>
			<PreviewIcon className="h-6 w-6" />
		</button>
	</div>
);
