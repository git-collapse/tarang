import JSZip from 'jszip';

/**
 * Creates a .zip Blob from an array of files/blobs with path metadata
 * @param {Array<{name: string, path?: string, blob: Blob}>} items
 * @param {string} zipName
 * @returns {Promise<Blob>}
 */
export async function createZipFromFiles(items, onProgress) {
  const zip = new JSZip();

  items.forEach((item) => {
    const filePath = item.path || item.name;
    zip.file(filePath, item.blob);
  });

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(metadata.percent);
      }
    }
  );

  return zipBlob;
}

/**
 * Triggers a download of a Blob or URL with a filename
 */
export function triggerDownload(blobOrUrl, filename) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}
