<script lang="ts">
	import CardsForm from '$lib/components/cards-form.svelte';

	let { data, params } = $props();
</script>

<CardsForm {data} {params} />
