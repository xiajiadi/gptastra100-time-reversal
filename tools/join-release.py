#!/usr/bin/env python3
"""Reassemble the release asset and verify all bytes against its manifest."""
import argparse
import hashlib
import json
from pathlib import Path


def join(folder):
    manifest = json.loads((folder / "SHA256.json").read_text(encoding="utf-8"))
    filename = "GPTAstra100_4K.mp4"
    if manifest["name"] != filename or not manifest["parts"]:
        raise ValueError("Invalid release manifest")

    output = folder / filename
    if output.exists():
        raise FileExistsError(output)

    partial = folder / (filename + ".partial")
    digest = hashlib.sha256()
    size = 0
    created = False
    try:
        with partial.open("xb") as stream:
            created = True
            for index, item in enumerate(manifest["parts"], 1):
                name = f"{filename}.part{index:02}"
                if item["name"] != name:
                    raise ValueError(f"Unexpected part name: {item['name']}")
                part_hash = hashlib.sha256()
                part_size = 0
                with (folder / name).open("rb") as part:
                    while chunk := part.read(1024 * 1024):
                        part_hash.update(chunk)
                        part_size += len(chunk)
                        digest.update(chunk)
                        stream.write(chunk)
                if part_size != item["size"] or part_hash.hexdigest() != item["sha256"]:
                    raise ValueError(f"Part failed verification: {name}")
                size += part_size
        if size != manifest["size"] or digest.hexdigest() != manifest["sha256"]:
            raise ValueError("Merged video failed verification")
        partial.rename(output)
        print(f"Verified {output} ({size} bytes)")
    finally:
        if created:
            partial.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="Folder containing the release parts and SHA256.json")
    join(parser.parse_args().folder.resolve())
