import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { poiSchema } from '$lib/zod/schema';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
    const { session } = await safeGetSession();
    
    if (!session) {
        throw redirect(303, '/auth');
    }

    // Verify game ownership
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id, game_id, location')
        .eq('game_id', params.id)
        .eq('owner_id', session.user.id)
        .single();

    if (gameError || !game) {
        throw redirect(303, '/dashboard');
    }

    // Use RPC function to get game location coordinates
    let center = { lng: 0, lat: 0 };
    if (game.id) {
        const { data: locationResult } = await supabase
            .rpc('get_game_location', { game_id_param: game.id });
        
        if (locationResult && typeof locationResult === 'object') {
            const coords = locationResult as { longitude: number; latitude: number };
            center = { lng: coords.longitude, lat: coords.latitude };
        }
    }

    // Use RPC function to get POIs with coordinates
    const { data: pois, error: poisError } = await supabase
        .rpc('get_game_pois_with_location', { game_id_param: game.id });

    if (poisError) {
        console.error('Error fetching POIs:', poisError);
    }

    const form = await superValidate(zod4(poiSchema));

    return {
        form,
        pois: pois || [],
        gameId: game.id,
        center
    };
};

export const actions = {
    create: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(poiSchema));

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

        const locationWKT = form.data.latitude && form.data.longitude 
                    ? `SRID=4326;POINT(${form.data.longitude} ${form.data.latitude})`
                    : null;

        const { error: insertError } = await supabase
            .from('pois')
            .insert({
                game_id: game.id,
                name: form.data.name,
                description: form.data.description,
                contextual_data: form.data.contextual_data,
                image_url: form.data.image_url || null,
                location: locationWKT,
                type: form.data.type,
                tags: form.data.tags,
            });

        if (insertError) {
            console.error('Error creating POI:', insertError);
            return fail(500, { form, message: 'Failed to create POI: ' + insertError.message });
        }

        return { form, success: true };
    },

    update: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(poiSchema));

        if (!form.valid) {
            return fail(400, { form });
        }

        if (!form.data.id) {
            return fail(400, { form, message: 'POI ID is required' });
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

        // Create PostGIS POINT
        const locationPoint = `POINT(${form.data.longitude} ${form.data.latitude})`;

        const { error: updateError } = await supabase
            .from('pois')
            .update({
                name: form.data.name,
                description: form.data.description,
                contextual_data: form.data.contextual_data,
                image_url: form.data.image_url || null,
                location: `SRID=4326;${locationPoint}`,
                type: form.data.type,
                tags: form.data.tags
            })
            .eq('id', form.data.id)
            .eq('game_id', game.id);

        if (updateError) {
            console.error('Error updating POI:', updateError);
            return fail(500, { form, message: 'Failed to update POI: ' + updateError.message });
        }

        return { form, success: true };
    },

    delete: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const poiId = formData.get('poiId');

        if (!poiId || isNaN(Number(poiId))) {
            return fail(400, { message: 'Valid POI ID is required' });
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

        // Get POI to delete image
        const { data: poi } = await supabase
            .from('pois')
            .select('image_url')
            .eq('id', Number(poiId))
            .eq('game_id', game.id)
            .single();

        // Delete POI image from storage if exists
        if (poi?.image_url) {
            try {
                const urlWithoutParams = poi.image_url.split('?')[0];
                const url = new URL(urlWithoutParams);
                const pathParts = url.pathname.split('/');
                const imagePath = pathParts.slice(-4).join('/'); // user_id/game_id/pois/filename
                await supabase.storage.from('game-images').remove([imagePath]);
            } catch (error) {
                console.warn('Error deleting POI image:', error);
            }
        }

        // Delete POI from database
        const { error } = await supabase
            .from('pois')
            .delete()
            .eq('id', Number(poiId))
            .eq('game_id', game.id);

        if (error) {
            console.error('Error deleting POI:', error);
            return fail(500, { message: 'Failed to delete POI: ' + error.message });
        }

        return { success: true };
    }
} satisfies Actions;