import base64
import io
import json
import logging
import os
from datetime import datetime, time

import boto3
from botocore.config import Config
from PIL import Image

logger = logging.getLogger(__name__)


def load_image_as_base64(image_path):
    """
    Loads an image from disk and returns a Base64 encoded string.

    Args:
        image_path (str): The path to the image file.

    Returns:
        str: A Base64 encoded string
    """
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def base64_to_pil_image(base64_str):
    """
    Converts a Base64 encoded string to a PIL Image object.

    Args:
        base64_str (str): A Base64 encoded string.

    Returns:
        PIL.Image: A PIL Image object.
    """
    # Remove the data URL prefix if it exists (e.g., 'data:image/jpeg;base64,')
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]

    # Decode base64 string to bytes
    image_bytes = base64.b64decode(base64_str)

    # Create a BytesIO object from the bytes
    image_buffer = io.BytesIO(image_bytes)

    # Create PIL Image object
    pil_image = Image.open(image_buffer)

    return pil_image


def generate_images(
    inference_params,
    base_filename="",
    save_folder_path=None,
    model_id="amazon.nova-canvas-v1:0",
    region_name="us-east-1",
    endpoint_url=None,
):
    # If the caller has provided a save folder path, save the inference params
    # to disk.
    if save_folder_path:
        os.makedirs(save_folder_path, exist_ok=True)

        # Save the inference params.
        with open(
            os.path.join(save_folder_path, f"{base_filename}inference_params.json"), "w"
        ) as f:
            json.dump(inference_params, f, indent=2)

    image_count = 1
    if "imageGenerationConfig" in inference_params:
        if "numberOfImages" in inference_params["imageGenerationConfig"]:
            image_count = inference_params["imageGenerationConfig"]["numberOfImages"]

    logger.info(f"Generating {image_count} image(s) with {model_id}")

    # Display the seed value if one is being used.
    if "imageGenerationConfig" in inference_params:
        if "seed" in inference_params["imageGenerationConfig"]:
            logger.info(
                f"Using seed: {inference_params['imageGenerationConfig']['seed']}"
            )

    bedrock_client_optional_args = (
        {} if endpoint_url is None else {"endpoint_url": endpoint_url}
    )
    bedrock = boto3.client(
        service_name="bedrock-runtime",
        region_name=region_name,
        config=Config(read_timeout=300),
        **bedrock_client_optional_args,
    )

    body_json = json.dumps(inference_params, indent=2)

    start_time = datetime.now()

    try:
        response = bedrock.invoke_model(
            body=body_json,
            modelId=model_id,
            accept="application/json",
            contentType="application/json",
        )
        duration = datetime.now() - start_time
        logger.info(
            f"Image generation took {round(duration.total_seconds(), 2)} seconds."
        )

        response_metadata = response.get("ResponseMetadata")

        # Log the request ID.
        logger.info(
            f"Image generation request ID: {response['ResponseMetadata']['RequestId']}"
        )

        # Write response metadata to disk.
        if save_folder_path:
            with open(
                os.path.join(
                    save_folder_path, f"{base_filename}response_metadata.json"
                ),
                "w",
            ) as f:
                json.dump(response_metadata, f, indent=2)

        response_body = json.loads(response.get("body").read())

        # Check for non-exception errors.
        if "error" in response_body and save_folder_path:
            with open(
                os.path.join(save_folder_path, f"{base_filename}error.txt"), "w"
            ) as f:
                error_message = response_body["error"]
                f.write(error_message)

        # Write the images to disk. Note, images are base64 strings representing PNGs.
        if save_folder_path:
            for index, image_base64 in enumerate(response_body.get("images", [])):
                image = base64_to_pil_image(image_base64)
                image.save(
                    os.path.join(save_folder_path, f"{base_filename}image_{index}.png")
                )

        return response_body

    except Exception as ex:
        # Write the error message to disk.
        if save_folder_path:
            with open(
                os.path.join(save_folder_path, f"{base_filename}error.txt"), "w"
            ) as f:
                response_str = str(ex.response)
                f.write(response_str)
        raise ex
