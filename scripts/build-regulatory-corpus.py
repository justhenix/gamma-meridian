from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit("pypdf is required: python -m pip install pypdf") from exc


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "regulations" / "corpus-catalog.json"
RAW_DIR = ROOT / "data" / "regulations" / "raw"
NORMALIZED_DIR = ROOT / "data" / "regulations" / "normalized"
INGESTION_DIR = ROOT / "data" / "regulations" / "ingestion"
PROVENANCE_PATH = RAW_DIR / "provenance.json"
MANIFEST_PATH = ROOT / "docs" / "regulatory-corpus-manifest.md"
RETRIEVED_AT = "2026-08-30T08:30:00.000Z"

ARTICLE_RE = re.compile(r"^Pasal\s+([0-9]+[A-Z]?|[IVXLCDM]+)$", re.IGNORECASE)
STRUCTURE_RE = re.compile(r"^(BAB\s+[IVXLCDM]+|Bagian\s+.+|Paragraf\s+\d+|LAMPIRAN\b.*)$", re.IGNORECASE)
PAGE_NUMBER_RE = re.compile(r"^(?:-\s*)?\d+(?:\s*-)?$")
LEGAL_STRUCTURE_RE = re.compile(r"^(?:BAB|Bagian|Paragraf|Pasal|Ayat|LAMPIRAN)\b", re.IGNORECASE)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def download(url: str, destination: Path, expected_format: str) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MeridianRegulatoryCorpus/1.0 (+manual official-source acquisition)",
                "Accept": "application/pdf, application/zip, application/octet-stream;q=0.9, */*;q=0.1",
            },
        )
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    payload = response.read()
                destination.write_bytes(payload)
                break
            except Exception as error:  # noqa: BLE001 - downloader reports final normalized failure
                last_error = error
                if attempt == 2:
                    raise RuntimeError(f"Failed to download {url}") from last_error
                time.sleep(1.5 * (attempt + 1))

    payload = destination.read_bytes()
    if expected_format == "pdf" and not payload.startswith(b"%PDF"):
        raise RuntimeError(f"Downloaded artifact is not a PDF: {destination}")
    if expected_format == "zip" and not payload.startswith(b"PK"):
        raise RuntimeError(f"Downloaded artifact is not a ZIP archive: {destination}")
    return {
        "filename": destination.name,
        "path": destination.relative_to(ROOT).as_posix(),
        "url": url,
        "format": expected_format,
        "bytes": len(payload),
        "sha256": sha256_bytes(payload),
    }


def clean_line(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u00ad", "").replace("\u200b", "")
    value = value.replace("\ufb01", "fi").replace("\ufb02", "fl")
    return re.sub(r"[ \t]+", " ", value).strip()


def extract_pages(pdf_path: Path) -> list[list[str]]:
    reader = PdfReader(str(pdf_path))
    pages: list[list[str]] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append([clean_line(line) for line in text.splitlines() if clean_line(line)])
    return pages


def remove_page_furniture(pages: list[list[str]]) -> list[list[str]]:
    counts = Counter(
        line
        for page in pages
        for line in set(page)
        if len(line) <= 120 and not LEGAL_STRUCTURE_RE.match(line)
    )
    repeat_threshold = max(4, int(len(pages) * 0.35))
    repeated = {line for line, count in counts.items() if count >= repeat_threshold}
    cleaned: list[list[str]] = []
    for page in pages:
        page_lines = []
        for line in page:
            if line in repeated:
                continue
            if PAGE_NUMBER_RE.match(line):
                continue
            if re.fullmatch(r"(?:www\.)?(?:jdih\.kemenkeu|peraturan|pajak)\.go\.id", line, re.IGNORECASE):
                continue
            page_lines.append(line)
        cleaned.append(page_lines)
    return cleaned


def split_long_section(section: dict[str, Any], max_chars: int = 90000) -> list[dict[str, Any]]:
    body = section["bodyText"]
    if len(body) <= max_chars:
        return [section]
    parts: list[dict[str, Any]] = []
    paragraphs = body.split("\n")
    current: list[str] = []
    current_size = 0
    for paragraph in paragraphs:
        if current and current_size + len(paragraph) + 1 > max_chars:
            parts.append({**section, "bodyText": "\n".join(current)})
            current = []
            current_size = 0
        current.append(paragraph)
        current_size += len(paragraph) + 1
    if current:
        parts.append({**section, "bodyText": "\n".join(current)})
    for index, part in enumerate(parts, start=1):
        part["heading"] = f"{section['heading']} - Bagian {index}"
        part["locator"] = f"{section['locator']}; part {index}/{len(parts)}"
    return parts


def sections_from_pages(artifact_name: str, pages: list[list[str]]) -> list[dict[str, Any]]:
    flat = [(page_number, line) for page_number, lines in enumerate(pages, start=1) for line in lines]
    article_positions = [index for index, (_, line) in enumerate(flat) if ARTICLE_RE.match(line)]
    if not article_positions:
        return [
            {
                "heading": f"{artifact_name} - PDF page {page_number}",
                "locator": f"{artifact_name}; PDF page {page_number}",
                "bodyText": "\n".join(lines),
            }
            for page_number, lines in enumerate(pages, start=1)
            if "\n".join(lines).strip()
        ]

    sections: list[dict[str, Any]] = []
    first_article = article_positions[0]
    if first_article > 0:
        preamble = flat[:first_article]
        if preamble:
            sections.append(
                {
                    "heading": f"{artifact_name} - Pembukaan",
                    "locator": f"{artifact_name}; PDF pages {preamble[0][0]}-{preamble[-1][0]}",
                    "bodyText": "\n".join(line for _, line in preamble),
                }
            )

    latest_structure: list[str] = []
    for start_index, position in enumerate(article_positions):
        end = article_positions[start_index + 1] if start_index + 1 < len(article_positions) else len(flat)
        page_start, article_line = flat[position]
        segment = flat[position:end]
        page_end = segment[-1][0]
        preceding = flat[max(0, position - 12):position]
        structures = [line for _, line in preceding if STRUCTURE_RE.match(line)]
        if structures:
            latest_structure = structures[-3:]
        heading = " / ".join([*latest_structure, article_line]) if latest_structure else article_line
        page_locator = f"PDF page {page_start}" if page_start == page_end else f"PDF pages {page_start}-{page_end}"
        sections.append(
            {
                "heading": heading[:500],
                "locator": f"{artifact_name}; {article_line}; {page_locator}",
                "bodyText": "\n".join(line for _, line in segment),
            }
        )
    return sections


def normalize_source(source: dict[str, Any], provenance: list[dict[str, Any]]) -> dict[str, Any]:
    all_sections: list[dict[str, Any]] = []
    normalized_blocks: list[str] = []
    total_pages = 0
    for artifact in source["artifacts"]:
        if not artifact["ingestText"]:
            continue
        artifact_path = RAW_DIR / source["key"] / artifact["filename"]
        pages = remove_page_furniture(extract_pages(artifact_path))
        total_pages += len(pages)
        normalized_blocks.append(f"=== ARTIFACT: {artifact['filename']} ===")
        for page_number, lines in enumerate(pages, start=1):
            normalized_blocks.append(f"--- PDF PAGE {page_number} ---")
            normalized_blocks.extend(lines)
        artifact_sections = sections_from_pages(artifact["filename"], pages)
        for section in artifact_sections:
            all_sections.extend(split_long_section(section))

    if not all_sections:
        raise RuntimeError(f"No text sections extracted for {source['identifier']}")
    if len(all_sections) > 5000:
        raise RuntimeError(f"Section limit exceeded for {source['identifier']}: {len(all_sections)}")

    normalized_text = "\n".join(
        [
            f"IDENTIFIER: {source['identifier']}",
            f"TITLE: {source['title']}",
            f"CANONICAL URL: {source['canonicalUrl']}",
            f"VERSION: {source['versionLabel']}",
            "",
            *normalized_blocks,
            "",
        ]
    )
    normalized_path = NORMALIZED_DIR / f"{source['key']}.txt"
    normalized_path.write_text(normalized_text, encoding="utf-8", newline="\n")

    ingestion = {
        "officialIdentifier": source["identifier"],
        "title": source["title"],
        "authority": source["authority"],
        "jurisdiction": "ID",
        "sourceType": source["sourceType"],
        "canonicalUrl": source["canonicalUrl"],
        "versionLabel": source["versionLabel"],
        "publicationDate": source["publicationDate"],
        "effectiveFrom": source["effectiveFrom"],
        "effectiveTo": source["effectiveTo"],
        "retrievedAt": RETRIEVED_AT,
        "synthetic": False,
        "sections": [
            {
                "heading": section["heading"],
                "locator": section["locator"],
                "bodyText": section["bodyText"],
                "taxTopics": source["topics"],
            }
            for section in all_sections
        ],
    }
    ingestion_path = INGESTION_DIR / f"{source['key']}.json"
    ingestion_path.write_text(json.dumps(ingestion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return {
        "key": source["key"],
        "pages": total_pages,
        "sections": len(all_sections),
        "characters": sum(len(section["bodyText"]) for section in all_sections),
        "normalizedPath": normalized_path.relative_to(ROOT).as_posix(),
        "ingestionPath": ingestion_path.relative_to(ROOT).as_posix(),
    }


def manifest(catalog: list[dict[str, Any]], stats_by_key: dict[str, dict[str, Any]]) -> str:
    approved = sum(source["decision"] == "APPROVED" for source in catalog)
    review = sum(source["decision"] == "NEEDS_REVIEW" for source in catalog)
    lines = [
        "# Meridian Regulatory Corpus Manifest",
        "",
        f"Retrieval date: 2026-08-30  |  Candidates: {len(catalog)}  |  APPROVED: {approved}  |  NEEDS_REVIEW: {review}",
        "",
        "Only entries marked APPROVED are approved in the database. NEEDS_REVIEW entries are ingested as pending and excluded from production retrieval.",
        "",
        "| Identifier | Title | Authority | Topic | Official URL | Effective/current status | Why Meridian needs it | Ingestion status |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for source in catalog:
        stats = stats_by_key[source["key"]]
        status = (
            f"{source['decision']} - effective {source['effectiveFrom']}; "
            f"{source['statusNotes']} Extracted {stats['pages']} pages / {stats['sections']} sections."
        )
        cells = [
            source["identifier"],
            source["title"],
            source["authority"],
            ", ".join(source["topics"]),
            f"[official source]({source['canonicalUrl']})",
            status,
            source["why"],
            source["decision"],
        ]
        lines.append("| " + " | ".join(cell.replace("|", "\\|").replace("\n", " ") for cell in cells) + " |")

    lines.extend(["", "## Amendment and supersession relationships", ""])
    for source in catalog:
        lines.append(f"- **{source['identifier']}**: " + "; ".join(source["relationships"]) + ".")
    lines.extend(
        [
            "",
            "## Scope notes",
            "",
            "- PP 28/2025 sector annexes are not part of this MVP. KBLI/sector-specific licensing questions require human review.",
            "- Perpres 10/2021's official annex ZIP is preserved raw but not normalized; the instrument remains NEEDS_REVIEW.",
            "- Base-plus-amendment chains are deliberately pending until professionally consolidated.",
            "- Raw artifacts are immutable downloads under `data/regulations/raw/`; normalized text and ingestion bundles are derived outputs.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    INGESTION_DIR.mkdir(parents=True, exist_ok=True)

    provenance: list[dict[str, Any]] = []
    for source in catalog:
        for artifact in source["artifacts"]:
            result = download(
                artifact["url"],
                RAW_DIR / source["key"] / artifact["filename"],
                artifact["format"],
            )
            provenance.append(
                {
                    "sourceKey": source["key"],
                    "identifier": source["identifier"],
                    "retrievedAt": RETRIEVED_AT,
                    **result,
                }
            )
            print(f"acquired {source['identifier']} / {artifact['filename']} ({result['bytes']} bytes)")

    stats: list[dict[str, Any]] = []
    for source in catalog:
        result = normalize_source(source, provenance)
        stats.append(result)
        print(f"normalized {source['identifier']}: {result['pages']} pages, {result['sections']} sections")

    PROVENANCE_PATH.write_text(
        json.dumps({"retrievedAt": RETRIEVED_AT, "artifacts": provenance}, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    stats_by_key = {item["key"]: item for item in stats}
    MANIFEST_PATH.write_text(manifest(catalog, stats_by_key), encoding="utf-8", newline="\n")
    print(json.dumps({"sources": len(catalog), "artifacts": len(provenance), "sections": sum(item["sections"] for item in stats)}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - CLI needs one clear failure
        print(f"corpus build failed: {error}", file=sys.stderr)
        raise
