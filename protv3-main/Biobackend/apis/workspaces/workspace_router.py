from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from apis.auth.auth_router import get_current_user

router = APIRouter(
    prefix="/workspaces",
    tags=["Workspaces"]
)

# ---------------------------------------------------------------------------
# In-memory storage with seed data
# ---------------------------------------------------------------------------

workspaces_db: dict[str, dict] = {}

# Seed protein sequences for the demo workspaces
SAMPLE_SEQUENCES = {
    "myoglobin_human": (
        "MGLSDGEWQLVLNVWGKVEADIPGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKASEDLKKHGATVLTALGGILK"
        "KKGHHEAEIKPLAQSHATKHKIPVKYLEFISECIIQVLQSKHPGDFGADAQGAMNKALELFRKDMASNYKELGFQG"
    ),
    "myoglobin_whale": (
        "MGLSDGEWQLVLNIWGKVETDLAGHGQEVLIRLFKGHPETLEKFDKFKHLKTEAEMKASEDLKKHGVTVLTALGAILK"
        "KKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPGDFGADAQGAMNKALELFRKDIAAKYKELGYQG"
    ),
    "hemoglobin_alpha_human": (
        "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDD"
        "MPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR"
    ),
    "hemoglobin_beta_human": (
        "MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLA"
        "HLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH"
    ),
    "cytochrome_c_human": (
        "MGDVEKGKKIFIMKCSQCHTVEKGGKHKTGPNLHGLFGRKTGQAPGYSYTAANKNKGIIWGEDTLMEYLENPKKYI"
        "PGTKMIFVGIKKKEERADLIAYLKKATNE"
    ),
    "insulin_human": (
        "MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSL"
        "QPLALEGSLQKRGIVEQCCTSICSLYQLENYCN"
    ),
    "tp53_human": (
        "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAP"
        "AAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPG"
        "TRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTT"
        "IHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRAL"
        "PNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMF"
        "KTEGPDSD"
    ),
    "brca1_human": (
        "MDLSALRVEEVQNVINAMQKILECPICLELIKEPVSTKCDHIFCKFCMLKLLNQKKGPSQCPLCKNDITKRSLQEST"
        "RFSQLVEELLKIICAFQLDTGLEYANSYNFAKKENNSPEHLKDEVSIQSMGYRNRAKRLLQSEPENPSLQETSLSVQ"
        "LSNLGTVRTLRTKQRIQPQKTSVYIELGSDSSEDTVNKATYCSVGDQELLQITPQGTRDEISLDSAKKAACEFSETD"
        "VTNTEHHQPSNNDLNTTEKRAAERHPEKYQGSSVSNLHVEPCGTNTHASSLQHENSSLLLTKDRMNVEKAEFCNKSK"
        "QPGLARSQHNRWAGSKETCNDRRTPSTEKKVDLNADPLCERKEWNKQKLPCSENPRDTEDVPWITLNSSIQKVNEWF"
        "SRSDELLGSDDSHDGESESNAKVADVLDVLNEVDEYSGSSEKIDLLASDPHEALICK"
    ),
    "collagen_human": (
        "MFSFVDLRLLLLLAATALLTHGQEEGQVEGQDEDIPPITCQNGLRYQDRDVWKPEPCRICVCDNGKVLCDDVICDET"
        "KNCPGAEVPEGECCPVCPDGSESPTDQETTGVEGPKGDTGPRGPRGPAGPPGRDGIPGQPGLPGPPGPPGPPGPPGL"
        "GGNFAPQLSYGYDEKSTGGISVPGPMGPSGPRGLPGPPGAPGPQGFQGPPGEPGEPGASGPMGPRGPPGPPGKNGDD"
        "GEAGKPGRPGERGPPGPQGARGLPGTAGLPGMKGHRGFSGLDGAKGDAGPAGPKGEPGSPGENGAPGQMGPRGLPGE"
        "RGRPGAPGPAGARGNDGATGAAGPPGPTGPAGPPGFPGAVGAKGEAGPQGPRGSEGPQGVRGEPGPPGPAGAAGPAG"
        "NPGADGQPGAKGANGAPGIAGAPGFPGARGPSGPQGPGGPPGPKGNSGEPGAPGSKGDTGAKGEPGPVGVQGPPGPA"
        "GEEGKRGARGEPGPTGLPGPPGERGGPGSRGFPGADGVAGPKGPAGERGSPGPAGPKGSPGEAGRPGEAGLPGAKGL"
        "TGSPGSPGPDGKTGPPGPAGQDGRPGPPGPPGARGQAGVMGFPGPKGAAGEPGKAGERGVPGPPGAVGPAGKDGEAG"
        "AQGPPGPAGPAGERGEQGPAGSPGFQGLPGPAGPPGEAGKPGEQGVPGDLGAPGPSGARGERGFPGERGVQGPPGPA"
        "GPRGANGAPGNDGAKGDAGAPGAPGSQGAPGLQGMPGERGAAGLPGPKGDRGDAGPKGADGSPGKDGVRGLTGPIGP"
        "PGPAGAPGDKGESGPSGPAGPTGARGAPGDRGEPGPPGPAGFAGPPGADGQPGAKGEPGDAGAKGDAGPPGPAGPAG"
        "PPGPIGNVGAPGAKGARGSAGPPGATGFPGAAGRVGPPGPSGNAGPPGPPGPAGKEGGKGPRGETGPAGRPGEVGPP"
        "GPPGPAGEKGSPGADGPAGAPGTPGPQGIAGQRGVVGLPGQRGERGFPGLPGPSGEPGKQGPSGASGERGPPGPMGP"
        "PGLAGPPGESGREGAPGAEGSPGRDGSPGAKGDRGETGPAGPPGAPGAPGAPGPVGPAGKSGDRGETGPAGPTGPVG"
        "PVGARGPAGPQGPRGDKGETGEQGDRGIKGHRGFSGLQGPPGPPGSPGEQGPSGASGPAGPRGPPGSAGAPGKDGLN"
        "GLPGPIGPPGPRGRTGDAGPVGPPGPPGPPGPPGPPSAGFDFSFLPQPPQEKAHDGGRYYRADDANVVRDRDLEVDT"
        "TLKSLSQQIENIRSPEGSRKNPARTCRDLKMCHSDWKSGEYWIDPNQGCNLDAIKVFCNMETGETCVYPTQPSVAQK"
        "NWYISKNPKDKRHVWFGESMTDGFQFEYGGQGSDPADVAIQLTFLRLMSTEASQNITYHCKNSVAYMDQQTGNLKKA"
        "LLLKGSNEIEIRAEGNSRFTYSVTVDGCTSHTGAWGKTVIEYKTTKTSRLPIIDVAPLDVGAPDQEFGFDVGPVCFL"
    ),
}

# Sample BioFile objects for seed workspaces
def _make_biofile(name: str, seq_key: str, file_type: str = "protein") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "type": file_type,
        "sequence": SAMPLE_SEQUENCES.get(seq_key, ""),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

def _seed_workspaces():
    """Pre-populate workspaces matching the frontend mock data."""
    now = datetime.now(timezone.utc).isoformat()

    # Workspace 1: Whales and humans — comparative genomics
    ws1_files = [
        _make_biofile("Myoglobin_Human.fasta", "myoglobin_human"),
        _make_biofile("Myoglobin_Whale.fasta", "myoglobin_whale"),
        _make_biofile("Hemoglobin_Alpha_Human.fasta", "hemoglobin_alpha_human"),
        _make_biofile("Hemoglobin_Beta_Human.fasta", "hemoglobin_beta_human"),
        _make_biofile("Cytochrome_C_Human.fasta", "cytochrome_c_human"),
    ]
    ws1 = {
        "id": "1",
        "name": "Whales and humans",
        "owner": "Santiago Arizpe Dueñas",
        "description": "Comparative genomic analysis",
        "sequenceCount": len(ws1_files),
        "files": ws1_files,
        "createdAt": "2024-01-15T00:00:00",
    }

    # Workspace 2: Whale Genomic Data
    ws2_files = [
        _make_biofile("Myoglobin_Whale_v2.fasta", "myoglobin_whale"),
        _make_biofile("Myoglobin_Human_ref.fasta", "myoglobin_human"),
        _make_biofile("TP53_Human.fasta", "tp53_human"),
        _make_biofile("BRCA1_Human.fasta", "brca1_human"),
        _make_biofile("Insulin_Human.fasta", "insulin_human"),
        _make_biofile("Collagen_Human.fasta", "collagen_human"),
    ]
    ws2 = {
        "id": "2",
        "name": "Whale Genomic Data",
        "owner": "Santiago Arizpe Dueñas",
        "description": "High-depth whale genome sequences",
        "sequenceCount": len(ws2_files),
        "files": ws2_files,
        "createdAt": "2024-02-01T00:00:00",
    }

    # Workspace 3: Example Project
    ws3_files = [
        _make_biofile("Cytochrome_C_Human.fasta", "cytochrome_c_human"),
        _make_biofile("Hemoglobin_Beta_Human.fasta", "hemoglobin_beta_human"),
        _make_biofile("Insulin_Human.fasta", "insulin_human"),
    ]
    ws3 = {
        "id": "3",
        "name": "Example Project",
        "owner": "Santiago Arizpe Dueñas",
        "description": "Sample bioinformatics workflow",
        "sequenceCount": len(ws3_files),
        "files": ws3_files,
        "createdAt": "2024-03-10T00:00:00",
    }

    workspaces_db["1"] = ws1
    workspaces_db["2"] = ws2
    workspaces_db["3"] = ws3


_seed_workspaces()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class BioFileSchema(BaseModel):
    id: str
    name: str
    type: str  # "protein" | "dna"
    sequence: str
    createdAt: str

class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner: str
    description: str
    sequenceCount: int
    files: list[BioFileSchema] = []
    createdAt: str

class FileCreate(BaseModel):
    name: str
    type: str = "protein"
    sequence: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(current_user: dict = Depends(get_current_user)):
    """Return all workspaces. In production, filter by user."""
    return list(workspaces_db.values())


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: dict = Depends(get_current_user),
):
    ws_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    workspace = {
        "id": ws_id,
        "name": data.name,
        "owner": current_user.get("name") or current_user.get("email", "Unknown"),
        "description": data.description,
        "sequenceCount": 0,
        "files": [],
        "createdAt": now,
    }
    workspaces_db[ws_id] = workspace
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
):
    ws = workspaces_db.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    current_user: dict = Depends(get_current_user),
):
    ws = workspaces_db.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if data.name is not None:
        ws["name"] = data.name
    if data.description is not None:
        ws["description"] = data.description
    return ws


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
):
    ws = workspaces_db.pop(workspace_id, None)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")


# ---------------------------------------------------------------------------
# File management within a workspace
# ---------------------------------------------------------------------------

@router.post("/{workspace_id}/files", response_model=BioFileSchema, status_code=status.HTTP_201_CREATED)
async def add_file_to_workspace(
    workspace_id: str,
    file_data: FileCreate,
    current_user: dict = Depends(get_current_user),
):
    ws = workspaces_db.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    new_file = {
        "id": str(uuid.uuid4()),
        "name": file_data.name,
        "type": file_data.type,
        "sequence": file_data.sequence,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    ws.setdefault("files", []).append(new_file)
    ws["sequenceCount"] = len(ws["files"])
    return new_file


@router.delete("/{workspace_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_file_from_workspace(
    workspace_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    ws = workspaces_db.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    before = len(ws.get("files", []))
    ws["files"] = [f for f in ws.get("files", []) if f["id"] != file_id]
    ws["sequenceCount"] = len(ws["files"])

    if len(ws["files"]) == before:
        raise HTTPException(status_code=404, detail="File not found in workspace")
