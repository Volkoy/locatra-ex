import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const HERO_STEP_LABELS: Record<string, string> = {
	call_to_adventure: 'Call to Adventure',
	crossing_the_threshold: 'Crossing the Threshold',
	meeting_the_mentor: 'Meeting the Mentor',
	trials_and_growth: 'Trials & Growth',
	death_and_transformation: 'Death & Transformation',
	change_and_return: 'Change & Return'
};

const SEGMENT_TYPE_LABELS: Record<string, string> = {
	introduction: 'Introduction',
	deepening: 'Deepening',
	reflection: 'Reflection'
};

export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.getSession();
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const sessionId = url.searchParams.get('sessionId');
	if (!sessionId) return json({ error: 'Missing sessionId' }, { status: 400 });

	const { supabase } = locals;

	const { data: gameSession } = await supabase
		.from('game_sessions')
		.select('id, game_id, player_id, character_name, character_id, characters(name, summary)')
		.eq('session_id', sessionId)
		.single();

	if (!gameSession || gameSession.player_id !== session.user.id) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const [{ data: game }, { data: characters }, { data: pois }, { data: segments }] =
		await Promise.all([
			supabase.from('games').select('title, description').eq('id', gameSession.game_id).single(),
			supabase.from('characters').select('name, summary, category').eq('game_id', gameSession.game_id),
			supabase.from('pois').select('name, description, contextual_data, type').eq('game_id', gameSession.game_id),
			supabase
				.from('story_segments')
				.select('segment_type, hero_step, content, card_id')
				.eq('session_id', gameSession.id)
				.order('segment_order')
		]);

	const drawnCardIds = (segments ?? [])
		.map((s) => s.card_id)
		.filter((id): id is number => id !== null);
	const { data: drawnCards } =
		drawnCardIds.length > 0
			? await supabase.from('cards').select('id, title, prompt').in('id', drawnCardIds)
			: { data: [] };
	const cardMap = new Map((drawnCards ?? []).map((c) => [c.id, c]));

	const characterDetails = gameSession.characters as { name: string; summary: string | null } | null;
	const playerLabel = characterDetails?.name
		? `${gameSession.character_name} (playing as ${characterDetails.name})`
		: (gameSession.character_name ?? 'Player');

	let context = `PLAYER: ${playerLabel}\n\n`;

	if (game) {
		context += `GAME: "${game.title}"`;
		if (game.description) context += `\n${game.description}`;
		context += '\n\n';
	}

	if (characters && characters.length > 0) {
		context += `CHARACTERS:\n${characters.map((c) => `- ${c.name} (${c.category})${c.summary ? ': ' + c.summary : ''}`).join('\n')}\n\n`;
	}

	if (pois && pois.length > 0) {
		context += `LOCATIONS (only these are real — never reference or invent other places):\n${pois
			.map((p) => {
				let entry = `- ${p.name}`;
				if (p.type) entry += ` [${p.type}]`;
				if (p.description) entry += `: ${p.description}`;
				if (p.contextual_data) entry += ` (${p.contextual_data})`;
				return entry;
			})
			.join('\n')}\n\n`;
	}

	if (segments && segments.length > 0) {
		context += `STORY WRITTEN SO FAR:\n${segments
			.map((s) => {
				const label = s.hero_step
					? (HERO_STEP_LABELS[s.hero_step] ?? s.hero_step)
					: (SEGMENT_TYPE_LABELS[s.segment_type] ?? s.segment_type);
				const card = s.card_id ? cardMap.get(s.card_id) : null;
				let entry = `[${label}]`;
				if (card?.prompt)
					entry += `\nCard prompt: "${card.title ? card.title + ' — ' : ''}${card.prompt}"`;
				entry += `\nPlayer wrote: ${s.content}`;
				return entry;
			})
			.join('\n\n')}`;
	}

	return json({ context });
};
