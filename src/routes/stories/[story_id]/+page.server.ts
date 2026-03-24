import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { supabase } = locals;

	// Fetch public story (no auth required — RLS allows anon read of public stories)
	const { data: story, error: storyError } = await supabase
		.from('stories')
		.select('*, game_sessions(*, games(*), characters(*))')
		.eq('story_id', params.story_id)
		.eq('is_public', true)
		.single();

	if (storyError || !story) {
		error(404, 'Story not found or is not public');
	}

	const gameSession = story.game_sessions as any;

	// Fetch segments
	const { data: segments } = await supabase
		.from('story_segments')
		.select('*')
		.eq('session_id', gameSession.id)
		.order('segment_order');

	// Fetch cards for the game
	const { data: cards } = await supabase
		.from('cards')
		.select('id, title, prompt, type')
		.eq('game_id', gameSession.game_id);

	// Build used cards in segment order
	type CardRow = { id: number; title: string | null; prompt: string | null; type: string | null };
	const usedCards = (segments ?? [])
		.filter((s) => s.card_id)
		.map((s) => ({
			card: (cards ?? []).find((c: CardRow) => c.id === s.card_id) as CardRow | undefined,
			hero_step: s.hero_step,
			segment_type: s.segment_type
		}))
		.filter((item): item is { card: CardRow; hero_step: typeof item.hero_step; segment_type: typeof item.segment_type } => item.card !== undefined);

	return {
		story,
		segments: segments ?? [],
		usedCards,
		gameName: gameSession.games?.title ?? 'Unknown Game',
		gameId: gameSession.games?.game_id ?? null,
		characterName: gameSession.character_name ?? 'Unknown Character',
		character: gameSession.characters ?? null
	};
};
