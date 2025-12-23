<script lang="ts">
	import AiForm from '$lib/components/ai-form.svelte';
	import type { PageProps } from './$types';

	let { data, params }: PageProps = $props();
</script>

<AiForm {data} {params} supabase={data.supabase} session={data.session} />
