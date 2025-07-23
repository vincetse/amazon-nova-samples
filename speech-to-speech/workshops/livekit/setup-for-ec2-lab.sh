# This is only required by the instructor-led workshop
#!/bin/bash

# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Start virtual environemnt 
python3 -m venv .venv
source .venv/bin/activate

# install dependencies
pip install --upgrade pip
pip install -r requirements.txt