<script>
	import { goto, invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data, children } = $props();
	let { session, supabase, claims } = $derived(data);

	onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => data.subscription.unsubscribe();
	});

	const logout = async () => {
		const { error } = await supabase.auth.signOut();
		if (error) {
			console.error(error);
		} else {
			goto('/');
		}
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="flex items-center justify-between border-b border-gray-300 bg-white p-4">
	<div class="flex items-center gap-6">
		<Button variant="link" href="/" class="text-lg font-bold">PathWritter</Button>
	</div>
	<div class="flex items-center gap-6">
		<div class="hidden items-center gap-2 md:flex">
			<Button variant="ghost" href="/guides/playing">Playing Games</Button>
			<Button variant="ghost" href="/guides/creating">Creating Games</Button>
		</div>
		{#if session}
			<div class="flex items-center gap-2">
				<img
					src={claims?.user_metadata?.avatar_url}
					alt="avatar"
					class="h-8 w-8 rounded-full border border-gray-300"
				/>
				<div class="grid">
					<p class="font-bold">{claims?.user_metadata?.name}</p>
					<p class="text-sm text-gray-500">{claims?.user_metadata?.email}</p>
				</div>
			</div>
			<Button onclick={logout}>Logout</Button>
		{:else}
			<Button href="/auth">Get Started</Button>
		{/if}
	</div>
</nav>

{@render children()}
