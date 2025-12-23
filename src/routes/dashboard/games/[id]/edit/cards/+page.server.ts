import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { cardSchema } from '$lib/zod/schema';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
    const { session } = await safeGetSession();
    
    if (!session) {
        throw redirect(303, '/auth');
    }

    // Verify game ownership
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id, game_id')
        .eq('game_id', params.id)
        .eq('owner_id', session.user.id)
        .single();

    if (gameError || !game) {
        throw redirect(303, '/dashboard');
    }

    // Fetch cards for this game
    const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });

    if (cardsError) {
        console.error('Error fetching cards:', cardsError);
    }

    // Fetch POIs for this game
    const { data: pois, error: poisError } = await supabase
        .from('pois')
        .select('id, name')
        .eq('game_id', game.id)
        .order('name', { ascending: true });

    if (poisError) {
        console.error('Error fetching POIs:', poisError);
    }

    const form = await superValidate(zod4(cardSchema));

    return {
        form,
        cards: cards || [],
        pois: pois || [],
        gameId: game.id
    };
};

export const actions = {
    create: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(cardSchema));

        if (!form.valid) {
            return fail(400, { form });
        }

        // Get game internal ID
        const { data: game } = await supabase
            .from('games')
            .select('id')
            .eq('game_id', params.id)
            .eq('owner_id', session.user.id)
            .single();

        if (!game) {
            return fail(403, { form, message: 'Game not found' });
        }

        const { error: insertError } = await supabase
            .from('cards')
            .insert({
                game_id: game.id,
                title: form.data.title,
                prompt: form.data.prompt,
                type: form.data.type,
                hero_steps: form.data.hero_steps,
                character_category: form.data.character_category,
                card_category: form.data.card_category,
                keywords: form.data.card_category === 'general' ? form.data.keywords : null,
                poi_id: form.data.card_category === 'poi_specific' ? form.data.poi_id : null
            });

        if (insertError) {
            console.error('Error creating card:', insertError);
            return fail(500, { form, message: 'Failed to create card: ' + insertError.message });
        }

        return { form, success: true };
    },

    update: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(cardSchema));

        if (!form.valid) {
            return fail(400, { form });
        }

        if (!form.data.id) {
            return fail(400, { form, message: 'Card ID is required' });
        }

        // Verify ownership through game
        const { data: game } = await supabase
            .from('games')
            .select('id')
            .eq('game_id', params.id)
            .eq('owner_id', session.user.id)
            .single();

        if (!game) {
            return fail(403, { form, message: 'Game not found' });
        }

        const { error: updateError } = await supabase
            .from('cards')
            .update({
                title: form.data.title,
                prompt: form.data.prompt,
                type: form.data.type,
                hero_steps: form.data.hero_steps,
                character_category: form.data.character_category,
                card_category: form.data.card_category,
                keywords: form.data.card_category === 'general' ? form.data.keywords : null,
                poi_id: form.data.card_category === 'poi_specific' ? form.data.poi_id : null,
                updated_at: new Date().toISOString()
            })
            .eq('id', form.data.id)
            .eq('game_id', game.id);

        if (updateError) {
            console.error('Error updating card:', updateError);
            return fail(500, { form, message: 'Failed to update card: ' + updateError.message });
        }

        return { form, success: true };
    },

    delete: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const cardId = formData.get('cardId');

        if (!cardId || isNaN(Number(cardId))) {
            return fail(400, { message: 'Valid card ID is required' });
        }

        // Verify ownership through game
        const { data: game } = await supabase
            .from('games')
            .select('id')
            .eq('game_id', params.id)
            .eq('owner_id', session.user.id)
            .single();

        if (!game) {
            return fail(403, { message: 'Game not found' });
        }

        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', Number(cardId))
            .eq('game_id', game.id);

        if (error) {
            console.error('Error deleting card:', error);
            return fail(500, { message: 'Failed to delete card: ' + error.message });
        }

        return { success: true };
    }
} satisfies Actions;