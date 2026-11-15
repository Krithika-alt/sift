import os

# Tests always run on fake data, even if backend/.env points at Databricks.
os.environ["DATA_SOURCE"] = "mock"
# Tests never call the real Genie space (slow, needs network); genie tests turn it back on.
os.environ["USE_GENIE"] = "0"
