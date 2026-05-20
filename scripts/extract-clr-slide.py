"""One-off: export slide 2 of the user's TOC pptx as a high-res PNG.

Used to fetch the CLR map for the practitioner book (chapter 13).
"""
import os
import sys
import win32com.client

SRC = r"C:\Users\dann.pedersen\OneDrive - BESTSELLER\Desktop\Theory of Constraints.pptx"
OUT = r"C:\dev\tp-studio\docs\guide\diagrams\clr-map.png"
SLIDE_INDEX = 2  # "Categories of Legitimate Reservations"
WIDTH = 2400
HEIGHT = 1350

if not os.path.exists(SRC):
    sys.exit(f"Source file not found: {SRC}")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
# Pre-delete so PowerPoint's Export doesn't fail on overwrite path quirks.
if os.path.exists(OUT):
    os.remove(OUT)

ppt = win32com.client.Dispatch("PowerPoint.Application")
try:
    # ReadOnly=True, Untitled=False, WithWindow=False
    pres = ppt.Presentations.Open(SRC, True, False, False)
    try:
        slide = pres.Slides.Item(SLIDE_INDEX)
        slide.Export(OUT, "PNG", WIDTH, HEIGHT)
        print(f"Exported slide {SLIDE_INDEX} -> {OUT}")
    finally:
        pres.Close()
finally:
    ppt.Quit()
