<script>
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data, children } = $props();
	let { supabase, claims } = $derived(data);

	const logout = async () => {
		const { error } = await supabase.auth.signOut();
		if (error) {
			console.error(error);
		} else {
			goto('/');
		}
	};
</script>

<header>
	<nav class="flex justify-between bg-teal-50 p-6">
		<h1 class="text-2xl font-bold text-teal-700">Dashboard</h1>
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<img class="h-8 w-8 rounded-full" src={claims?.user_metadata.avatar_url} alt="avatar" />
				<span>{claims?.user_metadata.email}</span>
			</div>
			<Button onclick={logout}>Logout</Button>
		</div>
	</nav>
</header>
<main class="p-6">
	{@render children()}
</main>
