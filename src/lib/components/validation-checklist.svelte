<script lang="ts">
	import { CircleCheck, CircleX, AlertCircle } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';

	type CheckItem = {
		label: string;
		status: 'complete' | 'incomplete' | 'warning';
		description?: string;
	};

	let { title, checks }: { title: string; checks: CheckItem[] } = $props();

	const statusConfig = {
		complete: {
			icon: CircleCheck,
			color: 'text-green-600',
			bgColor: 'bg-green-50'
		},
		incomplete: {
			icon: CircleX,
			color: 'text-red-600',
			bgColor: 'bg-red-50'
		},
		warning: {
			icon: AlertCircle,
			color: 'text-yellow-600',
			bgColor: 'bg-yellow-50'
		}
	};

	const summary = $derived.by(() => {
		const complete = checks.filter((c) => c.status === 'complete').length;
		const incomplete = checks.filter((c) => c.status === 'incomplete').length;
		const warnings = checks.filter((c) => c.status === 'warning').length;
		const total = checks.length;
		const percentage = Math.round((complete / total) * 100);

		return { complete, incomplete, warnings, total, percentage };
	});
</script>

<Card.Root class="sticky top-2">
	<Card.Header>
		<Card.Title class="text-lg">{title}</Card.Title>
		<Card.Description>
			{summary.complete}/{summary.total} complete
			{#if summary.warnings > 0}
				<span class="text-yellow-600"
					>• {summary.warnings} warning{summary.warnings > 1 ? 's' : ''}</span
				>
			{/if}
		</Card.Description>
		<!-- Progress Bar -->
		<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full transition-all duration-300"
				class:bg-green-500={summary.percentage === 100 && summary.incomplete === 0}
				class:bg-yellow-500={summary.percentage === 100 && summary.incomplete > 0}
				class:bg-blue-500={summary.percentage < 100}
				style="width: {summary.percentage}%"
			></div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="space-y-3">
			{#each checks as check}
				{@const config = statusConfig[check.status]}
				{@const Icon = config.icon}
				<div class="flex items-start gap-2">
					<div class="mt-0.5">
						<Icon class="h-5 w-5 {config.color}" />
					</div>
					<div class="flex-1">
						<p class="text-sm font-medium text-gray-900">{check.label}</p>
						{#if check.description}
							<p class="text-xs text-gray-500">{check.description}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
