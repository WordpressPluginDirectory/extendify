import { Icon, undo } from '@wordpress/icons';
import { useRouter } from '@help-center/hooks/useRouter';
import { useKnowledgeBaseStore } from '@help-center/state/knowledge-base.js';

export const ArticlesList = ({ articles }) => {
	const { pushArticle } = useKnowledgeBaseStore();
	const { navigateTo } = useRouter();

	return (
		<ul
			className="m-0 py-2 flex flex-col gap-1"
			data-test="help-center-kb-articles-list">
			{articles.map(({ slug, title }) => (
				<li key={slug} className="m-0 py-1 pr-3 pl-2">
					<button
						type="button"
						className="text-sm bg-transparent text-gray-800 flex gap-2 hover:underline hover:underline-offset-4 cursor-pointer"
						onClick={() => {
							pushArticle({ slug, title });
							navigateTo('knowledge-base-article');
						}}>
						<Icon
							size={20}
							icon={undo}
							className="fill-gray-700 transform rotate-180"
						/>
						{title}
					</button>
				</li>
			))}
		</ul>
	);
};
