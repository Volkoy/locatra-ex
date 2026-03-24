<script lang="ts">
	import { MapPin, Leaf, BookOpen, Eye, Footprints, Landmark } from 'lucide-svelte';

	type Props = {
		poi: {
			name: string | null;
			description: string | null;
			image_url: string | null;
			type: string | null;
			tags?: string[] | null;
		};
	};

	let { poi }: Props = $props();

	const getIcon = (type: string | null) => {
		switch (type) {
			case 'nature': return Leaf;
			case 'history': return BookOpen;
			case 'sense': return Eye;
			case 'action': return Footprints;
			case 'landmark': return Landmark;
			default: return MapPin;
		}
	};

	const getIconBg = (type: string | null) => {
		switch (type) {
			case 'nature': return 'bg-nature-green';
			case 'history': return 'bg-history-yellow';
			case 'sense': return 'bg-purple-600';
			case 'action': return 'bg-sense-red';
			case 'landmark': return 'bg-landmark-green';
			default: return 'bg-gray-500';
		}
	};

	const getPaleBg = (type: string | null) => {
		switch (type) {
			case 'nature': return 'bg-nature-green/10';
			case 'history': return 'bg-history-yellow/10';
			case 'sense': return 'bg-purple-600/10';
			case 'action': return 'bg-sense-red/10';
			case 'landmark': return 'bg-landmark-green/10';
			default: return 'bg-gray-100';
		}
	};

	const getTextColor = (type: string | null) => {
		switch (type) {
			case 'nature': return 'text-nature-green';
			case 'history': return 'text-history-yellow';
			case 'sense': return 'text-purple-600';
			case 'action': return 'text-sense-red';
			case 'landmark': return 'text-landmark-green';
			default: return 'text-gray-700';
		}
	};

	let Icon = $derived(getIcon(poi.type));
	let iconBg = $derived(getIconBg(poi.type));
	let paleBg = $derived(getPaleBg(poi.type));
	let textColor = $derived(getTextColor(poi.type));
</script>

<div class="flex aspect-[2/3] w-72 flex-col overflow-hidden rounded-xl border-8 border-white shadow-md outline-2 outline-gray-200">
	<div class="aspect-video w-full overflow-hidden">
		{#if poi.image_url}
			<img src={poi.image_url} alt={poi.name ?? ''} class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center {paleBg}">
				<div class="flex h-14 w-14 items-center justify-center rounded-full {iconBg}">
					<Icon class="h-7 w-7 text-white" />
				</div>
			</div>
		{/if}
	</div>
	<div class="flex flex-1 flex-col bg-white px-3 pb-3 pt-2">
		{#if poi.type}
			<span class="mb-1 self-start rounded-full px-2 py-0.5 text-xs font-medium uppercase {paleBg} {textColor}">{poi.type}</span>
		{/if}
		<h3 class="font-semibold text-gray-900">{poi.name ?? 'Unknown'}</h3>
		{#if poi.description}
			<p class="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600">{poi.description}</p>
		{/if}
		{#if poi.tags && poi.tags.length > 0}
			<div class="mt-2 flex flex-wrap gap-1">
				{#each poi.tags.slice(0, 3) as tag (tag)}
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">#{tag}</span>
				{/each}
				{#if poi.tags.length > 3}
					<span class="text-xs text-gray-500">+{poi.tags.length - 3}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>
