import tempfile
from fastapi import FastAPI, File, HTTPException, UploadFile

# MinerU 0.11.x pipeline API.
# If you upgrade MinerU, verify these import paths and adapt the three
# pipe_* calls — keep the POST /parse → {"markdown", "assets"} contract fixed.
from magic_pdf.pipe.UNIPipe import UNIPipe
from magic_pdf.rw.DiskReaderWriter import DiskReaderWriter

app = FastAPI(title="MinerU parse service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/parse")
async def parse(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")

    with tempfile.TemporaryDirectory() as tmp_dir:
        rw = DiskReaderWriter(tmp_dir)
        pipe = UNIPipe(data, {"_pdf_type": "", "model_list": []}, rw)
        pipe.pipe_classify()
        pipe.pipe_analyze()
        pipe.pipe_parse()
        markdown: str = pipe.pipe_mk_markdown(tmp_dir, drop_mode="none")

    return {"markdown": markdown, "assets": []}
