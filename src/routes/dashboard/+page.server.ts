import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (
  { depends, locals: { supabase, getSession } },
) => {
  depends("supabase:auth");
  const session = await getSession();
  if (!session || session.user.is_anonymous) {
    throw redirect(303, "/auth");
  }

  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .eq("owner_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching games:", error);
    return { games: [] };
  }

  return { games: games || [] };
};

export const actions = {
  delete: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
      return fail(401, { message: "Unauthorized" });
    }

    const formData = await request.formData();
    const gameId = formData.get("gameId");

    if (!gameId || typeof gameId !== "string") {
      return fail(400, { message: "Game ID is required" });
    }

    const { error } = await supabase
      .from("games")
      .delete()
      .eq("game_id", gameId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("Error deleting game:", error);
      return fail(500, { message: "Failed to delete game" });
    }

    return { success: true };
  },

  unpublish: async ({ request, locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
      return fail(401, { message: "Unauthorized" });
    }

    const formData = await request.formData();
    const gameId = formData.get("gameId");

    if (!gameId || typeof gameId !== "string") {
      return fail(400, { message: "Game ID is required" });
    }

    const { error } = await supabase
      .from("games")
      .update({
        status: "draft",
        visibility: "private",
      })
      .eq("game_id", gameId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("Error unpublishing game:", error);
      return fail(500, { message: "Failed to unpublish game" });
    }

    return { success: true };
  },
} satisfies Actions;
