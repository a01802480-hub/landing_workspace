# Clustal Omega

## Overview
Multiple sequence alignment from EBI

**Category:** alignment  
**Base URL:** https://www.ebi.ac.uk/Tools/services/rest/clustalo  
**Prefix:** /clustalo  
**Source:** https://www.ebi.ac.uk/Tools/msa/clustalo/  
**Discovered:** 2026-04-16T02:53:08.822048

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /job | POST | Submit alignment job |
| 2 | /status/{job_id} | GET | Check job status |
| 3 | /result/{job_id} | GET | Get alignment results |
| 4 | /parameters | GET | Get available parameters |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/clustalo/discover')
print(resp.json())
```
