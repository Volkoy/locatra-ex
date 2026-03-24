import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { supabase } = locals;
	const session = await locals.getSession();

	if (!session) {
		redirect(302, `/play/${params.game_id}`);
	}

	const { data: gameSession } = await supabase
		.from('game_sessions')
		.select('*, games(*), characters(*)')
		.eq('session_id', params.session_id)
		.eq('player_id', session.user.id)
		.single();

	if (!gameSession) {
		error(403, 'Session not found or access denied');
	}

	if (gameSession.status !== 'completed') {
		redirect(302, `/play/${params.game_id}/session/${params.session_id}`);
	}

	// Fetch all segments ordered
	const { data: segments } = await supabase
		.from('story_segments')
		.select('*')
		.eq('session_id', gameSession.id)
		.order('segment_order');

	// Fetch cards for prompts
	const { data: cards } = await supabase
		.from('cards')
		.select('id, title, prompt')
		.eq('game_id', gameSession.game_id);

	// Fetch player profile
	const { data: playerProfile } = await supabase
		.from('profiles')
		.select('full_name, avatar_url')
		.eq('id', session.user.id)
		.maybeSingle();

	const playerName =
		playerProfile?.full_name ||
		(session.user.user_metadata?.full_name as string | undefined) ||
		(session.user.user_metadata?.name as string | undefined) ||
		session.user.email?.split('@')[0] ||
		null;

	// Fetch existing story if any
	const { data: story } = await supabase
		.from('stories')
		.select('*')
		.eq('session_id', gameSession.id)
		.maybeSingle();

	return {
		session: gameSession,
		segments: segments ?? [],
		cards: cards ?? [],
		playerName,
		story,
		game_id: params.game_id,
		session_id: params.session_id
	};
};

export const actions: Actions = {
	saveStory: async ({ request, params, locals }) => {
		const { supabase } = locals;
	const session = await locals.getSession();
		if (!session) return fail(401, { message: 'Unauthorized' });

		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const is_public = form.get('is_public') === 'true';

		if (!title) return fail(400, { message: 'Story title is required' });

		const { data: gameSession } = await supabase
			.from('game_sessions')
			.select('id')
			.eq('session_id', params.session_id)
			.eq('player_id', session.user.id)
			.single();

		if (!gameSession) return fail(403, { message: 'Session not found' });

		// Upsert story
		const { data: story, error: upsertError } = await supabase
			.from('stories')
			.upsert(
				{ session_id: gameSession.id, title, is_public },
				{ onConflict: 'session_id' }
			)
			.select('story_id')
			.single();

		if (upsertError || !story) {
			console.error('Error saving story:', upsertError);
			return fail(500, { message: 'Failed to save story' });
		}

		return { story_id: story.story_id };
	}
};
