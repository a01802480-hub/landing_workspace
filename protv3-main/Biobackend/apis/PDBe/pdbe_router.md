# PDBe

## Overview
Protein Data Bank in Europe - 3D structures

**Category:** structure  
**Base URL:** https://www.ebi.ac.uk/pdbe/api  
**Prefix:** /pdbe  
**Source:** https://www.ebi.ac.uk/pdbe/  
**Discovered:** 2026-04-16T02:53:01.944011

## Endpoints

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /pdbe/molecule/{pdb_id} | GET | Get PDB entry |
| 2 | /pdbe/entry/pdb/{pdb_id} | GET | Get detailed PDB info |
| 3 | /pdbe/protein/all/{uniprot_id}/summary | GET | Get all structures for protein |

## Usage

```python
import requests
resp = requests.get('http://localhost:8000/pdbe/discover')
print(resp.json())
```
