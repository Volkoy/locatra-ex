<script lang="ts">
	import { invalidate } from '$app/navigation';
	import type { EventHandler } from 'svelte/elements';
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();
	let { supabase, claims } = $derived(data);
</script>

<h1 class="mt-4 text-2xl font-bold text-teal-700">Welcome, {claims?.user_metadata.name}!</h1>

<div class="mt-4 flex items-center justify-between">
	<h3 class="text-xl font-semibold text-gray-600">Your Experiences</h3>
	<Button class="bg-teal-500 text-white">Create Experience</Button>
</div>
