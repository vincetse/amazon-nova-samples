const fs = require('fs').promises;
const path = require('path');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

/**
 * Loads an image from disk and returns a Base64 encoded string.
 * @param {string} imagePath - The path to the image file.
 * @returns {Promise<string>} A Base64 encoded string
 */
async function loadImageAsBase64(imagePath) {
    const imageBuffer = await fs.readFile(imagePath);
    return imageBuffer.toString('base64');
}

/**
 * Converts a Base64 encoded string to a Buffer.
 * @param {string} base64Str - A Base64 encoded string.
 * @returns {Buffer} A Buffer containing the image data.
 */
function base64ToBuffer(base64Str) {
    // Remove the data URL prefix if it exists (e.g., 'data:image/jpeg;base64,')
    if (base64Str.includes(',')) {
        base64Str = base64Str.split(',')[1];
    }
    
    return Buffer.from(base64Str, 'base64');
}

/**
 * Generates images using Amazon Nova Canvas model.
 * @param {Object} inferenceParams - The inference parameters for image generation.
 * @param {string} baseFilename - Base filename for saved files.
 * @param {string} saveFolderPath - Path to save generated files.
 * @param {string} modelId - The model ID to use.
 * @param {string} regionName - AWS region name.
 * @param {string} endpointUrl - Optional custom endpoint URL.
 * @returns {Promise<Object>} The response body containing generated images.
 */
async function generateImages(
    inferenceParams,
    baseFilename = '',
    saveFolderPath = null,
    modelId = 'amazon.nova-canvas-v1:0',
    regionName = 'us-east-1',
    endpointUrl = null
) {
    // If the caller has provided a save folder path, save the inference params to disk
    if (saveFolderPath) {
        await fs.mkdir(saveFolderPath, { recursive: true });
        
        // Save the inference params
        await fs.writeFile(
            path.join(saveFolderPath, `${baseFilename}inference_params.json`),
            JSON.stringify(inferenceParams, null, 2)
        );
    }

    let imageCount = 1;
    if (inferenceParams.imageGenerationConfig?.numberOfImages) {
        imageCount = inferenceParams.imageGenerationConfig.numberOfImages;
    }

    console.log(`Generating ${imageCount} image(s) with ${modelId}`);

    // Display the seed value if one is being used
    if (inferenceParams.imageGenerationConfig?.seed) {
        console.log(`Using seed: ${inferenceParams.imageGenerationConfig.seed}`);
    }

    const clientConfig = {
        region: regionName,
        requestTimeout: 300000
    };
    
    if (endpointUrl) {
        clientConfig.endpoint = endpointUrl;
    }

    const bedrock = new BedrockRuntimeClient(clientConfig);
    
    const startTime = new Date();

    try {
        
        const command = new InvokeModelCommand({
            body: JSON.stringify(inferenceParams),
            modelId: modelId,
            accept: 'application/json',
            contentType: 'application/json'
        });

        const response = await bedrock.send(command);
        const duration = new Date() - startTime;
        console.log(`Image generation took ${(duration / 1000).toFixed(2)} seconds.`);

        const responseMetadata = response.$metadata;

        // Log the request ID
        console.log(`Image generation request ID: ${responseMetadata.requestId}`);

        // Write response metadata to disk
        if (saveFolderPath) {
            await fs.writeFile(
                path.join(saveFolderPath, `${baseFilename}response_metadata.json`),
                JSON.stringify(responseMetadata, null, 2)
            );
        }

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        // Check for non-exception errors
        if (responseBody.error && saveFolderPath) {
            await fs.writeFile(
                path.join(saveFolderPath, `${baseFilename}error.txt`),
                responseBody.error
            );
        }

        // Write the images to disk
        if (saveFolderPath && responseBody.images) {
            for (let index = 0; index < responseBody.images.length; index++) {
                const imageBase64 = responseBody.images[index];
                const imageBuffer = base64ToBuffer(imageBase64);
                await fs.writeFile(
                    path.join(saveFolderPath, `${baseFilename}image_${index}.png`),
                    imageBuffer
                );
            }
        }

        return responseBody;

    } catch (error) {
        // Write the error message to disk
        if (saveFolderPath) {
            await fs.writeFile(
                path.join(saveFolderPath, `${baseFilename}error.txt`),
                error.toString()
            );
        }
        throw error;
    }
}

// // For compatibility with the VirtualTryOn script
// function base64ToPilImage(base64Str) {
//     // JavaScript doesn't have PIL, so we'll just return the base64 string
//     // In a real implementation, you'd convert this to an image format your environment can display
//     return base64Str;
// }

module.exports = {
    loadImageAsBase64,
    base64ToBuffer,
    generateImages,
    //base64ToPilImage
};