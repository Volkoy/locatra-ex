<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	let { data } = $props();

	async function loginWithGoogle() {
		await data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${location.origin}/auth/callback`
			}
		});
	}
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="flex w-full max-w-sm flex-col items-center rounded-xl bg-black px-3 py-7">
		<h2 class="mb-3 text-2xl font-bold text-white">Sign in to get started!</h2>
		<Button
			class="hover:bg-black-50 flex items-center justify-center gap-2 rounded-lg bg-white px-7 py-5 font-semibold text-black transition hover:cursor-pointer"
			onclick={loginWithGoogle}
		>
			Sign in with Google
		</Button>
	</div>
</div>
