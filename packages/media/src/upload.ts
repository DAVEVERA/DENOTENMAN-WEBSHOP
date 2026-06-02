export type UploadObjectInput = {
  bucket: string;
  path: string;
  contentType: string;
  cacheControl?: string;
};

export function validateUploadObject(input: UploadObjectInput) {
  if (!input.bucket.trim()) throw new Error("Bucket ontbreekt.");
  if (!/^[a-z0-9][a-z0-9/_ .-]*$/i.test(input.path)) throw new Error("Uploadpad is ongeldig.");
  if (!input.contentType.startsWith("image/")) throw new Error("Alleen afbeeldingen zijn toegestaan.");
  return {
    ...input,
    cacheControl: input.cacheControl ?? "31536000",
  };
}
