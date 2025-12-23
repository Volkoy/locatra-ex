import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

export const actions = {
    default: async ({ locals: { supabase, safeGetSession } }) => {
        const {session} = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }


        // Create a new draft game with minimal required fields
        const { data: newGame, error } = await supabase
            .from('games')
            .insert({
                owner_id: session.user.id,
                status: 'draft',
                visibility: 'private'
            })
            .select('game_id')
            .single();

        if (error) {
            console.error('Error creating game:', error);
            return fail(500, { message: 'Failed to create game' });
        }

        // Redirect to the general info page for the newly created game
        throw redirect(303, `/dashboard/games/${newGame.game_id}/edit/general`);
    }
} satisfies Actions;