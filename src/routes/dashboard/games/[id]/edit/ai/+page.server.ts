import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { aiCompanionSchema, type AICompanionFormData } from '$lib/zod/schema';
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

    // Fetch existing AI companion config
    const { data: aiConfig, error: aiConfigError } = await supabase
        .from('ai_companion_configs')
        .select('*')
        .eq('game_id', game.id)
        .single();

    if (aiConfigError && aiConfigError.code !== 'PGRST116') {
        console.error('Error fetching AI config:', aiConfigError);
    }

    // Prepare data for form
    const formData = aiConfig ? {
        id: aiConfig.id,
        name: aiConfig.name || 'Sage',
        avatar_url: aiConfig.avatar_url || '',
        tone: aiConfig.tone as AICompanionFormData['tone'],
        personality: aiConfig.personality as AICompanionFormData['personality'],
        relationship: aiConfig.relationship as AICompanionFormData['relationship'],
        humor_level: aiConfig.humor_level || 0,
        formality: aiConfig.formality || 1,
        additional_context: aiConfig.additional_context || ''
    } : {
        name: 'Sage',
        tone: 'calm' as const,
        personality: 'mentor' as const,
        relationship: 'guide' as const,
        humor_level: 0,
        formality: 1
    };

    const form = await superValidate(formData, zod4(aiCompanionSchema));

    return {
        form,
        aiConfig: aiConfig || null,
        gameId: game.id
    };
};

function generateSystemPrompt(data: AICompanionFormData): string {
    const toneDescriptions: Record<string, string> = {
        enthusiastic: 'enthusiastic and energetic',
        calm: 'calm and measured',
        mysterious: 'mysterious and enigmatic',
        professional: 'professional and formal',
        playful: 'playful and lighthearted',
        serious: 'serious and thoughtful'
    };

    const personalityDescriptions: Record<string, string> = {
        mentor: 'a wise mentor who provides guidance and knowledge',
        friend: 'a supportive friend who accompanies the player',
        sage: 'an ancient sage with deep wisdom',
        explorer: 'an adventurous explorer eager to discover',
        historian: 'a knowledgeable historian sharing stories',
        storyteller: 'a captivating storyteller weaving narratives'
    };

    const relationshipDescriptions: Record<string, string> = {
        guide: 'You are their guide through this journey',
        companion: 'You are their trusted companion',
        rival: 'You are their friendly rival, challenging them',
        'mysterious-ally': 'You are a mysterious ally with hidden knowledge'
    };

    const humorLevels = ['serious with no humor', 'occasional subtle humor', 'frequent playful humor'];
    const formalityLevels = ['casual and informal', 'balanced tone', 'formal and respectful'];

    const systemPrompt = `You are ${data.name}, ${personalityDescriptions[data.personality] || 'a helpful companion'}.

Your communication style is ${toneDescriptions[data.tone] || 'balanced'}, with ${formalityLevels[data.formality] || 'a balanced tone'}. ${relationshipDescriptions[data.relationship] || 'You assist the player'}.

Communication Guidelines:
- Humor level: ${humorLevels[data.humor_level] || 'balanced'}
- Keep responses concise and engaging
- Adapt to the player's emotional state
- Reference the game's location, characters, and story when relevant
- Guide players through their hero's journey with wisdom and encouragement

${data.additional_context ? `\nAdditional Context:\n${data.additional_context}` : ''}

Remember: You're part of an immersive location-based storytelling experience. Help players connect with their surroundings and their inner journey.`;

    return systemPrompt;
}

export const actions = {
    save: async ({ request, params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod4(aiCompanionSchema));

        if (!form.valid) {
            console.error('Form validation errors:', form.errors);
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

        // Generate system prompt
        const systemPrompt = generateSystemPrompt(form.data);

        // Check if config exists
        const { data: existingConfig } = await supabase
            .from('ai_companion_configs')
            .select('id')
            .eq('game_id', game.id)
            .single();

        if (existingConfig) {
            // Update existing config
            const { error: updateError } = await supabase
                .from('ai_companion_configs')
                .update({
                    name: form.data.name,
                    avatar_url: form.data.avatar_url,
                    tone: form.data.tone,
                    personality: form.data.personality,
                    relationship: form.data.relationship,
                    humor_level: form.data.humor_level,
                    formality: form.data.formality,
                    additional_context: form.data.additional_context,
                    system_prompt: systemPrompt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingConfig.id);

            if (updateError) {
                console.error('Error updating AI config:', updateError);
                return fail(500, { form, message: 'Failed to update AI companion: ' + updateError.message });
            }
        } else {
            // Insert new config
            const { error: insertError } = await supabase
                .from('ai_companion_configs')
                .insert({
                    game_id: game.id,
                    name: form.data.name,
                    avatar_url: form.data.avatar_url,
                    tone: form.data.tone,
                    personality: form.data.personality,
                    relationship: form.data.relationship,
                    humor_level: form.data.humor_level,
                    formality: form.data.formality,
                    additional_context: form.data.additional_context,
                    system_prompt: systemPrompt
                });

            if (insertError) {
                console.error('Error creating AI config:', insertError);
                return fail(500, { form, message: 'Failed to create AI companion: ' + insertError.message });
            }
        }

        return { form, success: true };
    }
} satisfies Actions;
