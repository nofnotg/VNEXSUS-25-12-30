"""
VNEXUS Folder Sequential Analyzer

Purpose:
- This script assumes it is placed INSIDE the root development folder (e.g., vNexus).
- It recursively scans all subfolders and files.
- It outputs structured summaries (paths, sizes, extensions).
- Designed to be consumed sequentially by an AI agent or human reviewer.

Usage:
1. Place this file inside the root project folder.
2. Run: python vnexus_folder_sequential_analyzer.py
3. Output will be written to: _vnexus_structure_dump.txt
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "_vnexus_structure_dump.txt")

def scan_directory(base_dir):
    results = []
    for root, dirs, files in os.walk(base_dir):
        # skip virtual envs / cache if needed
        dirs[:] = [d for d in dirs if d not in {'.git', '__pycache__', 'node_modules', '.venv'}]
        for file in files:
            if file == os.path.basename(__file__):
                continue
            full_path = os.path.join(root, file)
            try:
                size = os.path.getsize(full_path)
            except OSError:
                size = -1
            rel_path = os.path.relpath(full_path, base_dir)
            results.append(f"FILE | {rel_path} | {size} bytes")
    return results

def main():
    entries = scan_directory(BASE_DIR)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("VNEXUS PROJECT STRUCTURE DUMP\n")
        f.write("=" * 40 + "\n")
        for line in entries:
            f.write(line + "\n")
    print(f"Scan complete. Output written to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
