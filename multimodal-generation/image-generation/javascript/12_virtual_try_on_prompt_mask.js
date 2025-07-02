const fs = require('fs');
const path = require('path');
const { generateImages, loadImageAsBase64, base64ToBuffer } = require('./amazon_nova_canvas_utils');

// Configure logging
const log = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`)
};

// Edit these values to experiment with your own images.
const sourceImagePath = "../images/vto-images/vto_prompt_mask_source.jpg";
const referenceImagePath = "../images/vto-images/vto_prompt_mask_reference.jpg";

const outputFolder = path.join("output", new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

async function main() {
    try {
        const sourceImageBase64 = await loadImageAsBase64(sourceImagePath);
        const referenceImageBase64 = await loadImageAsBase64(referenceImagePath);
        
        const inferenceParams = {
            taskType: "VIRTUAL_TRY_ON",
            virtualTryOnParams: {
                sourceImage: sourceImageBase64,
                referenceImage: referenceImageBase64,
                maskType: "PROMPT",
                promptBasedMask: {
                    maskPrompt: "sofa with pillows",
                    maskShape: "BOUNDING_BOX"
                }
            },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality: "standard",
                cfgScale: 6.5,
                seed: Math.floor(Math.random() * 2147483646)
            }
        };
        
        const responseBody = await generateImages(
            inferenceParams,
            "",
            outputFolder,
            "amazon.nova-canvas-v1:0",
            "us-east-1"
        );

        // An error message may be returned, even if some images were generated.
        if (responseBody.error) {
            log.error(responseBody.error);
        }

        if (responseBody.images) {
            // Display all images.
            for (const imageBase64 of responseBody.images) {
                const image = base64ToBuffer(imageBase64);
                //process image if required
                console.log("Image generated successfully");
            }
        }

    } catch (error) {
        log.error(error.message);
    }

    console.log(`Done! Artifacts saved to ${path.resolve(outputFolder)}`);
}

// Execute the main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});