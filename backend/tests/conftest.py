import os

# Tests always run on fake data, even if backend/.env points at Databricks.
os.environ["DATA_SOURCE"] = "mock"
