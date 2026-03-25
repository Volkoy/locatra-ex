<script lang="ts">
	import { X, Send } from 'lucide-svelte';
	import { tick } from 'svelte';

	type Message = { role: 'user' | 'assistant'; content: string };

	let {
		isOpen = $bindable(false),
		messages = $bindable<Message[]>([]),
		isLoading,
		companionName,
		companionAvatarUrl,
		playerAvatarUrl,
		onSend
	}: {
		isOpen: boolean;
		messages: Message[];
		isLoading: boolean;
		companionName: string;
		companionAvatarUrl: string | null;
		playerAvatarUrl: string | null;
		onSend: (text: string) => void;
	} = $props();

	let input = $state('');
	let messagesEl: HTMLElement | null = $state(null);

	const initial = companionName.charAt(0).toUpperCase();

	async function scrollToBottom() {
		await tick();
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	$effect(() => {
		void messages.length;
		void isLoading;
		void isOpen;
		scrollToBottom();
	});

	function send() {
		const text = input.trim();
		if (!text || isLoading) return;
		input = '';
		onSend(text);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-[200] bg-black/40"
		role="presentation"
		onclick={() => (isOpen = false)}
	></div>

	<!-- Sheet -->
	<div class="fixed inset-x-0 bottom-4 z-[201] mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style="top: max(env(safe-area-inset-top, 0px) + 16px, 16px);">
		<!-- Header -->
		<div class="flex shrink-0 items-center gap-3 bg-dark-green px-4 py-3">
			{#if companionAvatarUrl}
				<img src={companionAvatarUrl} alt={companionName} class="size-10 rounded-full object-cover ring-2 ring-white/30" />
			{:else}
				<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">{initial}</div>
			{/if}
			<div class="flex-1">
				<p class="font-semibold text-white">{companionName}</p>
				<p class="text-xs text-white/70">Your guide</p>
			</div>
			<button
				onclick={() => (isOpen = false)}
				aria-label="Close chat"
				class="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
			>
				<X class="size-5" />
			</button>
		</div>

		<!-- Messages -->
		<div bind:this={messagesEl} class="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
			{#if messages.length === 0 && !isLoading}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
					{#if companionAvatarUrl}
						<img src={companionAvatarUrl} alt={companionName} class="size-20 rounded-full object-cover" />
					{:else}
						<div class="flex size-20 items-center justify-center rounded-full bg-dark-green text-3xl font-bold text-white">{initial}</div>
					{/if}
					<p class="text-lg font-semibold text-foreground">{companionName}</p>
					<p class="text-sm text-muted-foreground">Say hello to your guide!</p>
				</div>
			{/if}
			{#each messages as msg (msg)}
				{#if msg.role === 'assistant'}
					<div class="flex items-end gap-2">
						{#if companionAvatarUrl}
							<img src={companionAvatarUrl} alt={companionName} class="size-7 shrink-0 rounded-full object-cover" />
						{:else}
							<div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white">{initial}</div>
						{/if}
						<div class="max-w-[80%] rounded-2xl rounded-bl-sm border border-dark-green/20 bg-muted/40 px-4 py-2.5 text-sm leading-relaxed">{msg.content}</div>
					</div>
				{:else}
					<div class="flex items-end justify-end gap-2">
						<div class="max-w-[80%] rounded-2xl rounded-br-sm bg-dark-green px-4 py-2.5 text-sm leading-relaxed text-white">{msg.content}</div>
						{#if playerAvatarUrl}
							<img src={playerAvatarUrl} alt="You" class="size-7 shrink-0 rounded-full object-cover" />
						{/if}
					</div>
				{/if}
			{/each}
			{#if isLoading}
				<div class="flex items-end gap-2">
					{#if companionAvatarUrl}
						<img src={companionAvatarUrl} alt={companionName} class="size-7 shrink-0 rounded-full object-cover" />
					{:else}
						<div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white">{initial}</div>
					{/if}
					<div class="rounded-2xl rounded-bl-sm border border-dark-green/20 bg-muted/40 px-4 py-3">
						<span class="flex gap-1">
							<span class="size-2 animate-bounce rounded-full bg-dark-green/50" style="animation-delay:0ms"></span>
							<span class="size-2 animate-bounce rounded-full bg-dark-green/50" style="animation-delay:150ms"></span>
							<span class="size-2 animate-bounce rounded-full bg-dark-green/50" style="animation-delay:300ms"></span>
						</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="flex shrink-0 items-center gap-2 border-t border-dark-green/20 px-4 py-3">
			<input
				type="text"
				bind:value={input}
				onkeydown={onKeyDown}
				placeholder="Ask {companionName}…"
				class="flex-1 rounded-full border border-dark-green/30 bg-muted/20 px-4 py-2.5 text-sm outline-none focus:border-dark-green"
			/>
			<button
				onclick={send}
				disabled={!input.trim() || isLoading}
				class="flex size-10 shrink-0 items-center justify-center rounded-full bg-dark-green text-white disabled:opacity-40"
				aria-label="Send"
			>
				<Send class="size-4" />
			</button>
		</div>
	</div>
{/if}
