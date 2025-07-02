import logging
import os
from datetime import datetime
from random import randint
from amazon_nova_canvas_utils import (
    generate_images,
    load_image_as_base64,
    base64_to_pil_image,
)
from PIL import Image
from IPython.display import Image

logging.basicConfig(format="[%(levelname)s] %(message)s", level=logging.INFO)

# Edit these values to experiment with your own images.
source_image_path = "../images/vto-images/vto_garment_styling_source.jpg"
reference_image_path = "../images/vto-images/vto_garment_styling_reference.jpg"

inference_params = {
    "taskType": "VIRTUAL_TRY_ON",
    "virtualTryOnParams": {
        "sourceImage": load_image_as_base64(source_image_path),
        "referenceImage": load_image_as_base64(reference_image_path),
        "maskType": "GARMENT",
        "garmentBasedMask": {
            "garmentClass": "UPPER_BODY",
            # Add garment styling parameters
            "garmentStyling": {"longSleeveStyle": "SLEEVE_UP"} 
                               #  , 
                               # "tuckingStyle":"TUCKED", 
                               # "outerLayerStyle":"CLOSED"},
        },
    },
    # The following is optional but provided here for you to experiment with.
    "imageGenerationConfig": {
        "numberOfImages": 1,
        "quality": "standard",
        "cfgScale": 6.5,
        "seed": randint(0, 2147483646),
    },
}

output_folder = os.path.join("output", datetime.now().strftime("%Y-%m-%d_%H-%M-%S"))

try:
    response_body = generate_images(
        inference_params=inference_params,
        save_folder_path=output_folder,
        model_id="amazon.nova-canvas-v1:0",
        region_name="us-east-1",
    )

    # An error message may be returned, even if some images were generated.
    if "error" in response_body:
        logging.error(response_body["error"])

    if "images" in response_body:
        # Display all images.
        for image_base64 in response_body["images"]:
            image = base64_to_pil_image(image_base64)
            #process image if required

except Exception as e:
    logging.error(e)

print(f"Done! Artifacts saved to {os.path.abspath(output_folder)}")