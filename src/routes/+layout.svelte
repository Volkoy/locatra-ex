<script>
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.ico';
	import logo from '$lib/assets/logo.svg';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data, children } = $props();
	let { session, supabase, isAuthenticated } = $derived(data);

	// Hide nav on edit pages
	const showNav = $derived(
		!$page.url.pathname.includes('/edit') && !$page.url.pathname.includes('/session/')
	);

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

{#if showNav}
	<nav class="flex items-center justify-between border-b border-dark-green p-2">
		<div class="flex items-center gap-6">
			<a href="/">
				<img src={logo} alt="PathWriter" class="h-14" />
			</a>
		</div>
		<div class="flex items-center gap-6">
			<div class="hidden items-center gap-2 md:flex">
				<Button variant="ghost" href="/play">Play Games</Button>
				{#if isAuthenticated}
					<Button variant="ghost" href="/dashboard/games/new">Create Games</Button>
				{/if}
			</div>
			{#if isAuthenticated}
				<Button onclick={logout}>Logout</Button>
			{:else}
				<Button href="/auth">Get Started</Button>
			{/if}
		</div>
	</nav>
{/if}

{@render children()}
