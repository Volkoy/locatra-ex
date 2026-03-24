import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { supabase } = locals;
	const session = await locals.getSession();

	if (!session) {
		redirect(302, `/play/${params.game_id}`);
	}

	// Fetch published game
	const { data: game, error: gameError } = await supabase
		.from('games')
		.select('*')
		.eq('game_id', params.game_id)
		.eq('status', 'published')
		.eq('visibility', 'public')
		.single();

	if (gameError || !game) {
		error(404, 'Game not found');
	}

	// Fetch characters for this game
	const { data: characters } = await supabase
		.from('characters')
		.select('*')
		.eq('game_id', game.id)
		.order('created_at');

	const playMode = url.searchParams.get('mode') ?? 'gps';

	return {
		game,
		characters: characters ?? [],
		playMode
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const session = await locals.getSession();

		if (!session) {
			return fail(401, { message: 'Unauthorized' });
		}

		const form = await request.formData();
		const character_id = form.get('character_id');
		const character_name = (form.get('character_name') as string)?.trim();
		const play_mode = (form.get('play_mode') as string) ?? 'gps';

		if (!character_id) {
			return fail(400, { message: 'Please select a character' });
		}

		if (!character_name) {
			return fail(400, { message: 'Please enter a character name' });
		}

		// Get the game internal id
		const { data: game } = await supabase
			.from('games')
			.select('id')
			.eq('game_id', params.game_id)
			.eq('status', 'published')
			.eq('visibility', 'public')
			.single();

		if (!game) {
			return fail(404, { message: 'Game not found' });
		}

		// Create game session
		const { data: newSession, error: insertError } = await supabase
			.from('game_sessions')
			.insert({
				player_id: session.user.id,
				game_id: game.id,
				character_id: character_id as string,
				character_name,
				play_mode: play_mode as 'gps' | 'remote',
				status: 'setup'
			})
			.select('session_id')
			.single();

		if (insertError || !newSession) {
			console.error('Error creating game session:', insertError);
			return fail(500, { message: 'Failed to start game session' });
		}

		redirect(302, `/play/${params.game_id}/session/${newSession.session_id}`);
	}
};
