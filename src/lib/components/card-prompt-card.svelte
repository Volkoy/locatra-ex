<script lang="ts">
	import { Leaf, BookOpen, Eye, Footprints, Landmark, BookDashed } from 'lucide-svelte';

	type Props = {
		card: {
			title: string | null;
			prompt: string | null;
			type: string | null;
			character_category?: string | null;
			card_category?: string | null;
			hero_steps?: string[] | null;
		};
	};

	let { card }: Props = $props();

	const journeyStepLabels: Record<string, string> = {
		call_to_adventure: 'Call to Adventure',
		crossing_the_threshold: 'Crossing the Threshold',
		meeting_the_mentor: 'Meeting the Mentor',
		trials_and_growth: 'Trials & Growth',
		death_and_transformation: 'Death & Transformation',
		change_and_return: 'Change & Return'
	};

	const getIcon = (type: string | null) => {
		switch (type) {
			case 'nature': return Leaf;
			case 'history': return BookOpen;
			case 'sense': return Eye;
			case 'action': return Footprints;
			case 'landmark': return Landmark;
			default: return BookDashed;
		}
	};

	const getHeaderBg = (type: string | null) => {
		switch (type) {
			case 'nature': return 'bg-nature-green';
			case 'history': return 'bg-history-yellow';
			case 'sense': return 'bg-purple-600';
			case 'action': return 'bg-sense-red';
			case 'landmark': return 'bg-landmark-green';
			default: return 'bg-gray-600';
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

	let Icon = $derived(getIcon(card.type));
	let headerBg = $derived(getHeaderBg(card.type));
	let paleBg = $derived(getPaleBg(card.type));
	let textColor = $derived(getTextColor(card.type));
</script>

<div class="flex aspect-[2/3] w-72 flex-col overflow-hidden rounded-xl border-8 border-white shadow-md outline-2 outline-gray-200 transition-shadow hover:shadow-xl">
	<div class="flex flex-col items-center gap-2 p-4 {paleBg}">
		<div class="flex h-14 w-14 items-center justify-center rounded-full {headerBg}">
			<Icon class="h-8 w-8 text-white" />
		</div>
		<h3 class="line-clamp-3 text-center text-sm font-bold leading-tight {textColor}">
			{card.title ?? 'Untitled'}
		</h3>
	</div>
	<div class="flex-1 bg-white p-4 pt-8">
		<p class="line-clamp-[8] text-center text-sm leading-relaxed text-black">
			{card.prompt ?? ''}
		</p>
	</div>
</div>
