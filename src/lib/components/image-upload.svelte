<script lang="ts">
	import Cropper from 'svelte-easy-crop';
	import { Button } from '$lib/components/ui/button';
	import { X, Upload, ZoomIn, ZoomOut, LoaderCircle } from 'lucide-svelte';
	import type { CropArea } from 'svelte-easy-crop';
	import type { SupabaseClient } from '@supabase/supabase-js';

	type Props = {
		/** Current image URL stored in DB (no timestamp suffix). */
		currentImageUrl?: string | null;
		/** Storage path without extension, e.g. `userId/gameId/cover`. Saved as .jpg or .png for circular. */
		storagePath: string;
		supabase: SupabaseClient;
		bucket?: string;
		label?: string;
		/** Crop aspect ratio. Defaults to 16/9. Ignored when circular=true. */
		aspectRatio?: number;
		/** Crop and display as a circle. Saves as PNG with transparency. */
		circular?: boolean;
		/** Hide the format/size hint inside the upload button. */
		hideHint?: boolean;
		onUploaded: (url: string) => void;
		onRemoved: () => void;
		onPreview?: (blobUrl: string) => void;
	};

	let {
		currentImageUrl,
		storagePath,
		supabase,
		bucket = 'game-images',
		label = 'Click to upload image',
		aspectRatio = 16 / 9,
		circular = false,
		hideHint = false,
		onUploaded,
		onRemoved,
		onPreview
	}: Props = $props();

	let fileInput: HTMLInputElement;
	let isUploading = $state(false);
	let isRemoving = $state(false);
	let showCropModal = $state(false);
	let rawImageSrc = $state('');
	let crop = $state({ x: 0, y: 0 });
	let zoom = $state(1);
	let croppedAreaPixels = $state<CropArea | null>(null);
	/** Blob URL of the locally-compressed preview — shown immediately after crop confirm. */
	let localPreviewUrl = $state<string | null>(null);

	/** What to render in the img tag. Local blob takes precedence for instant feedback. */
	let displaySrc = $derived(localPreviewUrl ?? currentImageUrl ?? null);

	$effect(() => {
		return () => {
			if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
		};
	});

	function openFilePicker() {
		fileInput?.click();
	}

	function handleFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}
		if (file.size > 50 * 1024 * 1024) {
			alert('Image must be less than 50 MB');
			return;
		}

		const reader = new FileReader();
		reader.onload = (ev) => {
			rawImageSrc = ev.target?.result as string;
			crop = { x: 0, y: 0 };
			zoom = 1;
			croppedAreaPixels = null;
			showCropModal = true;
		};
		reader.readAsDataURL(file);
		(e.target as HTMLInputElement).value = '';
	}

	function handleCropComplete({ pixels }: { percent: CropArea; pixels: CropArea }) {
		croppedAreaPixels = pixels;
	}

	function getCroppedBlob(): Promise<Blob | null> {
		if (!rawImageSrc || !croppedAreaPixels) return Promise.resolve(null);

		return new Promise((resolve) => {
			const image = new Image();
			image.onload = () => {
				const canvas = document.createElement('canvas');
				const outW = circular || aspectRatio === 1 ? 800 : 1280;
				const outH = circular || aspectRatio === 1 ? 800 : 720;
				canvas.width = outW;
				canvas.height = outH;
				const ctx = canvas.getContext('2d')!;
				if (circular) {
					ctx.beginPath();
					ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
					ctx.clip();
				}
				ctx.drawImage(
					image,
					croppedAreaPixels!.x,
					croppedAreaPixels!.y,
					croppedAreaPixels!.width,
					croppedAreaPixels!.height,
					0,
					0,
					outW,
					outH
				);
				canvas.toBlob(
					(blob) => resolve(blob),
					circular ? 'image/png' : 'image/jpeg',
					circular ? undefined : 0.85
				);
			};
			image.src = rawImageSrc;
		});
	}

	async function confirmCrop() {
		const blob = await getCroppedBlob();
		if (!blob) return;

		showCropModal = false;

		// Show compressed result instantly while uploading
		const prev = localPreviewUrl;
		localPreviewUrl = URL.createObjectURL(blob);
		if (prev) URL.revokeObjectURL(prev);
		onPreview?.(localPreviewUrl);

		isUploading = true;
		try {
			const path = `${storagePath}.${circular ? 'png' : 'jpg'}`;
			const { error } = await supabase.storage
				.from(bucket)
				.upload(path, blob, { contentType: 'image/jpeg', upsert: true });

			if (error) throw error;

			const {
				data: { publicUrl }
			} = supabase.storage.from(bucket).getPublicUrl(path);

			onUploaded(`${publicUrl}?t=${Date.now()}`);
		} catch (err) {
			console.error('Upload failed:', err);
			alert('Upload failed. Please try again.');
			if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
			localPreviewUrl = null;
		} finally {
			isUploading = false;
		}
	}

	function cancelCrop() {
		showCropModal = false;
		rawImageSrc = '';
	}

	async function removeImage() {
		isRemoving = true;
		try {
			const cleanUrl = (currentImageUrl ?? '').split('?')[0];
			const marker = `/object/public/${bucket}/`;
			const idx = cleanUrl.indexOf(marker);
			if (idx !== -1) {
				const path = cleanUrl.slice(idx + marker.length);
				await supabase.storage.from(bucket).remove([path]);
			}
			if (localPreviewUrl) {
				URL.revokeObjectURL(localPreviewUrl);
				localPreviewUrl = null;
			}
			onRemoved();
		} catch (err) {
			console.error('Remove failed:', err);
			alert('Failed to remove image');
		} finally {
			isRemoving = false;
		}
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept="image/jpeg,image/png,image/webp"
	class="hidden"
	onchange={handleFileSelect}
/>

{#if displaySrc}
	<!-- Image preview -->
	<div class="relative">
		<img
			src={displaySrc}
			alt="Preview"
			class="{circular
				? 'aspect-square rounded-full'
				: aspectRatio === 1
					? 'aspect-square rounded-lg'
					: 'aspect-video rounded-lg'} w-full object-cover"
		/>
		{#if isUploading || isRemoving}
			<div class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
				<LoaderCircle class="h-8 w-8 animate-spin text-white" />
			</div>
		{/if}
		<Button
			type="button"
			variant="destructive"
			size="icon"
			class="absolute top-2 right-2"
			onclick={removeImage}
			disabled={isUploading || isRemoving}
		>
			<X class="h-4 w-4" />
		</Button>
		<button
			type="button"
			class="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white transition hover:bg-black/80 disabled:opacity-50"
			onclick={openFilePicker}
			disabled={isUploading || isRemoving}
		>
			Replace
		</button>
	</div>
{:else}
	<!-- Upload area -->
	<button
		type="button"
		class="flex {circular
			? 'aspect-square rounded-full'
			: aspectRatio === 1
				? 'aspect-square rounded-lg'
				: 'aspect-video rounded-lg'} w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed border-gray-300 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
		onclick={openFilePicker}
		disabled={isUploading}
	>
		{#if isUploading}
			<LoaderCircle class="h-10 w-10 animate-spin text-gray-400" />
			<p class="mt-2 text-sm text-gray-600">Uploading…</p>
		{:else}
			<Upload class="h-10 w-10 text-gray-400" />
			<p class="mt-2 text-sm text-gray-600">{label}</p>
			{#if !hideHint}<p class="text-xs text-gray-500">
					PNG, JPG, WEBP · max 50 MB — cropped to {circular
						? 'circle'
						: aspectRatio === 1
							? '1:1'
							: '16:9'}
				</p>{/if}
		{/if}
	</button>
{/if}

<!-- Crop modal -->
{#if showCropModal}
	<div class="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true">
		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b border-white/20 px-4 py-3">
			<h2 class="text-sm font-semibold text-white">
				Crop image ({circular ? 'circle' : aspectRatio === 1 ? '1:1' : '16:9'})
			</h2>
			<button
				type="button"
				onclick={cancelCrop}
				class="rounded p-1 text-white transition hover:bg-white/10"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Cropper area -->
		<div class="relative min-h-0 flex-1">
			<Cropper
				image={rawImageSrc}
				bind:crop
				bind:zoom
				aspect={circular ? 1 : aspectRatio}
				cropShape={circular ? 'round' : 'rect'}
				showGrid={!circular}
				oncropcomplete={handleCropComplete}
			/>
		</div>

		<!-- Bottom bar: zoom + confirm -->
		<div class="flex shrink-0 items-center gap-3 border-t border-white/20 px-4 py-3">
			<ZoomOut class="h-4 w-4 shrink-0 text-white" />
			<input
				type="range"
				min="1"
				max="3"
				step="0.05"
				bind:value={zoom}
				class="flex-1 accent-white"
			/>
			<ZoomIn class="h-4 w-4 shrink-0 text-white" />
			<Button class="ml-4 shrink-0" onclick={confirmCrop}>Confirm crop</Button>
		</div>
	</div>
{/if}
