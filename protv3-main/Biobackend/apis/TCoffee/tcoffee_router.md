# T-Coffee

## Overview
Consistency-based multiple sequence alignment

**Category:** alignment  
**Base URL:** https://www.ebi.ac.uk/Tools/services/rest/tcoffee  
**Prefix:** /tcoffee  
**Source:** https://www.ebi.ac.uk/Tools/msa/tcoffee/  
**Discovered:** 2026-04-16T02:53:11.913003

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /job | POST | Submit T-Coffee alignment |
| 2 | /status/{job_id} | GET | Check alignment status |
| 3 | /result/{job_id} | GET | Get alignment result |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/tcoffee/discover')
print(resp.json())
```
