
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export async function uploadFile(file, objectName) {
    if (!file) throw new Error("No file provided")

    // 1. Get Presigned URL
    try {
        const response = await fetch(`${API_URL}/generate-upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: objectName,
                contentType: file.type
            })
        })

        if (!response.ok) {
            const txt = await response.text()
            throw new Error(`Failed to get upload URL: ${txt}`)
        }

        const { uploadUrl, publicUrl } = await response.json()

        // 2. Upload to Storage (R2/S3) via PUT
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        })

        if (!uploadRes.ok) {
            throw new Error("Failed to upload file content")
        }

        return publicUrl
    } catch (err) {
        console.error("Upload error", err)
        throw err
    }
}
