// src/utils/syncService.ts
// Service for pushing and pulling encrypted data to a free text relay (dpaste.com)

export const API_URL = "https://dpaste.com/api/v2/";

export async function uploadEncryptedAgenda(encryptedData: string): Promise<string> {
    try {
        const formData = new URLSearchParams();
        formData.append("content", encryptedData);
        formData.append("lexer", "text");
        formData.append("format", "url");
        formData.append("expires", "2592000"); // Expire in 30 days (max for dpaste)

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // The response text is the URL of the paste, e.g. "https://dpaste.com/6ZQ384BMH"
        const url = await response.text();
        const cleanUrl = url.trim();

        // Extract just the ID from the URL to use as the "Partner Code"
        const parts = cleanUrl.split('/');
        const id = parts[parts.length - 1] || parts[parts.length - 2];

        return id;
    } catch (error) {
        console.error("Upload error:", error);
        throw new Error("Failed to upload agenda.");
    }
}

export async function downloadEncryptedAgenda(partnerCode: string): Promise<string> {
    try {
        // dpaste allows appending .txt to get the raw content
        const url = `https://dpaste.com/${partnerCode}.txt`;
        const response = await fetch(url);

        if (!response.ok) {
             if (response.status === 404) {
                 throw new Error("Partner code not found or expired.");
             }
             throw new Error(`HTTP error! status: ${response.status}`);
        }

        const encryptedData = await response.text();
        return encryptedData.trim();
    } catch (error) {
        console.error("Download error:", error);
        throw error;
    }
}
