<script lang="ts">
	import GeneralInformation from '$lib/components/generalInformation.svelte';
	import type { PageProps } from './$types';
	let { data, params }: PageProps = $props();
	let { session, supabase } = $derived(data);
</script>

<GeneralInformation {data} {params} {supabase} {session} />
