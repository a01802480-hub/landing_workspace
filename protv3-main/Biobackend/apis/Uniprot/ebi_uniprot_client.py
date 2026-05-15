# ebi_uniprot_client.py
import requests
import time
import logging
from typing import Generator, Dict, Any, Optional, Literal
from xml.etree import ElementTree as ET
import json

logger = logging.getLogger(__name__)

class EBIProteinsClient:
    PROTEINS_BASE = "https://www.ebi.ac.uk/proteins/api"
    UNIPROT_BASE = "https://rest.uniprot.org"

    def __init__(self, email: str, rate_limit: float = 0.15):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": f"BioInfoAgent/1.0 ({email})",
            "From": email,  # EBI mandatory
            "Accept": "application/json"
        })
        self.rate_limit = rate_limit
        self.attribution_log = []

    def _request(self, url: str, fmt: Literal["json", "xml"] = "json", stream: bool = False, params: dict = None) -> requests.Response:
        accept = f"application/{fmt}"
        self.session.headers["Accept"] = accept
        logger.info(f"🌐 GET {url} | Accept: {accept} | Stream: {stream}")

        r = self.session.get(url, params=params, stream=stream)
        r.raise_for_status()  # Mandatory constraint
        time.sleep(self.rate_limit)
        return r

    def fetch_standard(self, endpoint: str, params: dict = None, fmt: Literal["json", "xml"] = "json") -> list:
        """Handles x-pagination-totalrecords pagination loop."""
        params = params or {}
        params.setdefault("size", 500)
        params.setdefault("offset", 0)

        all_results = []
        while True:
            r = self._request(f"{self.PROTEINS_BASE}{endpoint}", fmt=fmt, params=params)

            # Track CC BY 4.0 attribution
            self.attribution_log.append({
                "source": "UniProtKB/EBI Proteins API",
                "license": "CC BY 4.0",
                "url": r.url,
                "timestamp": time.time()
            })

            data = r.json() if fmt == "json" else list(ET.fromstring(r.text).iter())
            all_results.extend(data if isinstance(data, list) else [data])

            total = int(r.headers.get("x-pagination-totalrecords", 0))
            if total == 0 or len(all_results) >= total:
                break
            params["offset"] += params["size"]

        logger.info(f"✅ Fetched {len(all_results)} records from {endpoint}")
        return all_results

    def fetch_stream(self, endpoint: str, params: dict = None, fmt: Literal["json", "xml"] = "json") -> Generator[Any, None, None]:
        """Streaming mode for large datasets. Bypasses pagination overhead."""
        params = params or {}
        # EBI doesn't officially support size=-1, so we stream in chunks
        params["size"] = -1 if "-1" in params else params.get("size", 1000)

        r = self._request(f"{self.PROTEINS_BASE}{endpoint}", fmt=fmt, stream=True, params=params)
        self.attribution_log.append({"source": "UniProtKB/EBI", "license": "CC BY 4.0", "stream": True})

        if fmt == "json":
            for line in r.iter_lines():
                if line:
                    yield json.loads(line)
        else:
            # XML streaming via iterative parsing
            for event, elem in ET.iterparse(r.raw, events=("end",)):
                if elem.tag.endswith("entry"):
                    yield elem
                    elem.clear()

    def map_coordinates(self, accessions: list[str], organism: str = "human") -> list[dict]:
        """Bridge UniProt accessions to genomic coordinates via /coordinates endpoint."""
        results = []
        for acc in accessions:
            params = {"accession": acc, "organism": organism}
            r = self._request(f"{self.PROTEINS_BASE}/coordinates", params=params)
            r.raise_for_status()
            coords = r.json()
            if isinstance(coords, list):
                results.extend(coords)
            else:
                results.append(coords)
        logger.info(f"🧬 Mapped {len(results)} coordinate records")
        return results

    def get_attribution_report(self) -> str:
        """Generate CC BY 4.0 compliance statement for pipelines."""
        return json.dumps(self.attribution_log, indent=2)
