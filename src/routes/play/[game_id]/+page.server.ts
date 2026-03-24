import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { supabase } = locals;

	// Fetch published + public game by game_id UUID
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

	// Get game location coordinates
	let longitude = 0;
	let latitude = 0;
	const { data: locationResult } = await supabase.rpc('get_game_location', {
		game_id_param: game.id
	});
	if (locationResult && typeof locationResult === 'object') {
		const coords = locationResult as { longitude: number; latitude: number };
		longitude = coords.longitude;
		latitude = coords.latitude;
	}

	// Count POIs
	const { count: poiCount } = await supabase
		.from('pois')
		.select('id', { count: 'exact', head: true })
		.eq('game_id', game.id);

	// Count characters
	const { count: characterCount } = await supabase
		.from('characters')
		.select('id', { count: 'exact', head: true })
		.eq('game_id', game.id);

	return {
		game,
		longitude,
		latitude,
		poiCount: poiCount ?? 0,
		characterCount: characterCount ?? 0
	};
};
