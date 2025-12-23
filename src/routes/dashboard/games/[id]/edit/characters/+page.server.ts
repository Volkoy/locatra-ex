import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { characterSchema } from '$lib/zod/schema';

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

    // Fetch existing characters
    const { data: characters, error: charactersError } = await supabase
        .from('characters')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });

    if (charactersError) {
        console.error('Error fetching characters:', charactersError);
    }

    // Initialize empty form for creating new character
    const form = await superValidate(zod4(characterSchema));

    return {
        form,
        characters: characters || [],
        gameId: game.id
    };
};

export const actions = {
    create: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(characterSchema));

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

        // Insert character
        const { error } = await supabase
            .from('characters')
            .insert({
                game_id: game.id,
                name: form.data.name,
                summary: form.data.summary,
                image_url: form.data.image_url || null,
                category: form.data.category
            });

        if (error) {
            console.error('Error creating character:', error);
            return fail(500, { form, message: 'Failed to create character' });
        }

        return { form, success: true };
    },

    update: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(characterSchema));

        if (!form.valid) {
            return fail(400, { form });
        }

        if (!form.data.id) {
            return fail(400, { form, message: 'Character ID is required' });
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

        // Update character
        const { error } = await supabase
            .from('characters')
            .update({
                name: form.data.name,
                summary: form.data.summary,
                image_url: form.data.image_url || null,
                category: form.data.category
            })
            .eq('id', form.data.id)
            .eq('game_id', game.id);

        if (error) {
            console.error('Error updating character:', error);
            return fail(500, { form, message: 'Failed to update character' });
        }

        return { form, success: true };
    },

    delete: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        // Get character ID directly from formData
        const formData = await request.formData();
        const characterId = formData.get('characterId');

        if (!characterId || isNaN(Number(characterId))) {
            return fail(400, { message: 'Valid character ID is required' });
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

        // Get character to delete image
        const { data: character } = await supabase
            .from('characters')
            .select('image_url')
            .eq('id', Number(characterId))
            .eq('game_id', game.id)
            .single();
        

        // Delete character image from storage if exists
        if (character?.image_url) {
            try {
                const urlWithoutParams = character.image_url.split('?')[0];
                const url = new URL(urlWithoutParams);
                const pathParts = url.pathname.split('/');
                const imagePath = pathParts.slice(-4).join('/'); // user_id/game_id/characters/filename
                console.log('Deleting character image at path:', imagePath);
                await supabase.storage.from('game-images').remove([imagePath]);
                console.log('Deleted character image:', imagePath);
            } catch (error) {
                console.warn('Error deleting character image:', error);
            }
        }

        // Delete character from database
        const { error } = await supabase
            .from('characters')
            .delete()
            .eq('id', Number(characterId))
            .eq('game_id', game.id);

        if (error) {
            console.error('Error deleting character:', error);
            return fail(500, { message: 'Failed to delete character' });
        }

        return { success: true };
    }
} satisfies Actions;