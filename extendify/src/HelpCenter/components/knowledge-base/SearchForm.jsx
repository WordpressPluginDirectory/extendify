import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { search as sIcon, Icon, closeSmall } from '@wordpress/icons';
import classNames from 'classnames';
import { useKnowledgeBaseStore } from '@help-center/state/knowledge-base.js';
import { KB_HOST } from '../../../constants';

export const SearchForm = ({ onChange }) => {
	const { searchTerm, clearSearchTerm, reset } = useKnowledgeBaseStore();
	const warmed = useRef(false);
	const searchRef = useRef();

	return (
		<form
			method="get"
			onSubmit={(e) => e.preventDefault()}
			className="relative w-full h-10">
			<label htmlFor="ext-help-center-search" className="sr-only">
				{__('Search for articles', 'extendify-local')}
			</label>
			<input
				ref={searchRef}
				name="ext-kb-search"
				autoFocus
				autoCapitalize="off"
				id="ext-help-center-search"
				type="text"
				value={searchTerm ?? ''}
				onChange={(e) => onChange(e.target.value)}
				onFocus={() => {
					if (warmed.current) return;
					warmed.current = true;
					fetch(`${KB_HOST}/api/posts?boot=true`, { method: 'POST' });
				}}
				placeholder={__('What do you need help with?', 'extendify-local')}
				className="input border border-text-800 w-full placeholder-gray-600 text-sm h-10 px-3"
			/>
			<div className="absolute right-2 text-gray-400 flex items-center justify-center inset-y-5">
				<Icon
					icon={!searchTerm ? sIcon : closeSmall}
					className={classNames('fill-current', {
						'cursor-pointer': searchTerm,
					})}
					onClick={() => {
						reset();
						clearSearchTerm();
						searchRef.current?.focus();
					}}
					size={24}
				/>
			</div>
		</form>
	);
};
