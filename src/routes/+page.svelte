<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-green-100"
>
	<h1 class="mb-8 text-4xl font-bold text-teal-700 drop-shadow">Welcome to LocatraEx!</h1>
	<Button
		class="rounded-2xl bg-teal-600 px-6 py-6 text-lg font-semibold text-white shadow transition hover:cursor-pointer hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 active:bg-teal-800"
		onclick={() => goto('/dashboard')}
	>
		Dashboard
	</Button>
</div>
