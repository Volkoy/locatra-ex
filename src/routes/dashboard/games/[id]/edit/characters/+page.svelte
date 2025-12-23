<script lang="ts">
	import CharactersForm from '$lib/components/characters-form.svelte';
	import type { PageProps } from './$types';
	let { data, params }: PageProps = $props();
	let { session, supabase } = $derived(data);
</script>

<CharactersForm {data} {params} {supabase} {session} />
