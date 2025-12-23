<script lang="ts">
	import PoisForm from '$lib/components/pois-form.svelte';
	import type { PageProps } from './$types';
	let { data, params }: PageProps = $props();
	let { session, supabase } = $derived(data);
</script>

<PoisForm {data} {params} {supabase} {session} />
