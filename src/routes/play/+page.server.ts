import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { supabase } = locals;

	// Fetch published games with distance from origin (0,0) as fallback.
	// Client will re-sort once geolocation resolves.
	const { data: games, error } = await supabase.rpc('get_published_games_with_distance', {
		user_lng: 0,
		user_lat: 0
	});

	if (error) {
		console.error('Error fetching published games:', error);
	}

	return {
		games: games ?? []
	};
};
