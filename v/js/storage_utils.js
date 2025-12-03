export async function uploadFile(file, path) {
    if (!file) throw new Error("No file provided");

    // 1. Get Presigned URL from our API
    const response = await fetch('http://localhost:8080/generate-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename: path,
            contentType: file.type
        })
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Failed to get upload URL: ${txt}`);
    }

    const { uploadUrl, publicUrl } = await response.json();

    // 2. Upload File to R2
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type
        },
        body: file
    });

    if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to R2");
    }

    return publicUrl;
}
