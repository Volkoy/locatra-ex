-- Create game-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'game-images',
    'game-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload images
CREATE POLICY "Users can upload game images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'game-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own images
CREATE POLICY "Users can update their own game images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'game-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'game-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own game images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'game-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to all game images
CREATE POLICY "Public can view game images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'game-images');