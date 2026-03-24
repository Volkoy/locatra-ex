import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { supabase } = locals;

	const { data: game } = await supabase
		.from('games')
		.select('id, title')
		.eq('game_id', params.game_id)
		.single();

	if (!game) error(404, 'Game not found');

	const { data: stories } = await supabase
		.from('stories')
		.select(
			'story_id, title, created_at, game_sessions!inner(id, character_name, game_id, characters(name, image_url, bg_color, text_color))'
		)
		.eq('is_public', true)
		.eq('game_sessions.game_id', game.id)
		.order('created_at', { ascending: false });

	const sessionIds = (stories ?? [])
		.map((s: any) => s.game_sessions?.id)
		.filter((id: any) => id != null);

	const { data: excerptSegments } = sessionIds.length
		? await supabase
				.from('story_segments')
				.select('session_id, content, segment_order')
				.in('session_id', sessionIds)
				.order('segment_order', { ascending: true })
		: { data: [] };

	const excerptMap: Record<number, string> = {};
	for (const seg of excerptSegments ?? []) {
		if (!excerptMap[seg.session_id]) excerptMap[seg.session_id] = seg.content;
	}

	return {
		game,
		game_id: params.game_id,
		stories: (stories ?? []).map((s: any) => ({
			story_id: s.story_id,
			title: s.title,
			created_at: s.created_at,
			character_name: s.game_sessions.character_name,
			character: s.game_sessions.characters,
			excerpt: excerptMap[s.game_sessions.id] ?? ''
		}))
	};
};
