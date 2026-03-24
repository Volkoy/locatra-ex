import { fail } from "@sveltejs/kit";
import { redirect } from "sveltekit-flash-message/server";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { generalInfoSchema } from "$lib/zod/schema";

export const load: PageServerLoad = async (
    { parent, locals: { supabase } },
) => {
    // Get game data from parent layout instead of reloading it
    const { game } = await parent();

    // Use RPC function to get location coordinates from PostGIS
    let locationData = null;
    if (game.id) {
        const { data: locationResult } = await supabase
            .rpc("get_game_location", { game_id_param: game.id });

        if (locationResult && typeof locationResult === "object") {
            const coords = locationResult as {
                longitude: number;
                latitude: number;
            };
            locationData = {
                lng: coords.longitude,
                lat: coords.latitude,
            };
        }
    }

    // Initialize form with game data
    const form = await superValidate(
        {
            title: game.title || "",
            description: game.description || "",
            location: locationData,
            cover_image_url: game.image_url || "",
            categories: game.categories || [],
        },
        zod4(generalInfoSchema),
        { errors: false },
    );

    return { form };
};

export const actions = {
    default: async (
        { request, params, locals: { supabase, getSession } },
    ) => {
        const session = await getSession();

        if (!session) {
            return fail(401, { message: "Unauthorized" });
        }

        const form = await superValidate(request, zod4(generalInfoSchema));

        if (!form.valid) {
            return fail(400, { form, message: "Please check your form data." });
        }

        const locationWKT = form.data.location
            ? `SRID=4326;POINT(${form.data.location.lng} ${form.data.location.lat})`
            : null;

        const { error: updateError } = await supabase
            .from("games")
            .update({
                title: form.data.title,
                description: form.data.description,
                location: locationWKT,
                image_url: form.data.cover_image_url,
                categories: form.data.categories,
                updated_at: new Date().toISOString(),
            })
            .eq("game_id", params.id)
            .eq("owner_id", session.user.id);

        if (updateError) {
            console.error("Update error:", updateError);
            return fail(500, {
                form,
                message: "Failed to update information.",
            });
        }

        return { form, message: "General information updated!" };
    },
} satisfies Actions;
